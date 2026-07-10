# Quote Snapshot Validation Design

## Context

Quote creation stores customer and vehicle snapshots that can later be used to register a prospect as a customer or approve the quote into an appointment. Today some snapshot fields are only trimmed or type-checked, so invalid values can be persisted and fail later in less predictable flows.

The goal is to keep quote creation lightweight for prospects while ensuring every provided snapshot value is semantically valid before it is persisted.

## Scope

This change covers quote creation snapshot validation for:

- Prospect customer data.
- Vehicle snapshot data.
- Detached quote service names.
- HTTP and use case test coverage for invalid snapshot data.

It does not change quote approval scheduling rules, pricing rules, payment option calculation, migrations, or existing customer/vehicle lookup behavior except for rejecting ambiguous payloads earlier.

## Contract

Quote creation should accept either existing resources or snapshots, but not both for the same concept.

- `customerId` may be provided without `customer`.
- `customer` may be provided without `customerId`.
- `customerId` and `customer` together are invalid.
- If `customer` is provided, `customer.name` is required after trimming.
- `vehicleId` requires `customerId`.
- `vehicle` may be omitted or `null`.
- `vehicleId` and `vehicle` together are invalid.
- If `vehicle` is provided as an object, `vehicle.brand` and `vehicle.model` are required after trimming.
- Optional snapshot fields may be absent or `null`, but if a non-empty value is provided it must be valid.

Semantic validation rules:

- `customer.phone` uses the existing `Phone` value object.
- `customer.cpfCnpj` uses the existing `CustomerDocument` value object.
- `customer.address`, when provided as an object, must be complete and use the existing `Address` value object.
- `vehicle.plate`, when provided, uses the same normalization and validation as `CustomerVehicle`.
- `vehicle.year`, when provided, must follow the current vehicle rule: integer greater than or equal to 1900.
- Detached service names continue to use `ServiceName`.

## Architecture

Use layered validation.

The HTTP controller keeps structural validation with Zod:

- Required object-level fields such as `customer.name` when `customer` exists.
- Required `vehicle.brand` and `vehicle.model` when `vehicle` exists as an object.
- Basic shape and primitive types.
- Ambiguous payload rules that can be expressed directly at the request boundary.

The `CreateQuoteUseCase` performs semantic validation and normalization before calling `Quote.create`:

- Convert valid phone/document/address values to normalized strings for snapshots.
- Convert empty optional strings to `null`.
- Wrap VO/domain validation errors as `InvalidQuoteInputError` with stable messages.
- Return `left(InvalidQuoteInputError)` instead of letting unexpected VO errors escape.

The `Quote` aggregate remains a final guard for valid internal state. It can keep simple required fields, duplicate service protection, date validation, and normalization. It should not be the only place that translates external input into snapshot-safe values.

## Error Handling

Invalid snapshot input should return HTTP 400 through `InvalidQuoteInputError`.

`CreateQuoteController` should use the shared `throwQuoteHttpError` helper to avoid duplicated error mapping and keep behavior aligned with other quote controllers.

Approval and prospect registration should remain defensive, but invalid quote snapshots should be rejected at creation rather than surfacing later during conversion or registration.

## Testing

Add focused unit tests in `CreateQuoteUseCase` for:

- Rejecting invalid prospect phone.
- Rejecting invalid CPF/CNPJ.
- Rejecting incomplete or invalid customer address.
- Rejecting `vehicle` without `brand`.
- Rejecting `vehicle` without `model`.
- Rejecting invalid vehicle plate.
- Rejecting invalid vehicle year.
- Accepting `customerId` without `customer`.
- Rejecting `customerId` with `customer`.
- Rejecting `vehicleId` with `vehicle`.

Add e2e coverage in `quote-controllers.e2e-spec.ts` for:

- Phone with one digit returns 400.
- Vehicle object without `brand` or `model` returns 400.
- Valid prospect quote with vehicle snapshot and detached service still returns 201.

## Compatibility

The intended frontend contract is:

- Send `customerId` for an existing customer, or send `customer` for a prospect.
- Do not send `customerId` and `customer` together.
- Send `vehicleId` for an existing customer vehicle, or send `vehicle` as a snapshot.
- Do not send `vehicleId` and `vehicle` together.
- If sending `vehicle`, include `brand` and `model`.
- Optional fields such as `phone`, `cpfCnpj`, `plate`, `year`, and `address` can be omitted/null, but must be valid when filled.
