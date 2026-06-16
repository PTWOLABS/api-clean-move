# Service Price Specification Design

## Goal

Expand service pricing so an establishment can configure how each catalog service should be priced, while appointments can store the actual charged value for each booked service.

The pricing modes are:

- `FIXED`: exact fixed price.
- `STARTING_AT`: minimum price displayed as "starting at".
- `RANGE`: minimum and maximum price range.

This supports automotive detailing services where the final price can depend on vehicle condition, vehicle size, service difficulty, and products used.

## Recommended Approach

Model catalog pricing as a dedicated service price specification and keep appointment service prices as snapshots.

The catalog answers "what price policy does this service have?". The appointment answers "what value was charged for this service in this booking?".

The appointment use cases should resolve catalog services, derive or validate the charged price synchronously, and create a valid appointment snapshot before persistence. Domain events may be useful later for side effects such as notifications or audit trails, but they should not complete pricing data after an appointment is created because pricing is part of the appointment's consistency.

## Catalog Pricing

Add a catalog price specification with this public shape:

```ts
type ServicePriceSpecification = {
  type: "FIXED" | "STARTING_AT" | "RANGE";
  fixedPriceInCents?: number;
  minPriceInCents?: number;
  maxPriceInCents?: number;
};
```

Rules:

- `FIXED` requires `fixedPriceInCents`.
- `STARTING_AT` requires `minPriceInCents`.
- `RANGE` requires `minPriceInCents` and `maxPriceInCents`.
- All price values must be integer cents greater than or equal to zero.
- `RANGE.maxPriceInCents` must be greater than or equal to `RANGE.minPriceInCents`.
- Fields that do not apply to the selected type are rejected at the HTTP boundary.

The domain value object should expose:

- the selected type;
- the default charge price for a new appointment item;
- validation for a proposed charged price.

Default charge price:

- `FIXED`: fixed price.
- `STARTING_AT`: minimum price.
- `RANGE`: minimum price.

Charge validation:

- `FIXED`: charged price must equal the fixed price.
- `STARTING_AT`: charged price must be greater than or equal to the minimum price.
- `RANGE`: charged price must be between minimum and maximum, inclusive.

## Service Entity

The `Service` aggregate should own `priceSpecification` instead of a single internal `price: Money`.

For transition compatibility, HTTP presenters may continue returning `priceInCents`, derived from the specification default charge price. New responses should also include `priceSpecification` so clients can render fixed price, "starting at", and range displays correctly.

Existing services are migrated as:

```ts
{
  type: "FIXED",
  fixedPriceInCents: existingPriceInCents
}
```

This preserves current behavior until a user explicitly changes a service to `STARTING_AT` or `RANGE`.

## Service API Contract

Create and update service payloads should accept `priceSpecification`.

Example fixed price:

```json
{
  "serviceName": "Lavagem completa",
  "priceSpecification": {
    "type": "FIXED",
    "fixedPriceInCents": 8000
  }
}
```

Example starting at:

```json
{
  "serviceName": "Polimento",
  "priceSpecification": {
    "type": "STARTING_AT",
    "minPriceInCents": 25000
  }
}
```

Example range:

```json
{
  "serviceName": "Higienizacao interna",
  "priceSpecification": {
    "type": "RANGE",
    "minPriceInCents": 30000,
    "maxPriceInCents": 60000
  }
}
```

During transition, the current `price` input remains supported as a legacy alias for `FIXED`, but the preferred contract is `priceSpecification`.

Rules:

- requests cannot include both `price` and `priceSpecification`;
- requests with only `price` create or update the service as `FIXED`;
- responses include both legacy `priceInCents` and the new `priceSpecification`.

## Appointment API Contract

Appointments should support the current legacy service selection and a richer service item format.

Legacy format:

```ts
type AppointmentServicesLegacyInput = {
  serviceIds: string[];
};
```

New format:

```ts
type AppointmentServicesInput = {
  services: Array<{
    serviceId: string;
    priceInCents?: number;
  }>;
};
```

Rules:

- `services` is the preferred contract.
- `serviceIds` remains supported during transition.
- Requests cannot include both `serviceIds` and `services`; doing so returns `400`.
- Requests must include one of `serviceIds` or `services`; omitting both returns `400`.
- Duplicate service ids are rejected.
- When a new item omits `priceInCents`, the backend uses the service specification default charge price.
- When a new item includes `priceInCents`, the backend validates it against the catalog service specification before saving.

Booked service snapshots continue storing `servicePriceInCents`. That value represents the actual charged value for that appointment item.

## Application Flow

### CreateAppointmentUseCase

The use case should:

- resolve the establishment through `EstablishmentScopeService`;
- load and validate the customer and optional vehicle as it does today;
- normalize the request service input into service items;
- load each service from `ServicesRepository`;
- reject missing, deleted, inactive, duplicated, or out-of-scope services;
- resolve each item charge price from the request price or service default price;
- validate the charge price against the service price specification;
- build `AppointmentServiceSnapshot[]`;
- create and persist the appointment.

This keeps the appointment valid before it is saved.

### UpdateAppointmentUseCase

When services are updated, the same service item normalization and pricing validation rules apply.

When services are omitted, the current booked service snapshots are preserved. Existing appointment item prices are not recalculated just because the catalog service pricing changed later.

## Quotes

Quote services can remain unchanged in this feature scope.

When creating a quote from catalog services, the quote should copy the service default charge price into `quote_services.servicePriceInCents`. This matches the current snapshot behavior and avoids expanding the feature into manual quote item pricing.

When converting a quote to an appointment, the appointment should keep the quote service effective price as the booked service snapshot price. This preserves the commercial agreement captured by the quote.

## Persistence

Keep `services.price_in_cents` during this feature as the legacy default charge price column. It stores:

- the fixed price for `FIXED`;
- the minimum price for `STARTING_AT`;
- the minimum price for `RANGE`.

Add service pricing fields to represent:

- price specification type;
- maximum price for `RANGE`.

Keep appointment and quote service snapshot price columns:

- `appointment_booked_services.service_price_in_cents`;
- `quote_services.service_price_in_cents`.

These snapshot prices must not be recalculated from the catalog after creation.

Migration behavior:

- existing `services.price_in_cents` values become `FIXED` specifications;
- existing appointment and quote snapshots remain unchanged;
- `services.price_in_cents` remains present and is kept in sync with the specification default charge price.

## Error Handling

Return `400` for:

- invalid price specification type;
- missing required price field for the selected type;
- non-integer or negative price values;
- `RANGE` maximum below minimum;
- appointment request with both `serviceIds` and `services`;
- appointment request with neither `serviceIds` nor `services`;
- duplicate services in the same appointment;
- `FIXED` appointment item price different from the fixed catalog price;
- `STARTING_AT` appointment item price below the minimum;
- `RANGE` appointment item price outside the inclusive range.

Keep existing behavior for:

- missing resources as `404`;
- inactive services as `400`;
- forbidden establishment access as `403`;
- unexpected failures as `500`.

## Testing

Unit tests should cover:

- `ServicePriceSpecification` creation for all modes;
- invalid missing, negative, non-integer, and inconsistent prices;
- default charge price for all modes;
- charge price validation for all modes;
- `Service.create` and `Service.update` with price specifications;
- appointment service resolution for legacy `serviceIds`;
- appointment service resolution for new `services`;
- rejection when both service formats are sent;
- preservation of current appointment service prices when services are omitted on update.

HTTP e2e tests should cover:

- creating services with `FIXED`, `STARTING_AT`, and `RANGE`;
- updating service price specification;
- service list and detail responses include `priceSpecification`;
- legacy `priceInCents` remains present and equals the specification default charge price;
- creating appointments with `serviceIds`;
- creating appointments with `services` and explicit price;
- creating appointments with `services` and omitted price;
- rejecting prices outside each modality rule;
- updating appointment services with explicit prices;
- rejecting ambiguous service payloads.

Mapper and presenter tests should cover round trips between Prisma records, domain entities, and HTTP output.

## Out Of Scope

- Manual per-item quote pricing.
- Discount redesign.
- Price override reason/audit trail.
- Removing the legacy `serviceIds` appointment payload.
- Removing legacy service `price` input or response `priceInCents` fields.
