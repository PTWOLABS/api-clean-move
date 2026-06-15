# Service Options Design

## Goal

Add a lightweight service option endpoint for autocomplete/select inputs that need only an identifier and a display label.

Endpoint:

- `GET /services/options?search=lavagem&limit=20`

The endpoint returns only option items:

```ts
type Option = {
  id: string;
  label: string;
};
```

## Recommended Approach

Create a dedicated application use case and repository method for service options, following the existing customer and vehicle options pattern.

This keeps the response contract small, avoids loading full service response data when the caller only needs `id` and `label`, and leaves existing service list endpoints unchanged.

## Authorization And Scope

The endpoint is authenticated and available to:

- establishment owners with role `ESTABLISHMENT`;
- employees with role `EMPLOYEE`.

Employee access requires the existing `read:services` feature because the endpoint exposes service catalog data.

The use case resolves the establishment through `EstablishmentScopeService`. The query is scoped to the resolved establishment and excludes soft-deleted services.

## Service Options

Route: `GET /services/options`

Query:

```ts
type ServiceOptionsQuery = {
  search?: string;
  limit?: number;
};
```

Rules:

- `search` is optional, trimmed, and searches only by `serviceName`.
- Search is case-insensitive.
- `limit` is optional, defaults to `20`, and must be a positive integer.
- Results include only active services: `isActive: true`.
- Deleted services are excluded.
- Results are ordered by `serviceName` ascending.

Response:

```ts
type ServiceOptionsResponse = {
  services: Array<{
    id: string;
    label: string; // serviceName
  }>;
};
```

## Error Handling

- Invalid query params return `400`.
- Missing or invalid authentication returns `401`.
- Authenticated users without one of the allowed roles return `403`.
- Employees without `read:services` return `403`.
- Missing establishment scope returns `404`.
- Unexpected persistence failures return `500`.

## Testing

Unit tests cover the use case:

- establishment owner scope;
- employee scope through `EstablishmentScopeService`;
- search by service name only;
- active-service filtering;
- deleted-service exclusion;
- limit handling;
- missing establishment.

E2E tests cover the endpoint:

- response shape includes only `id` and `label`;
- owner and employee authentication work;
- customer-role users are forbidden;
- employee without `read:services` is forbidden;
- search and limit query params work;
- inactive and deleted services are not returned;
- data from another establishment is not exposed.

No Prisma schema migration is required.
