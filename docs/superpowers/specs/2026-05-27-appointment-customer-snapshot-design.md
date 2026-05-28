# Appointment Customer Snapshot Design

## Context

Appointment responses currently expose `customerId`, service snapshots, and an optional vehicle snapshot. Service and vehicle data are persisted on the appointment so historical appointments keep the values that were true at booking time. Customer name is only available through the customer relation and is not returned in appointment list responses.

## Goal

Return a persisted customer snapshot in appointment responses for:

- `GET /appointments`
- `GET /appointments/calendar`

The response shape should include:

```json
{
  "customer": {
    "fullName": "Maria Silva"
  }
}
```

## Architecture

Add a customer snapshot to the `Appointment` aggregate with the shape `{ fullName: string }`. Persist it in the `appointments` table using a `customer_full_name` column. This keeps appointment history stable if the customer profile is renamed after the booking.

The `CreateAppointmentUseCase` will populate the snapshot from the resolved `Customer` entity. The Prisma appointment mapper will read and write the snapshot with the rest of the appointment fields. The HTTP presenter and DTO contracts will expose the snapshot as `appointment.customer.fullName`.

## Data Flow

1. Appointment creation resolves the active customer for the establishment.
2. The use case creates `Appointment` with `customer.fullName` copied into a snapshot.
3. The repository persists `customer_full_name`.
4. List queries load appointments as usual.
5. The presenter returns the persisted snapshot in both list endpoints.

## Migration

Create a Prisma migration that adds `customer_full_name` to `appointments`.

For existing rows, the migration should backfill from the current `customers.full_name` value before making the column required. This preserves compatibility with already-created appointments while keeping the domain snapshot non-null going forward.

## API Contract

`AppointmentItemDTO` and Swagger `AppointmentDto` gain:

```ts
customer: {
  fullName: string;
};
```

No query parameters or endpoint paths change. Existing fields remain in place.

## Error Handling

Appointment creation already fails when the customer does not exist or is deleted. No new error path is needed. The snapshot is required in the domain, so invalid or missing persisted data should fail during mapping rather than silently returning an incomplete response.

## Testing

Update focused domain/use-case tests for appointment creation or factory expectations where needed. Update e2e response schemas and assertions for `GET /appointments` and `GET /appointments/calendar` to verify `customer.fullName` is returned from the persisted snapshot.
