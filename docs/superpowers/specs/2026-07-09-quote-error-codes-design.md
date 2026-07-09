# Quote Error Codes Design

## Context

The quotes API returns English technical messages. Frontend code currently needs to match those messages to show Portuguese user feedback, which makes the integration brittle. This change introduces stable, machine-readable error codes only for quote HTTP endpoints.

## Scope

The following quote endpoints will adopt the contract:

- `POST /quotes`
- `GET /quotes`
- `GET /quotes/:quoteId`
- `GET /quotes/:quoteId/pdf`
- `POST /quotes/:quoteId/approve`
- `POST /quotes/:quoteId/register-customer`

It covers controller/use-case errors and request validation performed by the endpoint. Authentication and authorization failures emitted by global Nest guards, unknown routes, and all non-quote modules remain unchanged.

## Contract

Every handled error response from a quote endpoint includes `statusCode`, `code`, and `message`.

```json
{
  "statusCode": 400,
  "code": "QUOTE_ALREADY_CONVERTED",
  "message": "Quote is already converted."
}
```

`code` is the stable frontend contract. `message` remains technical and may stay in English; it must not be used for translation or conditional UI behavior.

Validation failures additionally return `errors`, preserving every invalid field:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "errors": [
    { "field": "customer.phone", "code": "INVALID_FORMAT" },
    { "field": "paymentOptions", "code": "MIN_ITEMS" }
  ]
}
```

`field` uses the request path syntax already exposed by the current Zod pipe (for example `serviceItems.0.priceInCents`). A validation response never requires the frontend to read Zod's `message`, `path`, or raw issue code.

## Validation Mapping

Quote validation gets an opt-in formatter rather than changing the shared `ZodValidationPipe` response used by other domains. The formatter maps Zod issue kinds to the following generic, reusable field codes:

| Zod condition | API field code |
| --- | --- |
| missing required value | `REQUIRED` |
| invalid primitive type | `INVALID_TYPE` |
| invalid string/UUID/email/date/enum format | `INVALID_FORMAT` |
| below a minimum or above a maximum | `OUT_OF_RANGE` |
| below an array/string minimum | `MIN_ITEMS` |
| above an array/string maximum | `MAX_ITEMS` |
| cross-field/custom schema rule | `INVALID_VALUE` |

The top-level code is always `VALIDATION_ERROR`. This avoids leaking Zod implementation terms such as `too_small` and `invalid_type` while avoiding a separate code for every structural validation rule.

## Business Error Mapping

Quote business rules receive specific codes where a frontend action or message differs. The quote HTTP error mapper is the sole HTTP translation boundary and maps shared errors using structured metadata rather than parsing `message`.

Initial codes include:

- `QUOTE_NOT_FOUND`
- `CUSTOMER_NOT_FOUND`
- `VEHICLE_NOT_FOUND`
- `SERVICE_NOT_FOUND`
- `ESTABLISHMENT_NOT_FOUND`
- `QUOTE_SERVICE_INACTIVE`
- `QUOTE_ALREADY_CONVERTED`
- `QUOTE_ALREADY_HAS_CUSTOMER`
- `QUOTE_CANNOT_BE_APPROVED_FOR_PROSPECT`
- `QUOTE_INVALID_SCHEDULE_INTERVAL`
- `QUOTE_VEHICLE_SNAPSHOT_MISSING`
- `QUOTE_VEHICLE_SNAPSHOT_INCOMPLETE`
- `QUOTE_CUSTOMER_ADDRESS_INCOMPLETE`
- `CUSTOMER_ALREADY_EXISTS`
- `FORBIDDEN`
- `INTERNAL_ERROR`

Other quote input/business failures that do not yet need different UI behavior use `INVALID_QUOTE_INPUT`. The implementation will add structured `code` data to quote-domain errors and resource identity to shared resource errors as needed, retaining their existing messages and HTTP statuses.

## Architecture

- Add quote-specific response and field-error types near the quote HTTP controllers.
- Add an opt-in quote validation pipe/formatter that returns the validation contract above. The shared Zod pipe stays backward compatible for every other domain.
- Extend quote-domain error construction with an optional stable code; existing callers can retain `INVALID_QUOTE_INPUT` until a distinct business rule code is assigned.
- Make the quote HTTP error mapper return object exception payloads for all quote controllers, including get/list controllers that currently map errors inline.
- Expose resource identity as structured error data where quote code mapping requires it; no mapping relies on English text.
- Document the error schemas and representative responses in Swagger for quote endpoints.

## Testing

- Unit-test validation issue conversion for required, format, size/range, and custom cross-field errors.
- Unit-test quote error mapping for every status class and representative business code.
- Extend quote e2e coverage to assert `code` for validation, not-found, inactive-service, conflict, and invalid quote-state responses.
- Assert a validation response has `errors` with `{ field, code }` and no frontend-facing dependency on English messages.

## Compatibility

This is an additive contract change for quote error responses: existing `statusCode` and technical messages remain. The former Zod `issues` field is replaced by `errors` only on quote endpoints; this is intentional because the new field has the normalized frontend contract. Consumers of quotes should migrate to `code` and `errors` rather than use `message` or `issues`.
