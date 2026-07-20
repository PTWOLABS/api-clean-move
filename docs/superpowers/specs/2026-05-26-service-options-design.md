# Service Options Design

## Goal

Add a lightweight service option endpoint for autocomplete/select inputs that need an identifier, display label, and price information.

Endpoint:

- `GET /services/options?search=lavagem&page=1&size=20`

## Recommended Approach

Create a dedicated application use case and repository method for service options, following the existing customer and vehicle options pattern.

This keeps the response contract small, avoids loading full service response data when the caller only needs option fields, and leaves existing service list endpoints unchanged.

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
  page?: number;
  size?: number;
};
```

Rules:

- `search` is optional, trimmed, and searches only by `serviceName`.
- Search is case-insensitive.
- `page` is optional, defaults to `1`, and must be a positive integer.
- `size` is optional, defaults to `20`, and must be a positive integer.
- Results use `skip: (page - 1) * size` and `take: size`.
- Results include only active services: `isActive: true`.
- Deleted services are excluded.
- Results are ordered by `serviceName` ascending.
- `totalItems` is the filtered total (not the page length).

Response:

```ts
type ServiceOptionsResponse = {
  services: Array<{
    id: string;
    label: string; // serviceName
    priceInCents: number;
    priceSpecification:
      | { type: "FIXED"; fixedPriceInCents: number }
      | { type: "STARTING_AT"; minPriceInCents: number }
      | {
          type: "RANGE";
          minPriceInCents: number;
          maxPriceInCents: number;
        };
  }>;
  totalItems: number;
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
- page and size handling with stable `totalItems`;
- missing establishment.

E2E tests cover the endpoint:

- response shape includes option fields and `totalItems`;
- owner and employee authentication work;
- customer-role users are forbidden;
- employee without `read:services` is forbidden;
- search, page, and size query params work;
- inactive and deleted services are not returned;
- data from another establishment is not exposed.

No Prisma schema migration is required.
