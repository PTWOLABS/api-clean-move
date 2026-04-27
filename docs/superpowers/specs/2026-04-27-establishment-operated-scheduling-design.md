# Establishment-Operated Scheduling Design

## Context

The current scheduling model was designed for customers as application users: a customer account can book a service, the appointment reserves a time slot, and payment/checkout can move the appointment through payment-driven states. The new business model changes the ownership of the flow:

- Only an establishment can create and manage appointments.
- Customers are internal records owned by an establishment, not login users.
- Multiple appointments may exist at the same date/time.
- Payment and checkout must stay out of the new appointment flow.

There is no production data that needs to be preserved. Migrations can favor the new model directly instead of carrying complex backfill or compatibility logic.

## Recommended Approach

Remodel the active scheduling domain now, instead of keeping the old booking flow in parallel.

This is the best fit because the old model no longer represents the product rules. Keeping it active would leave ambiguous concepts such as customer-user versus establishment-customer, booking versus appointment management, and payment-driven appointment status versus manual operational status.

The payment module will remain in the codebase for future billing work, but it must be disconnected from the new appointment flow and removed from active providers/subscribers where it currently changes appointment state.

## Domain Model

### Customer

`Customer` becomes an internal customer record owned by an establishment.

Fields:

- `id`
- `establishmentId`
- `cpfCnpj`, optional
- `fullName`
- `phone`
- `email`
- `address`, optional JSON using the existing address shape
- `birthDate`, optional
- `nickname`, optional
- `deletedAt`, optional
- `createdAt`
- `updatedAt`

Rules:

- Customers are not users and cannot authenticate.
- `cpfCnpj` is unique only among active customers in the same establishment when provided.
- The same `cpfCnpj`, email, or phone may exist in another establishment.
- Deleting a customer is a soft delete by setting `deletedAt`.
- Active customer listings exclude soft-deleted customers by default.
- A deleted customer cannot be used in a new appointment.

### CustomerVehicle

Customers can have multiple vehicles. Vehicles are separate records, not a single JSON field on customer.

Fields:

- `id`
- `establishmentId`
- `customerId`
- `plate`, optional
- `brand`, optional
- `model`, optional
- `color`, optional
- `year`, optional
- `notes`, optional
- `deletedAt`, optional
- `createdAt`
- `updatedAt`

Rules:

- A vehicle belongs to one customer and one establishment.
- A vehicle must always belong to the same establishment as its customer.
- Deleting a vehicle is a soft delete.
- A deleted vehicle cannot be used in a new appointment.
- If `plate` is provided, it must be unique among active vehicles in the establishment to avoid duplicate vehicle ownership records.

### Appointment

`Appointment` becomes an operational scheduling record controlled by the establishment.

Fields:

- `id`
- `establishmentId`
- `customerId`
- `vehicleId`, optional
- `bookedServiceId`
- service snapshot fields:
  - `bookedServiceName`
  - `bookedServiceCategory`
  - `bookedServiceDurationInMinutes`
  - `bookedServicePriceInCents`
- vehicle snapshot fields, nullable:
  - `vehiclePlate`
  - `vehicleBrand`
  - `vehicleModel`
  - `vehicleColor`
  - `vehicleYear`
- `startsAt`
- `endsAt`, optional
- `description`, optional
- `discountInCents`, optional
- `status`
- `cancelledAt`, optional
- `doneAt`, optional
- `createdAt`
- `updatedAt`

Status values:

- `SCHEDULED`
- `DONE`
- `CANCELLED`

Rules:

- `startsAt` is required.
- `endsAt` is optional; when provided, it must be greater than `startsAt`.
- `serviceId` is required.
- `vehicleId` is optional.
- When `vehicleId` is provided, the vehicle must belong to the selected customer and the same establishment.
- Creating an appointment always starts with `SCHEDULED`.
- The establishment can manually set the status to any valid value: `SCHEDULED`, `DONE`, or `CANCELLED`.
- Setting status to `DONE` sets `doneAt` to the reference date and clears `cancelledAt`.
- Setting status to `CANCELLED` sets `cancelledAt` to the reference date and clears `doneAt`.
- Setting status back to `SCHEDULED` clears `doneAt` and `cancelledAt`.
- Multiple appointments can use the same `startsAt` or overlapping intervals.
- The system no longer checks time-slot conflicts.
- The system no longer creates appointments in `AWAITING_PAYMENT`.
- The system no longer uses `EXPIRED`, `IN_PROGRESS`, `reservationExpiresAt`, `confirmedAt`, or `expiredAt` in the active appointment model.
- Service snapshot fields remain to preserve appointment history when the service changes later.
- Vehicle snapshot fields must be stored when `vehicleId` is provided to preserve appointment history when the vehicle changes later.
- `discountInCents` is optional, integer, and cannot be negative.

## Application Use Cases

### Customers

- `CreateCustomerUseCase`: creates an internal customer for the authenticated establishment.
- `UpdateCustomerUseCase`: updates customer fields after validating establishment ownership.
- `DeleteCustomerUseCase`: soft-deletes a customer after validating establishment ownership.
- `ListCustomersUseCase`: lists active customers for the establishment, optionally searching by name, phone, email, or CPF/CNPJ.

### Vehicles

- `CreateCustomerVehicleUseCase`: creates a vehicle for one active customer.
- `UpdateCustomerVehicleUseCase`: updates vehicle fields after validating customer and establishment ownership.
- `DeleteCustomerVehicleUseCase`: soft-deletes a vehicle.
- `ListCustomerVehiclesUseCase`: lists active vehicles for a customer.

### Appointments

- `CreateAppointmentUseCase`: creates an appointment from `customerId`, `serviceId`, optional `vehicleId`, `startsAt`, optional `endsAt`, optional `description`, and optional `discountInCents`.
- `UpdateAppointmentStatusUseCase`: manually changes appointment status to `SCHEDULED`, `DONE`, or `CANCELLED`.
- `ListAppointmentsUseCase`: lists appointments for the establishment, with filters for status, customer, service, vehicle, and date interval.

All establishment-scoped use cases resolve `establishmentId` from the authenticated establishment owner. The request body must not accept arbitrary `establishmentId`.

## HTTP Contract

All new endpoints are protected by `@Roles(["ESTABLISHMENT"])`.

Customer endpoints:

- `POST /customers`
- `GET /customers`
- `PATCH /customers/:customerId`
- `DELETE /customers/:customerId`

Vehicle endpoints:

- `POST /customers/:customerId/vehicles`
- `GET /customers/:customerId/vehicles`
- `PATCH /customers/:customerId/vehicles/:vehicleId`
- `DELETE /customers/:customerId/vehicles/:vehicleId`

Appointment endpoints:

- `POST /appointments`
- `GET /appointments`
- `PATCH /appointments/:appointmentId/status`

The old public `POST /register/customer` endpoint will be removed from the active HTTP module because customers are no longer application users.

The current `POST /appointment` booking endpoint will be replaced by `POST /appointments` using the new contract. It will not accept `reservationExpiresAt`, will not calculate the end date from service duration, and will not reject overlapping appointments.

## Persistence And Migration

Prisma changes:

- Change `Customer` to reference `Establishment`, not `User`.
- Add `CustomerVehicle`.
- Change `AppointmentStatus` to `SCHEDULED`, `DONE`, `CANCELLED`.
- Make `Appointment.endsAt` nullable.
- Add appointment fields for `vehicleId`, vehicle snapshot, `description`, `discountInCents`, and `doneAt`.
- Remove appointment fields from the active model that only supported customer booking or payment reservation.
- Remove `FavoriteEstablishment` from the active schema for now.
- Remove active `Customer` relations to `User`, favorites, and payments.
- Remove active `Appointment` relations to `Payment` and `CheckoutRecovery`.
- Remove `Payment` and `CheckoutRecovery` models from the active Prisma schema for this phase.
- Enforce active-record uniqueness for customer `cpfCnpj` and vehicle `plate` with partial unique indexes where `deleted_at is null`.

Because there is no production data to preserve, the migration can be direct. If local development databases contain old rows, they can be reset or manually cleaned during the migration.

## Payment And Legacy Flow

Keep payment domain files that compile independently for future billing work, but disconnect them from active scheduling:

- Do not register payment subscribers that call `appointment.confirmPayment()` or `appointment.expirePayment()`.
- Do not wire checkout/payment use cases into active HTTP providers.
- Do not create `Payment` records during appointment creation.
- Do not keep `reservationExpiresAt` or payment status fields in the new appointment entity.

Old checkout use cases, payment subscribers, Prisma payment repositories, and checkout recovery repositories that depend on removed appointment APIs or removed Prisma models must be removed from active source compilation in this phase. The independent payment domain can be reintroduced into application and persistence layers when billing is redesigned.

## Impacted Areas

High-impact files and modules:

- `prisma/schema.prisma`
- Prisma migrations
- generated Prisma client
- `src/modules/customer/domain/entities/customer.ts`
- new customer vehicle domain entity
- customer repository contract and Prisma/in-memory implementations
- new vehicle repository contract and Prisma/in-memory implementations
- `src/modules/scheduling/domain/entities/appointment.ts`
- appointment mapper, presenter, repository contract, Prisma repository, and in-memory repository
- `src/modules/application/services/appointment-booking-service.ts`
- appointment use cases under `src/modules/application/use-cases/appointment`
- customer use cases under `src/modules/application/use-cases/customer`
- HTTP controllers and DTOs under `src/infra/http`
- `src/infra/http/http.module.ts`
- `src/infra/database/database.module.ts`
- tests/factories for customer, vehicle, and appointment
- e2e helpers that currently create customer users for booking
- establishment metrics that currently depend on `FINISHED`, payment, or the old customer model
- payment and checkout application files that no longer compile against the remodeled appointment entity
- favorite-establishment files that no longer compile after removing the active Prisma model

Removed or inactive flows:

- customer self-registration as an application user
- customer self-booking
- favorite establishments
- time-slot blocking
- payment-driven appointment status transitions
- checkout start/status/webhook flow from active HTTP

## Error Handling

Use existing application error patterns where possible:

- `ResourceNotFoundError` when customer, vehicle, service, establishment, or appointment is missing or outside the authenticated establishment scope.
- `ResourceAlreadyExistsError` when `cpfCnpj` or vehicle `plate` conflicts within the same establishment.
- `InvalidAppointmentInputError` for invalid dates, negative discount, invalid customer/vehicle pairing, or invalid status.
- `NotAllowedError` when the authenticated user does not own an establishment or tries to access records outside that establishment.

HTTP mappings:

- `400` for invalid payload or invalid appointment/customer/vehicle rules.
- `401` for missing or invalid authentication.
- `403` for authenticated users without the establishment role.
- `404` for scoped resources not found.
- `409` for uniqueness conflicts.
- `500` for unexpected persistence or domain failures.

## Testing Strategy

Domain tests:

- `Customer` creates internal customer records and supports soft delete.
- `CustomerVehicle` supports multiple vehicles per customer and soft delete.
- `Appointment` accepts `endsAt = null`.
- `Appointment` rejects `endsAt <= startsAt`.
- `Appointment` starts as `SCHEDULED`.
- `Appointment` changes status to `DONE`, `CANCELLED`, and back to `SCHEDULED`, updating `doneAt` and `cancelledAt` according to the status rules.
- `Appointment` accepts optional `vehicleId`.
- `Appointment` rejects negative `discountInCents`.

Use case tests:

- Creating a customer with duplicate CPF/CNPJ in the same establishment fails.
- Creating customers with the same CPF/CNPJ in different establishments succeeds.
- Updating and deleting customers validate establishment ownership.
- Creating a vehicle validates customer ownership.
- Creating a vehicle with duplicate plate in the same establishment fails.
- Creating an appointment with a deleted customer fails.
- Creating an appointment with a deleted vehicle fails.
- Creating an appointment with a vehicle from another customer fails.
- Creating two appointments at the same time succeeds.
- Updating appointment status accepts only `SCHEDULED`, `DONE`, and `CANCELLED`.

E2E tests:

- `POST /customers`
- `GET /customers`
- `PATCH /customers/:customerId`
- `DELETE /customers/:customerId`
- `POST /customers/:customerId/vehicles`
- `GET /customers/:customerId/vehicles`
- `PATCH /customers/:customerId/vehicles/:vehicleId`
- `DELETE /customers/:customerId/vehicles/:vehicleId`
- `POST /appointments` without `endsAt`
- `POST /appointments` with `vehicleId`
- `POST /appointments` twice at the same date/time returns `201` both times
- `GET /appointments` with basic filters
- `PATCH /appointments/:appointmentId/status`

## Out Of Scope For This Phase

- Customer login or customer-facing self-service scheduling.
- Quick appointment endpoint that creates customer inline.
- Payment collection for appointments.
- Payment webhooks changing appointment state.
- Favorite establishments.
- Multi-vehicle UI concerns.
- Production data migration/backfill.

## Open Decisions Resolved

- Migration strategy: direct remodel because there is no production data to preserve.
- Appointment service: service remains required.
- Customer uniqueness: CPF/CNPJ is unique among active customers in the same establishment only.
- Customer deletion: soft delete.
- Appointment end date: optional, but must be after start date when provided.
- Appointment status: `SCHEDULED`, `DONE`, `CANCELLED`.
- Discount: `discountInCents`.
- Vehicles: a customer can have many vehicles through `CustomerVehicle`.
- Appointment vehicle: optional `vehicleId`.
- Quick appointment with inline customer: out of the main flow for this phase.
- Payment module: keep for future billing, but disconnect from active scheduling.
- Favorite establishment and public customer registration: remove from active scope for now.
