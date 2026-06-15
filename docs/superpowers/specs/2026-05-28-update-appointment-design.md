# Update Appointment Flow Design

## Goal

Allow establishments and authorized employees to update appointment operational data after creation without changing the appointment status.

## Scope

Add a new partial update flow for appointments. The existing appointment status flow remains separate and continues to own status transitions.

The new flow updates these fields:

- `customerId`
- `serviceIds`
- `vehicleId`
- `startsAt`
- `endsAt`
- `description`
- `discountInCents`

Fields omitted from the request keep their current values. Optional fields sent as `null` are cleared:

- `vehicleId`
- `endsAt`
- `description`
- `discountInCents`

## API Contract

Expose `PATCH /appointments/:appointmentId`.

The route accepts a partial JSON body:

```json
{
  "customerId": "5f588c8b-ef0f-4193-aec0-2926e77c1d09",
  "serviceIds": ["11cf3860-d512-47db-b9d1-c9044be6250d"],
  "vehicleId": "d4051bc0-3f48-4700-8208-ec64d1031618",
  "startsAt": "2026-04-22T14:00:00.000Z",
  "endsAt": "2026-04-22T14:45:00.000Z",
  "description": "Cliente prefere lavagem externa.",
  "discountInCents": 500
}
```

The route returns the same appointment response shape used by create, list, and status update flows.

## Application Flow

Create `UpdateAppointmentUseCase`.

The use case resolves the authenticated actor through `EstablishmentScopeService`, loads the appointment by id and establishment id, then builds a new appointment state from the current values plus submitted fields.

Validation rules:

- The appointment must belong to the authenticated establishment.
- The selected customer must exist in the establishment and must not be deleted.
- If `customerId` is omitted, the current appointment customer is reused and revalidated.
- Every selected service must exist in the establishment, must not be deleted, and must be active.
- Duplicate services are rejected.
- If `serviceIds` is omitted, current service snapshots are reused.
- If `vehicleId` is a UUID, the vehicle must belong to the effective customer and establishment and must not be deleted.
- If `vehicleId` is omitted, the current vehicle snapshot is kept unless `customerId` changes.
- If `customerId` changes and `vehicleId` is omitted, the vehicle is cleared because the old vehicle belongs to the previous customer.
- If `vehicleId` is `null`, the vehicle and vehicle snapshot are cleared.
- `startsAt` and `endsAt` are validated by the domain. `endsAt`, when present, must be greater than `startsAt`.
- Empty or whitespace-only `description` is normalized to `null`.
- `discountInCents` must be a non-negative integer at the HTTP boundary. Domain errors are still returned as bad requests.

## Domain Model

Add an `update` method to `Appointment` that accepts the mutable appointment fields as value objects or snapshots. The method merges submitted fields, normalizes the description, validates the full state with existing appointment invariants, and touches `updatedAt`.

Status, `doneAt`, and `cancelledAt` are not modified by this method.

## Persistence

The existing `AppointmentsRepository.save` method and Prisma mapper already persist mutable appointment fields and replace booked service snapshots. No repository contract change is required.

## Authorization

Use the same role and employee feature requirements as the status update endpoint:

- Roles: `ESTABLISHMENT`, `EMPLOYEE`
- Employee feature: `update:appointments`

## Error Handling

Map errors consistently with the create and status flows:

- `NotAllowedError` to HTTP 403
- `ResourceNotFoundError` to HTTP 404
- `InactiveServiceError` and `InvalidAppointmentInputError` to HTTP 400
- Unexpected domain errors to HTTP 500

## Tests

Add unit coverage for:

- Updating all editable fields.
- Partial update preserving omitted fields.
- Clearing nullable fields with `null`.
- Changing customer while omitting vehicle clears the previous vehicle.
- Rejecting duplicate services.
- Rejecting deleted or inactive services.
- Rejecting missing or deleted customer.
- Rejecting vehicles from another customer.
- Rejecting appointments outside the establishment.
- Allowing employees scoped to the establishment.

Add HTTP e2e coverage for:

- Successful `PATCH /appointments/:appointmentId` update.
- Clearing nullable fields.
- Rejecting invalid ids and invalid payloads.
- Rejecting updates outside the establishment.
- Enforcing `update:appointments` for employees.
