# Quote Approval Resource Resolution Design

## Context

A quote can contain snapshots that are not yet linked to persisted customer,
vehicle, or catalog service records. This is intentional while the quote is
pending: the snapshot preserves the commercial proposal without forcing every
resource into the establishment's registers.

Before conversion, the same real-world resource may be persisted through a
different flow. Typical examples are two prospect quotes for the same customer
or two quotes containing a detached service with the same name. The second
conversion can then encounter an active-resource uniqueness constraint even
though the quote was valid when created.

The current implementation has several relevant properties:

- A prospect must be linked to a customer before `Quote.approve` can proceed.
- `POST /quotes/:quoteId/register-customer` creates a customer and optionally a
  vehicle, but only treats an existing CPF/CNPJ as a generic conflict.
- Detached quote services are materialized in the catalog by
  `CreateAppointmentOnQuoteApproved`.
- The approval and synchronous domain-event subscriber run inside the same
  `UnitOfWork`, so service creation, appointment creation, and quote conversion
  are already atomic.
- PostgreSQL partial unique indexes protect active customer CPF/CNPJ, vehicle
  plate, and case-insensitive service name.
- Quote, appointment, vehicle, customer, and service snapshots intentionally
  preserve historical values.
- The database gives every `quote_services` row an ID, but the quote domain
  model and mapper currently discard it.
- There is no general quote-edit endpoint that the establishment can use after
  receiving a conversion conflict.

The goal is to turn expected identity and catalog conflicts into an explicit,
resolvable approval flow without weakening database integrity or silently
changing a negotiated quote.

## Product Decisions

- Quote creation remains permissive. Multiple pending quotes may describe the
  same prospect or detached service.
- The frontend may show advisory matches earlier, but the authoritative
  analysis happens immediately before approval.
- Approval uses a read-only analysis followed by one transactional command
  containing the establishment's decisions.
- Every decision is revalidated during approval. A previous analysis is never
  trusted as a lock on current state.
- CPF/CNPJ is the only customer field that permits automatic association.
- Phone, email, name, address, and vehicle plate are evidence used to suggest
  candidates, not automatic identity keys.
- Services are never associated automatically. Even an exact normalized name
  requires an explicit establishment decision.
- Associating an existing resource changes references, not snapshots.
- Resolution may rename a detached quote service, but cannot change its price
  or any other commercial field.
- The system does not manage customer re-acceptance after a service rename.
  Communicating that rename is the establishment's responsibility.
- Other pending quotes are never changed automatically.
- Approval remains all-or-nothing.

## Considered Approaches

### 1. Read-only analysis followed by transactional approval

Add an approval-analysis endpoint. The frontend presents its conflicts and
sends the selected resolutions with the approval request. Approval reloads all
state, re-runs the analysis, applies valid decisions, creates missing resources
and the appointment, and converts the quote in one transaction.

This is the selected approach. It provides a proactive UX without introducing
partially resolved approval state.

### 2. Separate analysis and mutation endpoints

An analysis endpoint would be followed by a conflict-resolution endpoint that
mutates the quote before the existing approval endpoint is called.

This keeps the approval payload smaller and preserves corrections even when the
user does not approve immediately. It was not selected because the resolution
and conversion would be separate transactions and could diverge between calls.

### 3. Return conflicts from the first approval attempt

The frontend would call approve, receive conflicts, and retry with decisions.

This needs fewer endpoints, but makes a failed mutation attempt part of the
normal user journey and does not satisfy the desired pre-approval analysis UX.

## Architecture

The application flow is:

```text
Analyze approval -> present conflicts -> approve with decisions
                                           |
                                           v
                          reload and revalidate in UnitOfWork
                                           |
                                           v
                  resolve resources -> create appointment -> convert quote
```

### AnalyzeQuoteApprovalUseCase

This read-only use case:

1. Resolves the establishment scope.
2. Loads the quote and rejects a missing or already converted quote.
3. Validates the proposed schedule interval.
4. Loads relevant customer, vehicle, and service records.
5. Delegates matching and conflict classification to
   `QuoteApprovalAnalyzer`.
6. Returns `READY` or `REQUIRES_RESOLUTION` with candidates, differences,
   automatic resolutions, and allowed actions.

The optional prospect email supplied to this use case is evidence for the
current analysis only. It does not mutate the quote snapshot.

### QuoteApprovalAnalyzer

The analyzer is shared by analysis, registration, and approval. It has no write
side effects and produces a structured result from the quote and current
resource state.

It delegates focused rules to:

- `QuoteCustomerMatcher` for normalized customer evidence and ambiguity;
- `QuoteVehicleMatcher` for plate and ownership consistency;
- `QuoteServiceMatcher` for detached-name candidates and linked-resource
  availability.

Matching and mutation stay separate so the same classification is used by the
preview and the command.

### ApproveQuoteUseCase

Inside one `UnitOfWork`, approval:

1. Reloads the quote.
2. Re-runs the complete analysis.
3. Verifies that supplied decisions address every current required conflict.
4. Applies automatic customer association when an exact CPF/CNPJ match exists.
5. Applies explicit customer, vehicle, and service decisions.
6. Creates any customer, vehicle, or catalog service required by the decisions.
7. Creates the appointment from the quote snapshots.
8. Marks the quote as converted using the existing conditional update.
9. Emits the post-conversion domain signal.

If any step fails, the transaction rolls back every preceding write.

### Explicit conversion instead of a consistency subscriber

`CreateAppointmentOnQuoteApproved` currently performs consistency-critical
writes in response to `QuoteApprovedEvent`. This subscriber will be removed
from the conversion path. Its orchestration will move to an explicit
`QuoteToAppointmentConverter` called by `ApproveQuoteUseCase`.

Domain events remain available for consequences of an already consistent
conversion, but they do not create resources required for the conversion to be
valid.

### RegisterQuoteProspectAsCustomerUseCase

The existing endpoint remains available for early resolution. It reuses the
customer and vehicle matching rules and supports an explicit existing-customer
selection.

Existing create-customer input remains compatible when there is no ambiguous
match. An exact active CPF/CNPJ match links automatically. Evidence-only
matches return candidates unless the request explicitly selects an existing
customer or confirms creation of a new customer.

Approval always revalidates the resulting links.

## Domain Model Changes

### Stable quote service identity

Each quoted service needs the existing `quote_services.id` represented in the
domain. The item may become an entity or retain value-object behavior with a
stable `quoteServiceId`, but callers must be able to address it without using
array position.

The quote aggregate gains methods with narrow invariants, such as:

- associate a quoted service with a catalog service;
- rename a detached quoted service;
- link a customer and optional vehicle during resolution.

The aggregate rejects:

- a missing quoted-service ID;
- association of two quote items to the same catalog service;
- renaming an already associated item through the detached rename action;
- invalid or empty service names;
- changes after conversion.

Repository-backed availability and establishment-scope checks remain in the
application layer.

### Snapshot invariants

Customer and vehicle association never rewrites their snapshots. Service
association only changes `serviceId`.

After quote creation, resolution cannot change:

- service price;
- catalog price mode;
- duration;
- category;
- courtesy status;
- payment options or totals;
- customer or vehicle snapshot data.

The only permitted snapshot mutation is an explicit rename of a detached
service. That rename does not require system-managed customer re-acceptance.

## Customer Matching and Resolution

All matching is scoped to active records in the quote's establishment and uses
normalized values.

### Automatic identity

An exact CPF/CNPJ match is deterministic because active customer documents are
unique per establishment. The analysis reports the planned automatic link and
approval applies it without asking the user to select the same record.

If other evidence points elsewhere, the document match still determines the
customer, while vehicle ownership or inconsistent evidence is reported as a
separate warning or required vehicle resolution.

### Candidate evidence

The following exact normalized values may produce candidates:

- phone;
- email supplied to analysis or customer registration;
- full name;
- vehicle plate and the vehicle's owner.

Address is not an initial lookup key. Once a candidate has been found through
another signal, its address may be compared and returned as supporting or
conflicting display information.

No fuzzy matching is required in the initial implementation. Name or address
alone may be displayed as advisory similarity but must not make the analysis
`REQUIRES_RESOLUTION`. An exact phone, exact email, or plate-owner match does
require an explicit choice. Phone and email are not unique domain keys and
never auto-link a customer.

If evidence points to more than one customer, the result is ambiguous and the
establishment must explicitly select a customer or confirm creation of a new
one. Confirming a new customer remains subject to the CPF/CNPJ unique index.

### Linked customer availability

An existing non-deleted linked customer remains valid even if profile data has
changed; the quote snapshot is preserved. A deleted or missing linked customer
requires replacement or creation before conversion.

## Vehicle Matching and Resolution

An exact active plate match suggests the vehicle and its owner but does not
automatically associate it. Ownership must agree with the resolved customer.

Supported decisions are:

- link an existing vehicle owned by the resolved customer;
- create a vehicle from the quote snapshot when its plate is available;
- keep the vehicle as snapshot-only with a null `vehicleId`.

The approval must never move a persisted vehicle between customers implicitly.
If a selected vehicle belongs to another customer, it returns an ownership
conflict.

A linked non-deleted vehicle remains usable when its profile changes because
the appointment uses the quote snapshot. A deleted vehicle cannot be linked to
a new appointment; the establishment must select another vehicle or keep the
snapshot without a vehicle reference.

## Service Matching and Resolution

### Already linked services

Changes to name, category, duration, price specification, or price after quote
creation do not invalidate the quote. Approval preserves the quoted service
snapshot and charged value.

An inactive, non-deleted linked service requires an explicit choice:

- keep the existing link and honor the quote snapshot; or
- associate the item with another service.

A soft-deleted linked service cannot remain the service reference of a newly
created appointment. It must be replaced with an existing service or recreated
as a new catalog service from the quote snapshot.

### Detached services

An exact case-insensitive normalized name match against a non-deleted catalog
service produces a candidate. It never produces automatic association, even
when every other field is equal.

The establishment may:

- `ASSOCIATE_EXISTING`: set only the item's `serviceId`;
- `RENAME_DETACHED`: change only the quoted service name;
- cancel approval and make no changes.

When there is no conflicting catalog name, the normal approval path creates a
catalog service from the detached snapshot. Its initial price specification is
`FIXED` at the snapshot price, matching current behavior. A courtesy item still
retains its underlying quoted value while the appointment charge remains zero.

Associating a service with different current catalog values does not update the
quote. For example, a quote at R$ 50 may be associated with a service currently
configured as starting at R$ 60 when the establishment explicitly chooses that
association. The catalog remains at R$ 60, while the quote and appointment
remain at R$ 50.

### Rename validation

A detached rename must:

- pass `ServiceName` validation;
- be unique among the detached names in the same quote;
- not duplicate a service already associated in the quote;
- be available under the case-insensitive non-deleted service-name unique
  index;
- be revalidated in the approval transaction.

If the name is unavailable, the API reports the existing service as a candidate
instead of changing the price or silently associating it.

Two quote items cannot resolve to the same catalog service because appointment
booked services are unique by appointment and service.

## Resolution Actions

Resolution requests use discriminated actions. Each action accepts only the
fields required for that action.

Customer actions are:

- `LINK_EXISTING`, with a customer ID from the current establishment;
- `CREATE_NEW`, with the required customer registration data.

Vehicle actions are:

- `LINK_EXISTING`, with a vehicle ID owned by the resolved customer;
- `CREATE_FROM_SNAPSHOT`, using the unchanged quote vehicle snapshot;
- `KEEP_SNAPSHOT_ONLY`, which clears or retains a null `vehicleId` without
  changing the snapshot.

Service actions are:

- `ASSOCIATE_EXISTING`, with a non-deleted service ID;
- `KEEP_INACTIVE_LINK`, only for an already linked, non-deleted inactive
  service;
- `RENAME_DETACHED`, with a new name and no price field;
- `RECREATE_FROM_SNAPSHOT`, only for a linked soft-deleted service whose
  snapshot can be materialized under an available catalog name.

There is no action that changes price, duration, category, courtesy, customer
snapshot, vehicle snapshot, or payment options. Omitting a required action or
supplying an action that does not apply to the current conflict returns a
structured resolution error.

## HTTP Contract

### Analyze approval

Add:

```http
POST /quotes/:quoteId/approval-analysis
```

Example request:

```json
{
  "startsAt": "2026-07-20T13:00:00.000Z",
  "endsAt": "2026-07-20T15:00:00.000Z",
  "prospect": {
    "email": "cliente@example.com"
  }
}
```

`prospect.email` is optional and is not persisted by analysis.

Example conflict response:

```json
{
  "status": "REQUIRES_RESOLUTION",
  "automaticResolutions": [],
  "customer": {
    "status": "CANDIDATES_FOUND",
    "candidates": [
      {
        "customerId": "customer-id",
        "matchedBy": ["PHONE", "EMAIL"],
        "conflictingFields": ["NAME"]
      }
    ]
  },
  "vehicle": {
    "status": "SNAPSHOT_ONLY",
    "candidates": []
  },
  "services": [
    {
      "quoteServiceId": "quote-service-id",
      "status": "CANDIDATE_FOUND",
      "snapshot": {
        "name": "Polimento",
        "priceInCents": 5000
      },
      "candidate": {
        "serviceId": "service-id",
        "name": "Polimento",
        "priceSpecification": {
          "type": "STARTING_AT",
          "minPriceInCents": 6000
        }
      },
      "differences": ["PRICE_SPECIFICATION", "PRICE"]
    }
  ]
}
```

The top-level status is `READY` when no explicit decision is required.
Automatic CPF/CNPJ association is included in `automaticResolutions` so the
frontend can explain it without showing a choice.

### Approve with resolutions

Extend:

```http
POST /quotes/:quoteId/approve
```

Example request:

```json
{
  "startsAt": "2026-07-20T13:00:00.000Z",
  "endsAt": "2026-07-20T15:00:00.000Z",
  "customerResolution": {
    "action": "LINK_EXISTING",
    "customerId": "customer-id",
    "vehicleAction": "KEEP_SNAPSHOT_ONLY"
  },
  "serviceResolutions": [
    {
      "quoteServiceId": "quote-service-id",
      "action": "ASSOCIATE_EXISTING",
      "serviceId": "service-id"
    },
    {
      "quoteServiceId": "another-quote-service-id",
      "action": "RENAME_DETACHED",
      "serviceName": "Polimento promocional"
    }
  ]
}
```

Resolution fields are optional when the current analysis is `READY`. The
existing schedule-only request remains compatible in that case.

When a new customer or vehicle is created during approval, the corresponding
resolution carries the same required registration data used by the existing
registration endpoint. HTTP validation uses a discriminated union so fields
required by one action are rejected or required predictably.

### Resolution-required response

Missing, stale, or incomplete decisions return HTTP 409 with the current
analysis:

```json
{
  "statusCode": 409,
  "code": "QUOTE_APPROVAL_RESOLUTION_REQUIRED",
  "message": "Quote approval requires resource resolution.",
  "analysis": {
    "status": "REQUIRES_RESOLUTION"
  }
}
```

This response also protects clients that call approve without first calling
analysis. The frontend never needs to parse technical messages.

### Register prospect early

`POST /quotes/:quoteId/register-customer` gains explicit existing-customer and
vehicle resolution fields while retaining the current create payload. Evidence
matches return HTTP 409 `CUSTOMER_RESOLUTION_REQUIRED` with candidates unless
the caller supplies an explicit valid action. Exact active CPF/CNPJ association
may be applied automatically.

## Error Handling

Stable business codes include:

- `QUOTE_APPROVAL_RESOLUTION_REQUIRED`;
- `QUOTE_APPROVAL_CONFLICTS_CHANGED`;
- `QUOTE_CUSTOMER_MATCH_AMBIGUOUS`;
- `QUOTE_VEHICLE_OWNERSHIP_CONFLICT`;
- `QUOTE_SERVICE_INACTIVE`;
- `QUOTE_SERVICE_DELETED`;
- `QUOTE_SERVICE_NAME_UNAVAILABLE`;
- `QUOTE_DUPLICATE_SERVICE_RESOLUTION`;
- `QUOTE_INVALID_RESOLUTION_ACTION`;
- `CUSTOMER_RESOLUTION_REQUIRED`.

Expected resolution conflicts use HTTP 409. Structurally invalid or
incompatible actions use HTTP 400. Missing resources use HTTP 404. Cross-scope
resource selection uses HTTP 403.

The Prisma error translator must preserve enough unique-constraint information
to distinguish customer document, vehicle plate, and service name races. When a
race occurs, approval rolls back, re-runs read-only analysis outside the failed
transaction, and returns HTTP 409 with current conflicts rather than a generic 500.

## Persistence

No structural migration is required. The necessary columns and partial unique
indexes already exist.

The Prisma quote mapper must preserve `quote_services.id`. Quote persistence
must stop deleting and recreating every quoted service and payment option for a
resource-resolution update. It should update only:

- `quotes.customer_id`;
- `quotes.vehicle_id`;
- the selected `quote_services.service_id` values;
- a selected detached `quote_services.service_name` value.

Repository contracts may expose a focused resolution save operation, or the
general save implementation may use stable upserts. In either case, payment
options and unrelated snapshots are not rewritten.

The current partial unique indexes remain the final race protection:

- active customer document per establishment;
- active vehicle plate per establishment;
- case-insensitive non-deleted service name per establishment.

`markAsConverted` retains its conditional update. If two transactions approve
the same quote, the losing transaction throws and rolls back its appointment
and created resources.

## Domain Events

The consistency workflow is explicit and synchronous in the use case. After
the appointment exists and the quote is marked converted, the aggregate may
emit `QuoteConvertedEvent` with quote, appointment, establishment, and
occurrence identifiers.

Potential future audit events are:

- `QuoteCustomerLinkedEvent`;
- `QuoteServiceAssociatedEvent`;
- `QuoteServiceRenamedEvent`.

They are not required initially. No event handler may be responsible for making
the approval transaction valid. External irreversible side effects such as
notifications require an after-commit or outbox mechanism and are outside this
scope.

## Transaction and Concurrency Guarantees

The existing `UnitOfWork` wraps resolution, resource creation, appointment
creation, and conversion. Every repository participating in approval uses the
transaction-scoped Prisma client.

Approval revalidates all decisions after loading current resource state. This
allows an earlier analysis to become stale safely. A changed candidate, newly
occupied name, changed ownership, deleted resource, or completed quote returns
a current business result rather than applying an outdated decision.

The design does not reserve candidates between analysis and approval. Database
constraints and rollback are the correctness boundary.

## Tests

### Unit tests

Cover matching, aggregate invariants, and application decisions:

- exact CPF/CNPJ produces automatic customer association;
- phone, email, name, and plate produce candidates only;
- evidence pointing to different customers is ambiguous;
- name or address alone does not block new-customer creation;
- vehicle ownership must match the resolved customer;
- a detached exact service name produces a candidate, never auto-association;
- service association changes only `serviceId`;
- service rename changes only `serviceName`;
- unavailable or invalid names reject rename;
- duplicate resolved service IDs are rejected;
- current catalog price and price-mode changes do not affect the quote;
- inactive and deleted linked services expose their permitted actions;
- incomplete, incompatible, or out-of-scope decisions fail;
- quote service IDs remain stable;
- resolving one quote does not mutate another quote.

### Integration tests

Use Prisma and PostgreSQL to cover:

- stable `quote_services.id` mapping and focused updates;
- case-insensitive service-name uniqueness;
- customer document and vehicle plate partial uniqueness;
- rollback after failure at each approval stage;
- two quotes concurrently materializing the same customer or service;
- two concurrent approvals of one quote;
- reanalysis and structured conflict after a unique race;
- conversion without `CreateAppointmentOnQuoteApproved`;
- appointment persistence with the original quote snapshots.

### End-to-end tests

Cover the HTTP contract:

- `READY` analysis;
- analysis with automatic CPF/CNPJ resolution;
- ambiguous customer candidates;
- vehicle ownership conflict;
- detached service candidate with catalog differences;
- inactive and deleted linked service conflicts;
- approval with customer, vehicle, and service decisions;
- approval with detached service rename;
- schedule-only approval when no resolution is required;
- HTTP 409 plus current analysis when resolution is missing or stale;
- early prospect registration with automatic and explicit association;
- stable error codes for every conflict class;
- unchanged quoted and appointment prices after catalog price-mode updates;
- complete rollback with no orphan customer, service, vehicle, or appointment.

## Compatibility and Scope

This change adds one endpoint and extends two existing request contracts. The
current approval and registration payloads remain valid when no new conflict
requires a decision.

There is no snapshot backfill or recalculation. Existing quotes and appointments
keep their stored commercial values.

The legacy internal flow deleted by this change is the consistency-critical
`CreateAppointmentOnQuoteApproved` subscriber. No public endpoint is removed.

The following are explicitly outside scope:

- fuzzy customer or service matching;
- automatic updates to other pending quotes;
- changing quote prices during resolution;
- changing catalog service data during quote approval;
- customer re-acceptance or quote revision tracking;
- external notification delivery;
- persistent conflict or resolution audit tables.

## Success Criteria

- A second quote for the same documented customer can link to the existing
  customer without a duplicate-registration error.
- Evidence-only customer matches are explained and require an explicit choice.
- A detached service conflict is resolvable without silently changing its
  price or associating it by name.
- Renaming a detached service validates current name availability.
- Linked catalog changes never recalculate a quote or appointment snapshot.
- Inactive and deleted resources have explicit, deterministic resolution
  paths.
- Approval creates no partial resources on failure.
- Concurrent state changes produce structured HTTP 409 responses rather than
  ambiguous persistence errors.
