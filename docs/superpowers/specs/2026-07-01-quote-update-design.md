# Quote Update Design

## Context

Quotes keep snapshots of establishment, customer, vehicle, services, and payment options. The update endpoint should let the frontend edit the quote through three steps:

1. Customer and vehicle
2. Services
3. Payment

The contract should stay simple because quotes carry many properties and computed values. The endpoint must avoid granular field operations inside complex nested data.

## Recommendation

Use `PATCH /quotes/:quoteId`.

The endpoint is partial at the top level: omitted top-level fields are preserved. Nested sections sent in the body are replaced as complete sections. This keeps the frontend free to save a single step while avoiding ambiguous partial merges inside customer, vehicle, services, or payment data.

`PUT` is not a good fit because the client should not replace the entire quote representation. Establishment data, approval/conversion data, status, totals, timestamps, and other computed/backend-controlled fields are not client-owned.

## Allowed Statuses

The endpoint may update only quotes that are still usable:

- `VALID`
- `EXPIRES_TODAY`

It must block:

- `EXPIRED`
- `APPROVED`

Status is derived from conversion and expiration data, not accepted from the request body.

## Request Shape

The body may include one or more of these fields:

```ts
{
  customerId?: string;
  customer?: {
    name: string;
    phone?: string | null;
    cpfCnpj?: string | null;
    address?: QuoteAddressSnapshot;
  };
  vehicleId?: string | null;
  vehicle?: {
    plate?: string | null;
    brand?: string | null;
    model?: string | null;
    color?: string | null;
    year?: number | null;
  } | null;
  serviceItems?: {
    serviceId: string;
    isCourtesy?: boolean;
  }[];
  paymentOptions?: QuotePaymentOptionInput[];
  description?: string | null;
  termsAndConditions?: string | null;
  expiresAt?: Date | null;
}
```

At least one top-level field must be provided.

## General Rules

- Establishment snapshot is not updated by this endpoint.
- Omitted top-level fields are preserved.
- Sent nested sections are treated as complete replacements for that section.
- Optional fields omitted inside a sent `customer` or `vehicle` object become `null`.
- `description`, `termsAndConditions`, and `expiresAt` can be changed directly.
- Domain value objects continue to own normalization and validation for quote service snapshots and payment options.

## Customer Rules

When the quote already has a real `customerId`:

- The request must not include `customer`.
- The request may include another `customerId` to switch the quote to another existing customer.
- The customer snapshot is rebuilt from the selected customer record.
- The request must not include `customerId: null`; a real customer quote cannot be converted back to prospect through this endpoint.
- If the current customer is missing or deleted, the quote update is blocked.

When the quote is a prospect (`customerId === null`):

- The request may include `customer` to replace the prospect snapshot.
- The request may include `customerId` to switch the quote to an existing customer.
- When `customerId` is provided, prospect snapshot data is not applied to the existing customer and is not merged. The quote sets `customerId` and replaces the customer snapshot with data from the selected customer record.
- The request must not include `customerId: null`; omit `customerId` to keep the quote as a prospect.
- The endpoint never creates a new customer.

## Vehicle Rules

When `vehicleId` is provided:

- It must belong to the effective real customer.
- It cannot be used while the quote remains a prospect.
- The vehicle snapshot is rebuilt from the selected vehicle record.

When `vehicleId: null` or `vehicle: null` is provided:

- Clear `vehicleId` and the vehicle snapshot from the quote.
- Do not delete any real vehicle record.

When `vehicle` is provided without `vehicleId`:

- If the effective quote customer is real, create a real vehicle for that customer, set `vehicleId`, and rebuild the snapshot from the created vehicle.
- If the quote remains a prospect, update only the quote vehicle snapshot.
- Optional fields omitted inside the sent `vehicle` object become `null`.

When the quote currently has a linked vehicle that is deleted, the vehicle section must be replaced before vehicle data can be considered valid again.

## Services Rules

`serviceItems` replaces the full service list.

For each sent service item:

- The service must exist in the authenticated establishment.
- Deleted services are rejected.
- Inactive services are rejected.
- Snapshot fields are rebuilt from the current service record.
- `isCourtesy` comes from the request and defaults to `false`.

If any current quote service is `UPDATED` or `DELETED`, the endpoint may still update unrelated sections. It must not allow an isolated `paymentOptions` update until `serviceItems` is also provided.

## Payment Rules

Payment totals are recalculated by the domain from the effective service subtotal.

If `serviceItems` is provided:

- Services are replaced first.
- If `paymentOptions` is also provided, use those options against the new subtotal.
- If `paymentOptions` is omitted, reuse the current payment option inputs against the new subtotal.

If only `paymentOptions` is provided:

- Recalculate the sent payment options against the current service subtotal.
- Reject the update if any current service is `UPDATED` or `DELETED`.

## Error Handling

Use existing application error patterns:

- `ResourceNotFoundError` for quote, customer, vehicle, or service records not found in the authenticated establishment.
- `NotAllowedError` for actor/scope failures.
- `InactiveServiceError` for inactive services.
- `InvalidQuoteInputError` for invalid quote update rules or invalid payload combinations.
- `UnexpectedDomainError` for unexpected domain failures.

HTTP mapping should follow the existing quote controller conventions.

## Testing Scope

Add focused domain/use case coverage for:

- Rejecting `APPROVED` and `EXPIRED` quotes.
- Allowing `VALID` and `EXPIRES_TODAY` quotes.
- Rejecting `customer` when the quote already has `customerId`.
- Replacing a prospect snapshot from `customer`.
- Switching a prospect to an existing `customerId` without applying prospect data to the customer record.
- Creating a real vehicle when a real customer receives a new `vehicle`.
- Updating only the vehicle snapshot for prospects.
- Replacing all services.
- Recalculating payment totals when services change.
- Rejecting isolated payment updates when current services are stale.

Add HTTP/e2e coverage for the main success path and the most important contract rejections.
