# Customer And Vehicle Options Design

## Goal

Add lightweight option endpoints for autocomplete/select inputs that need only an identifier and a display label.

Endpoints:

- `GET /customers/options?search=ana&limit=20`
- `GET /vehicles/options?search=gol&customerId=...&limit=20`

Both endpoints return only option items:

```ts
type Option = {
  id: string;
  label: string;
};
```

## Recommended Approach

Create dedicated application use cases and repository methods for options instead of reusing the full list endpoints.

This keeps the response contract small, avoids loading full domain entities when the caller only needs `id` and `label`, and leaves the existing paginated list endpoints unchanged.

## Authorization And Scope

Both endpoints are authenticated and available to:

- establishment owners with role `ESTABLISHMENT`;
- employees with role `EMPLOYEE`.

Employee access requires the existing `read:customers` feature because both endpoints expose customer-owned data.

The use cases resolve the establishment through `EstablishmentScopeService`. All queries are scoped to the resolved establishment and exclude soft-deleted records.

## Customer Options

Route: `GET /customers/options`

Query:

```ts
type CustomerOptionsQuery = {
  search?: string;
  limit?: number;
};
```

Rules:

- `search` is optional, trimmed, and searches by `fullName` or `nickname`.
- Search is case-insensitive.
- `limit` is optional, defaults to `20`, and must be a positive integer.
- Results are ordered by `fullName` ascending.
- Deleted customers are excluded.

Response:

```ts
type CustomerOptionsResponse = {
  customers: Array<{
    id: string;
    label: string; // customer fullName
  }>;
};
```

## Vehicle Options

Route: `GET /vehicles/options`

Query:

```ts
type VehicleOptionsQuery = {
  search?: string;
  customerId?: string;
  limit?: number;
};
```

Rules:

- `search` is optional, trimmed, and searches by `plate`, `model`, or `brand`.
- Search is case-insensitive for `model` and `brand`.
- Plate search also supports user input with punctuation by normalizing the search term to alphanumeric uppercase before matching.
- `customerId` is optional. When present, it must be a valid UUID for an active customer in the resolved establishment.
- `limit` is optional, defaults to `20`, and must be a positive integer.
- Results are ordered by `model` ascending, then `plate` ascending.
- Deleted vehicles are excluded.

Response:

```ts
type VehicleOptionsResponse = {
  vehicles: Array<{
    id: string;
    label: string; // vehicle model
  }>;
};
```

If a matching vehicle has no model, its label is returned as an empty string. This preserves the requested response shape without adding fallback fields.

## Error Handling

- Invalid query params return `400`.
- Missing or invalid authentication returns `401`.
- Authenticated users without one of the allowed roles return `403`.
- Employees without `read:customers` return `403`.
- Missing establishment scope returns `404`.
- A provided `customerId` that does not belong to the establishment, is missing, or is soft-deleted returns `404`.
- Unexpected persistence failures return `500`.

## Testing

Unit tests cover both use cases:

- establishment owner scope;
- employee scope through `EstablishmentScopeService`;
- search fields;
- optional `customerId` filtering for vehicles;
- deleted record exclusion;
- limit handling;
- missing establishment and invalid customer scope.

E2E tests cover both endpoints:

- response shape includes only `id` and `label`;
- owner and employee authentication work;
- customer-role users are forbidden;
- employee without `read:customers` is forbidden;
- search and limit query params work;
- vehicle `customerId` filter works;
- data from another establishment is not exposed.

No Prisma schema migration is required.
