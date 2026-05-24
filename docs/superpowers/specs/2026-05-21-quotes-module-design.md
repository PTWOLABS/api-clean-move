# Quotes Module Design

## Context

The application currently has establishment-operated scheduling. An `Appointment` is an operational record with dates, status, booked service snapshots, optional vehicle snapshot, and manual completion/cancellation.

The business now needs professional customer quotes. A quote is related to scheduling, but it is not just an appointment draft. It can be created for a registered customer or for a prospect, has commercial payment options, can include courtesy services, has optional validity and terms, and must be exported as a polished PDF.

The example quote PDF shows this shape clearly:

- establishment identity: name, CNPJ, address, and visual branding;
- customer fields: name, optional phone/document/address;
- vehicle fields: model, year, plate, and color;
- service rows with name and price;
- courtesy rows that appear in the PDF but do not affect the total;
- payment options such as card installments without discount and cash/Pix with discount;
- terms and validity text.

## Recommended Approach

Create a new `quotes` domain module with a `Quote` aggregate. Keep scheduling focused on operational appointments and connect the two through an explicit conversion use case.

This is the best fit because a quote is a commercial document, while an appointment is an operational schedule entry. Mixing quote fields into `Appointment` would add many nullable fields and blur rules around prospects, PDF generation, payment options, validity, and conversion tracking.

Use `Quote` as the code name instead of `Budget`. In English, `budget` usually means a spending limit or financial budget, while `quote` represents a commercial estimate/proposal.

## Domain Model

### Quote

Fields:

- `id`
- `establishmentId`
- `customerId`, optional
- `vehicleId`, optional
- `convertedAppointmentId`, optional
- `convertedAt`, optional
- `establishment` snapshot
- `customer` snapshot
- `vehicle` snapshot, optional
- `services`
- `paymentOptions`
- `description`, optional
- `termsAndConditions`, optional
- `expiresAt`, optional
- `createdAt`
- `updatedAt`

Rules:

- A quote belongs to one establishment.
- A quote can reference an existing `Customer`, but it can also be created for a prospect with customer data in the request.
- `customer` snapshot is required even when `customerId` is null.
- `startsAt` and `endsAt` do not exist on `Quote` in the MVP.
- Quote status does not exist in the MVP.
- Conversion is tracked by `convertedAppointmentId` and `convertedAt`.
- A quote can be converted to an appointment only once.
- A quote must contain at least one service.
- Duplicate services are not allowed in the same quote in the MVP.
- A quote can have zero total only when its services are marked as courtesy.
- `description`, `termsAndConditions`, and text fields are normalized by trimming empty strings to null.
- `expiresAt`, when present, must be a valid date.

### Establishment Snapshot

Fields:

- `name`
- `legalBusinessName`
- `cnpj`
- `address`, optional
- `bannerImageUrl`, optional

Source:

- `name`, `legalBusinessName`, `cnpj`, and `bannerImageUrl` come from `Establishment`.
- `address` comes from the owner `User.address` referenced by the establishment.
- State registration / `IE` is intentionally out of scope for the MVP.

The snapshot preserves the PDF content even if the establishment profile changes later.

### Customer Snapshot

Fields:

- `name`
- `phone`, optional
- `cpfCnpj`, optional
- `address`, optional

Rules:

- When `customerId` is provided, the use case loads the active customer from the same establishment and freezes these fields from the current customer record.
- When `customerId` is not provided, the request must provide at least `customer.name`; other customer fields remain optional.
- Creating a quote without `customerId` never creates a `Customer` automatically.
- A separate explicit action can later register the prospect as a `Customer` when the establishment chooses to do so.

### Vehicle Snapshot

Fields:

- `plate`, optional
- `brand`, optional
- `model`, optional
- `color`, optional
- `year`, optional

Rules:

- `vehicleId` is optional.
- When `vehicleId` is provided, the vehicle must belong to the selected registered customer and establishment.
- For a prospect quote, vehicle data can be provided directly in the request without a `vehicleId`.
- Creating a quote with vehicle snapshot data never creates a `CustomerVehicle` automatically.
- If a prospect quote is later registered as a customer, the establishment can choose whether the quote vehicle snapshot should also become a customer vehicle.
- The snapshot preserves the PDF content even if the vehicle record changes later.

### Quote Services

Each quote has many quote service rows.

Fields:

- `serviceId`
- `serviceName`
- `category`, optional
- `durationInMinutes`, optional
- `priceInCents`
- `isCourtesy`
- `position`

Rules:

- Services must come from the catalog.
- The service must exist, belong to the establishment, be active, and not be deleted.
- `serviceName`, category, duration, and price are copied from the catalog at quote creation time.
- `isCourtesy` defaults to false.
- Courtesy services are listed in the PDF but do not contribute to subtotal.
- `priceInCents` is still stored for courtesy services as the original catalog value, while quote calculations treat the effective value as zero. This preserves the commercial value of the courtesy.
- `position` preserves PDF and response ordering.

### Payment Options

Each quote has one or more structured payment options.

Fields:

- `method`: `CASH`, `PIX`, `CARD`, or `OTHER`
- `label`
- `installments`, optional
- `interestFree`
- `discountType`: `PERCENTAGE`, `AMOUNT`, or null
- `discountValue`, optional
- `totalInCents`
- `position`

Rules:

- A quote must contain at least one payment option.
- `totalInCents` is calculated by the domain/application from subtotal and discount rules.
- Percentage discounts must be between 0 and 100.
- Amount discounts cannot be negative and cannot exceed subtotal.
- Card payment can represent installments, for example 10 installments without interest.
- Cash/Pix payment can represent a discount, for example 10% off.
- The PDF displays the structured options; the frontend does not calculate quote totals.

## Application Use Cases

### CreateQuoteUseCase

Creates a quote for the authenticated establishment scope.

Input:

- actor: authenticated user id and role
- `customerId`, optional
- `customer`, required only when `customerId` is absent
- `vehicleId`, optional
- `vehicle`, optional
- `serviceItems`: list of `{ serviceId, isCourtesy? }`
- `paymentOptions`
- `description`, optional
- `termsAndConditions`, optional
- `expiresAt`, optional

Behavior:

- Resolve establishment through `EstablishmentScopeService`.
- Load the establishment owner user to snapshot the owner address.
- If `customerId` is present, load the active customer in the establishment and snapshot it.
- If `customerId` is absent, build the customer snapshot from request prospect data.
- If `vehicleId` is present, require `customerId` and validate that the vehicle belongs to the selected customer and establishment.
- Do not create customers or vehicles implicitly during quote creation.
- Load each service from catalog, reject inactive/deleted/missing services, and build service snapshots.
- Build structured payment options and calculate totals.
- Persist the `Quote`.

### ListQuotesUseCase

Lists quotes for the resolved establishment.

Initial filters:

- `search`
- `customerId`
- `customerName`
- `vehicleId`
- `vehiclePlate`
- `serviceId`
- `serviceName`
- `expiresFrom`
- `expiresTo`
- `converted`, boolean
- `createdAt`
- pagination

### GetQuoteUseCase

Returns one quote by id after validating establishment scope.

### GenerateQuotePdfUseCase

Returns a PDF for one quote after validating establishment scope.

Behavior:

- Load the quote.
- Build a PDF view model from the quote snapshot and calculated totals.
- Generate PDF in the backend.
- Return a `Buffer` or stream with `Content-Type: application/pdf`.
- Use `bannerImageUrl` when available, but generation must work without an image.

### CreateAppointmentFromQuoteUseCase

Creates an operational appointment from an existing quote.

Input:

- actor
- `quoteId`
- `startsAt`
- `endsAt`, optional

Behavior:

- Resolve establishment scope.
- Load the quote from the same establishment.
- Reject quotes that already have `convertedAppointmentId`.
- Require the quote to have `customerId`. A prospect quote can remain only as a quote, but it must be explicitly registered as a customer before conversion to appointment.
- Do not create customers or vehicles implicitly during conversion.
- Create an `Appointment` using quote service snapshots, customer id, vehicle snapshot, vehicle id when available, `startsAt`, and optional `endsAt`.
- Save the appointment.
- Mark the quote as converted with `convertedAppointmentId` and `convertedAt`.

### RegisterQuoteProspectAsCustomerUseCase

Explicitly registers a prospect quote as a `Customer` when the establishment chooses to do so.

Input:

- actor
- `quoteId`
- customer fields required by the current `Customer` invariant when missing from the quote snapshot, especially `email` and `phone`
- `createVehicleFromQuote`, optional boolean, default false

Behavior:

- Resolve establishment scope.
- Load the quote from the same establishment.
- Reject if the quote already has `customerId`.
- Create a customer from the quote customer snapshot.
- Update the quote with the new `customerId`.
- If `createVehicleFromQuote` is true and the quote has a vehicle snapshot, create a `CustomerVehicle` for the new customer from the quote vehicle snapshot and update the quote with the new `vehicleId`.
- If `createVehicleFromQuote` is false, leave `vehicleId` null and preserve only the quote vehicle snapshot.
- Return the customer, optional created vehicle, and updated quote.

The current `Customer` entity requires phone and email. Prospect quote data makes phone optional and does not include email. `POST /quotes/:id/register-customer` must require any missing customer fields, especially email and phone, instead of weakening the global `Customer` invariant.

## HTTP Contract

Quote endpoints:

- `POST /quotes`
- `GET /quotes`
- `GET /quotes/:quoteId`
- `GET /quotes/:quoteId/pdf`
- `POST /quotes/:quoteId/convert-to-appointment`
- `POST /quotes/:quoteId/register-customer`

Authorization:

- Use the existing authenticated session guard.
- Resolve establishment through `EstablishmentScopeService` in use cases.
- Allow `ESTABLISHMENT` and `EMPLOYEE` actors.
- Fine-grained employee features such as `create:quotes`, `read:quotes`, and `convert:quotes` can be added after the MVP follows the existing employee feature policy.

Create quote request shape:

```json
{
  "customerId": "optional-customer-uuid",
  "customer": {
    "name": "Robertinho Contador",
    "phone": "11999999999",
    "cpfCnpj": "optional",
    "address": {
      "street": "Rua Exemplo, 100",
      "city": "Sao Paulo",
      "state": "SP",
      "zipCode": "01000-000",
      "country": "Brasil",
      "complement": null
    }
  },
  "vehicleId": "optional-vehicle-uuid",
  "vehicle": {
    "plate": null,
    "brand": "Honda",
    "model": "HR-V",
    "color": "Branco",
    "year": 2025
  },
  "serviceItems": [
    {
      "serviceId": "service-uuid",
      "isCourtesy": false
    }
  ],
  "paymentOptions": [
    {
      "method": "CARD",
      "label": "Cartao em ate 10x sem juros",
      "installments": 10,
      "interestFree": true,
      "discountType": null,
      "discountValue": null
    },
    {
      "method": "PIX",
      "label": "A vista no Pix",
      "installments": 1,
      "interestFree": true,
      "discountType": "PERCENTAGE",
      "discountValue": 10
    }
  ],
  "description": null,
  "termsAndConditions": "Orcamento valido por 10 dias.",
  "expiresAt": "2026-05-31T23:59:59.000Z"
}
```

Rules:

- `customerId` and `customer` can both be present, but `customerId` wins for snapshot data.
- When `customerId` is absent, `customer.name` is required.
- `vehicleId` and `vehicle` can both be present, but `vehicleId` wins for snapshot data.
- Providing `customer` or `vehicle` snapshot data never creates customer or vehicle records during quote creation.
- `serviceItems` must have at least one item.
- `paymentOptions` must have at least one item.

Register prospect request shape:

```json
{
  "email": "cliente@example.com",
  "phone": "11999999999",
  "birthDate": null,
  "nickname": null,
  "createVehicleFromQuote": false
}
```

Rules:

- This endpoint is optional and is called only when the establishment chooses to turn a prospect into a registered customer.
- The request must provide customer fields required by `Customer` that are missing from the quote snapshot.
- `createVehicleFromQuote` controls whether the quote vehicle snapshot should also create a `CustomerVehicle`.
- When `createVehicleFromQuote` is false, only the customer is created and linked to the quote.
- When `createVehicleFromQuote` is true and the quote has no vehicle snapshot, return `InvalidQuoteInputError`.
- Customer creation and vehicle creation must happen in the same unit of work when `createVehicleFromQuote` is true.

## Persistence And Migration

Prisma changes:

- Add `Quote`.
- Add `QuoteService`.
- Add `QuotePaymentOption`.
- Add relations from `Establishment` to `Quote`.
- Add optional relation from `Customer` to `Quote`.
- Add optional relation from `CustomerVehicle` to `Quote`.
- Add `Quote.convertedAppointmentId` as an optional quote-side foreign key to `Appointment`. The `Appointment` domain entity does not need a quote reference in the MVP.

Recommended `Quote` columns:

- `id`
- `establishmentId`
- `customerId`, nullable
- `vehicleId`, nullable
- `convertedAppointmentId`, nullable
- `convertedAt`, nullable
- establishment snapshot columns:
  - `establishmentName`
  - `establishmentLegalBusinessName`
  - `establishmentCnpj`
  - `establishmentAddress` JSON, nullable
  - `establishmentBannerImageUrl`, nullable
- customer snapshot columns:
  - `customerName`
  - `customerPhone`, nullable
  - `customerCpfCnpj`, nullable
  - `customerAddress` JSON, nullable
- vehicle snapshot columns:
  - `vehiclePlate`, nullable
  - `vehicleBrand`, nullable
  - `vehicleModel`, nullable
  - `vehicleColor`, nullable
  - `vehicleYear`, nullable
- `description`, nullable text
- `termsAndConditions`, nullable text
- `expiresAt`, nullable
- `createdAt`
- `updatedAt`

Recommended indexes:

- `Quote.establishmentId`
- `Quote.establishmentId, createdAt`
- `Quote.establishmentId, customerId`
- `Quote.establishmentId, vehicleId`
- `Quote.establishmentId, expiresAt`
- `Quote.establishmentId, convertedAppointmentId`
- `QuoteService.quoteId`
- `QuoteService.serviceId`
- `QuotePaymentOption.quoteId`

Recommended constraints:

- `QuoteService`: unique `quoteId, serviceId` in the MVP.
- `QuoteService`: cascade delete when quote is deleted.
- `QuotePaymentOption`: cascade delete when quote is deleted.
- `convertedAppointmentId`: unique when present to prevent multiple quotes pointing to the same appointment.

Snapshots should not be stored as one large JSON document. Keep filterable fields as columns and use JSON only for address shapes, following the existing `User.address` and `Customer.address` pattern.

## PDF Generation

PDF generation belongs in the backend, not the frontend.

Architecture:

- Add an application port `QuotePdfGenerator`.
- Add an infra implementation using a Node PDF library.
- `GenerateQuotePdfUseCase` passes a stable PDF view model to the generator.
- The PDF generator must not depend directly on Prisma records or HTTP DTOs.

Recommended library:

- Prefer `pdfkit` for the MVP because it can generate PDFs server-side without requiring browser rendering.
- If the design later needs complex component-like layout, evaluate `@react-pdf/renderer`.

PDF content:

- establishment banner when available;
- establishment name, CNPJ, and owner address;
- title "Orcamento";
- customer section;
- vehicle section when present;
- service table with courtesy rows;
- subtotal;
- payment options with calculated totals;
- description/notes when present;
- terms and validity when present.

The generated PDF must be deterministic enough for tests to verify content type and a valid PDF header. Visual regression is not required in the MVP.

## Error Handling

Use existing application error patterns:

- `ResourceNotFoundError` for missing establishment, owner user, quote, customer, vehicle, service, or appointment.
- `NotAllowedError` when the actor is not allowed to operate on the establishment scope.
- `InactiveServiceError` when a service exists but is inactive.
- `InvalidQuoteInputError` for invalid dates, duplicate services, empty services, empty payment options, invalid discount, invalid conversion, or missing prospect customer name.
- `ResourceAlreadyExistsError` when registering a prospect as customer conflicts with an existing active customer document.
- `UnexpectedDomainError` for unknown domain construction failures.

## Testing Strategy

Domain tests:

- creates a quote with defaults and normalized optional text;
- rejects empty services;
- rejects duplicate services;
- calculates subtotal excluding courtesy items;
- stores original service price for courtesy items;
- calculates Pix/cash percentage discount totals;
- calculates card installment options without discount;
- rejects invalid discount values;
- marks quote as converted once;
- rejects second conversion.

Use case tests:

- creates quote for existing customer;
- creates quote for prospect;
- does not create customer automatically for prospect quote;
- does not create vehicle automatically from quote vehicle snapshot;
- snapshots establishment owner address;
- rejects service from another establishment;
- rejects inactive/deleted service;
- rejects vehicle outside the selected customer;
- lists quotes by establishment scope;
- gets quote by id and establishment scope;
- registers prospect as customer with additional required customer fields when requested;
- registers prospect as customer without creating a vehicle when `createVehicleFromQuote` is false;
- registers prospect as customer and creates customer vehicle when `createVehicleFromQuote` is true;
- converts registered-customer quote to appointment;
- rejects conversion for prospect quote until customer registration;
- rejects conversion of already converted quote.

HTTP/e2e tests:

- `POST /quotes` returns quote with calculated totals;
- `GET /quotes` lists only scoped quotes;
- `GET /quotes/:quoteId` returns quote details;
- `GET /quotes/:quoteId/pdf` returns `application/pdf` and a body starting with `%PDF`;
- `POST /quotes/:quoteId/register-customer` creates customer, optionally creates vehicle, and links quote;
- `POST /quotes/:quoteId/convert-to-appointment` creates appointment and marks quote converted.

## Open Scope Boundaries

Out of scope for the MVP:

- quote status workflow;
- quote approval/rejection;
- quote sending by email or WhatsApp;
- customer signature;
- tax invoice or fiscal document behavior;
- state registration / `IE`;
- custom quote logo upload separate from `bannerImageUrl`;
- free-form services not present in the catalog;
- service quantities;
- editing a quote after creation;
- deleting quotes;
- quote templates.

Future-compatible additions:

- Add optional preferred scheduling fields such as `preferredStartAt` and `preferredEndAt`.
- Add quote status values once business workflow exists.
- Add specific quote branding fields if `bannerImageUrl` is not enough.
- Add service quantities if repeated services become necessary.
- Add employee feature gates for quote operations.
