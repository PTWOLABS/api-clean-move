# Dashboard Tables Design

## Goal

Support two dashboard tables in the frontend:

- Appointment history, using the existing `GET /appointments` endpoint.
- Top customers by completed visits, using a new dashboard metrics endpoint.

The appointment history table needs date/time, customer name, vehicle name, service name, status, and total value. The top customers table needs position, customer name, completed visits, and total spent.

## Decisions

Use `GET /appointments` for the appointment history table instead of creating a second history endpoint. The endpoint already scopes by establishment, supports appointment filters, returns customer, vehicle, services, status, and appointment timestamps, and is protected by the existing appointment read feature.

Do not persist a vehicle full-name column. The vehicle display name is derived from the appointment vehicle snapshot. This avoids duplicating data and keeps appointment history stable even if the vehicle record changes later.

Create one new endpoint for the aggregated customer ranking:

```txt
GET /dashboard/metrics/top-customers
```

This endpoint returns table-ready ranking data using only `DONE` appointments.

## Appointment History Changes

`GET /appointments` should continue returning the current appointment shape and add a derived vehicle display field under `vehicle`.

Response vehicle shape:

```ts
type AppointmentVehicleDTO = {
  plate: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
  displayName: string | null;
};
```

`displayName` is built by joining available `brand`, `model`, and `year` values with spaces.

Examples:

- `{ brand: "Honda", model: "Civic", year: 2011 }` -> `"Honda Civic 2011"`
- `{ brand: "Honda", model: null, year: 2011 }` -> `"Honda 2011"`
- all fields missing -> `null`

The existing `search` filter should also match this combined vehicle text so a query such as `Honda Civic 2011` finds the appointment even though brand, model, and year are stored separately. The search should remain case-insensitive and keep the current behavior for customer name, customer nickname, service name, vehicle brand, vehicle model, and normalized vehicle plate.

No database migration is needed.

## Top Customers Endpoint

Endpoint:

```txt
GET /dashboard/metrics/top-customers
```

Authentication and authorization:

- `ESTABLISHMENT` role only, matching the existing dashboard metrics endpoints.
- Resolve the authenticated establishment through the existing establishment scope used by dashboard use cases.

Query:

```ts
type TopCustomersQuery = {
  period?: "this-month" | "last-7-days" | "last-30-days";
  startsAt?: string;
  endsAt?: string;
  page?: number;
  size?: number;
};
```

Range behavior:

- Reuse the existing dashboard metrics range resolver.
- Default period is `this-month`.
- `startsAt` and `endsAt` follow the same validation rules as the existing dashboard metrics endpoints.

Pagination:

- `page` defaults to `1`.
- `size` defaults to `5`.
- Both must be positive integers.
- `position` is absolute across the filtered ranking, not only the current page. Page 2 with size 5 starts at position 6.

Status behavior:

- Always use only `DONE` appointments.
- The endpoint does not accept a status filter.

Response:

```ts
type DashboardTopCustomer = {
  position: number;
  customerId: string;
  customerName: string;
  completedAppointmentsCount: number;
  totalSpentInCents: number;
};

type DashboardTopCustomersResponse = {
  customers: DashboardTopCustomer[];
  totalCustomers: number;
};
```

`totalCustomers` is the total number of ranked customers before pagination.

## Ranking And Revenue Rules

Group appointments by `customerId` and customer snapshot name.

`completedAppointmentsCount` counts `DONE` appointments in the selected range.

`totalSpentInCents` uses the same net revenue rule already used by dashboard revenue metrics:

```ts
max(sum(appointment.services.priceInCents) - appointment.discountInCents, 0)
```

Sort order:

1. `completedAppointmentsCount` descending.
2. `totalSpentInCents` descending.
3. `customerName` ascending.
4. `customerId` ascending.

## Architecture

Add repository query support to `AppointmentsRepository` because the aggregation is appointment-derived and should stay close to the existing Prisma appointment query logic.

Add a focused use case in the establishment application area, following the dashboard metrics pattern:

```txt
src/modules/application/use-cases/establishment/get-establishment-top-customers.ts
```

The use case resolves the establishment, builds fixed appointment filters with `status: ["DONE"]`, delegates aggregation to the repository, and returns table rows.

Add a controller in the dashboard metrics route family:

```txt
src/infra/http/controllers/dashboard-metrics-top-customers.controller.ts
```

The controller validates query params, resolves the date range with the existing helper, calls the use case, and returns data through `DashboardMetricsPresenter`.

## Error Handling

Invalid query params return `400`.

Missing or invalid access tokens return `401`.

Non-establishment users return `403`.

An authenticated establishment user without an establishment profile returns `404`.

Unexpected persistence or domain failures return `500`, following the existing dashboard metrics controller behavior.

## Testing

Unit tests:

- vehicle display-name builder through the appointment presenter or a small helper if introduced;
- search by combined vehicle text such as `Honda Civic 2011`;
- top customers use case returns only `DONE` appointments;
- top customers use case sums net revenue after discounts;
- top customers use case applies tie-break sorting and absolute positions.

E2E tests:

- `GET /appointments?search=Honda Civic 2011` returns the matching appointment and includes `vehicle.displayName`;
- `GET /dashboard/metrics/top-customers` returns ranked customers for the authenticated establishment;
- ranking excludes `SCHEDULED` and `CANCELLED`;
- pagination returns absolute positions;
- another establishment's appointments are not exposed;
- invalid query params are rejected.

## Out Of Scope

- Persisting vehicle full name in the database.
- Creating a new appointment-history endpoint.
- Adding status filters to top customers.
- Adding customer ranking trend comparisons.
- Returning every appointment row needed by the history table from the new top customers endpoint.
