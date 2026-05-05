# Manage Employees Design

## Context

The application already supports employee registration through a domain-first flow. An authenticated establishment creates a `User` with role `EMPLOYEE` and an `Employee` record scoped to its establishment. The current employee domain includes identity, establishment ownership, optional CPF and birth date, profile image URL, and feature policy support.

This design adds the next employee management capabilities:

- Update employee data.
- Soft delete employees.
- Get one employee by id.
- List employees with a name filter.
- Enforce employee self-access through feature-based authorization.
- Block deleted employees from sessions by removing system-managed session features.

## Goals

- Add `deletedAt` to the `Employee` domain and Prisma model.
- Add soft-delete behavior that records the deletion date.
- Add system-managed employee session features.
- Add a feature decorator and guard for endpoints that allow `EMPLOYEE` actors.
- Add login, refresh, and access-session checks for employee session features.
- Add use cases and HTTP endpoints for update, delete, get by id, and list employees.
- Keep employee features coherent: establishments may update business permissions, but session features stay controlled by the system.

## Non-Goals

- No hard delete of employees or users.
- No `User.email = null` or `User.hashedPassword = null`.
- No general `User.disabledAt` account status in this scope.
- No employee profile image update.
- No CPF update in this stage.
- No pagination requirement for employee list unless the implementation follows an existing repository default pattern.
- No domain events are required because all side effects are synchronous repository updates and authorization checks.

## Feature Policy

Employee features remain string literals grouped by policy.

Default active employee features:

```ts
[
  "read:appointments",
  "read:services",
  "read:customers",
  "read:employees:self",
  "create:sessions:self",
  "read:sessions:self",
];
```

Allowed extra features:

```ts
[
  "create:appointments",
  "create:services",
  "create:customers",
  "update:appointments",
  "update:services",
  "update:customers",
  "delete:appointments",
  "delete:services",
  "delete:customers",
  "update:employees:self",
];
```

System-managed features:

```ts
["create:sessions:self", "read:sessions:self"];
```

Rules:

- `read:employees:self` is a default feature and cannot be sent as an extra feature.
- `update:employees:self` is an allowed extra feature and can be granted or removed by the establishment.
- `create:sessions:self` and `read:sessions:self` are added by default for active employees.
- Session features cannot be sent in create or update payloads.
- No update endpoint may add or remove session features directly.
- Soft delete removes session features through domain behavior.
- Persisted feature normalization accepts valid final features, including active records that contain session features and deleted records where they are absent.
- Output order remains stable: defaults first, then allowed extras in allowlist order. Deleted employees preserve non-session features and omit the session features.

## Domain Model

`EmployeeProps` gains:

```ts
deletedAt: Date | null;
```

`Employee.create` defaults `deletedAt` to `null`.

`Employee.restore` normalizes persisted features and preserves `deletedAt`.

Domain methods:

- `update(data: { name?: string; birthDate?: BirthDate | Date | null; extraFeatures?: string[] })`
- `changeName(name: string)`
- `changeBirthDate(birthDate: BirthDate | null)`
- `replaceFeatures(extraFeatures: string[])`
- `softDelete(referenceDate?: Date)`
- `isDeleted()`
- `touch(referenceDate?: Date)`

Update rules:

- `name` is trimmed and cannot be empty.
- `birthDate` keeps the existing `BirthDate` validation.
- `features` can be replaced from allowed extra features only.
- Updating a deleted employee throws a domain error.

Delete rules:

- Soft delete sets `deletedAt`.
- Soft delete removes `create:sessions:self` and `read:sessions:self`.
- Soft delete preserves non-session features for audit and historical visibility.
- Soft deleting an already deleted employee throws a domain error.

Domain events are not needed for this stage. The important side effect, session blocking, is represented directly in employee features and enforced synchronously by authentication and authorization flows.

## Authorization Design

Add an employee feature decorator:

```ts
@EmployeeFeatures(["read:employees:self"])
```

Behavior:

- The decorator receives an array of employee features.
- The feature guard runs after the access-session guard and role guard.
- If the authenticated role is not `EMPLOYEE`, the guard allows the request without checking employee features.
- If the authenticated role is `EMPLOYEE`, the guard finds the employee by `userId`.
- If the employee does not exist, is soft-deleted, or lacks any required feature, the guard returns `403`.
- Required features use an all-of check.

Session-level checks:

- `LoginWithCredentialsUseCase` requires `create:sessions:self` for `EMPLOYEE` users before creating a session.
- `RefreshSessionUseCase` requires `read:sessions:self` for `EMPLOYEE` users before rotating the refresh token.
- `AccessSessionGuard` requires `read:sessions:self` for `EMPLOYEE` users on every authenticated request.
- Non-employee roles are not affected by employee feature checks.

This means deleting an employee blocks future login, refresh, and access-token use without changing user email or password fields.

## Application Use Cases

### Update Employee

Request shape:

```ts
type UpdateEmployeeActor = {
  userId: string;
  role: UserRole;
};

type UpdateEmployeeUseCaseRequest = {
  actor: UpdateEmployeeActor;
  employeeId: string;
  name?: string;
  birthDate?: Date | null;
  extraFeatures?: string[];
};
```

Rules:

- Establishment actors find their establishment by owner id.
- Establishment actors may update employees belonging to that establishment.
- Establishment actors may update `name`, `birthDate`, and `features`.
- Employee actors resolve their own employee record by `actor.userId`.
- Employee actors may update only themselves.
- Employee actors may update only `name` and `birthDate`.
- Employee actors cannot send `extraFeatures`; if sent, return a validation error.
- Employee actors must have `update:employees:self`; the controller guard enforces this for HTTP, and the use case also checks the resolved employee features so the rule holds outside HTTP.
- Deleted employees are treated as not found.

### Delete Employee

Request shape:

```ts
type DeleteEmployeeUseCaseRequest = {
  establishmentOwnerId: string;
  employeeId: string;
};
```

Rules:

- Only establishment actors can call this endpoint.
- The establishment is resolved by owner id.
- The target employee must belong to that establishment.
- Deleted employees are treated as not found.
- The use case calls `employee.softDelete(referenceDate)` and saves it.
- The delete endpoint returns `204`.
- Existing sessions do not need explicit revocation because the next request or refresh fails when the employee no longer has `read:sessions:self`.

### Get Employee By Id

Request shape:

```ts
type GetEmployeeActor = {
  userId: string;
  role: UserRole;
};

type GetEmployeeUseCaseRequest = {
  actor: GetEmployeeActor;
  employeeId: string;
};
```

Rules:

- Establishment actors may get active employees belonging to their establishment.
- Employee actors may get only their own active employee record.
- Employee actors must have `read:employees:self`.
- Deleted employees are treated as not found.

### List Employees

Request shape:

```ts
type ListEmployeesUseCaseRequest = {
  establishmentOwnerId: string;
  name?: string;
};
```

Rules:

- Only establishment actors can list employees.
- The establishment is resolved by owner id.
- Only active employees are returned.
- Optional `name` filter matches employee names case-insensitively.
- Results should use a deterministic order, preferably `createdAt asc` to match customer listing patterns.

## Repository Contract

Extend `EmployeesRepository`:

```ts
type EmployeeFilters = {
  name?: string;
  includeDeleted?: boolean;
};

abstract create(employee: Employee): Promise<void>;
abstract findById(id: string): Promise<Employee | null>;
abstract findByUserId(userId: string): Promise<Employee | null>;
abstract findByIdAndEstablishmentId(
  id: string,
  establishmentId: string,
): Promise<Employee | null>;
abstract findManyByEstablishmentId(
  establishmentId: string,
  filters?: EmployeeFilters,
): Promise<Employee[]>;
abstract save(employee: Employee): Promise<void>;
```

Repository methods may return deleted employees when fetching by id. Use cases decide whether a deleted employee should be hidden. List methods exclude deleted employees by default.

## Prisma Infrastructure

Add a migration for:

```prisma
model Employee {
  deletedAt DateTime? @map("deleted_at")

  @@index([establishmentId, deletedAt])
}
```

Update generated Prisma client after the schema change.

Mapper changes:

- `toDomain` maps `deletedAt`.
- `toPrisma` includes `deletedAt`.
- Add `toPrismaUpdate` for `name`, `birthDate`, `features`, `deletedAt`, and `updatedAt`.

Repository changes:

- Implement `findById`.
- Implement `findByIdAndEstablishmentId`.
- Implement `findManyByEstablishmentId` with optional name filter and deleted filtering.
- Implement `save`.

## HTTP Endpoints

### `GET /employees/:employeeId`

Decorators:

```ts
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["read:employees:self"])
```

Responses:

- `200` with `{ employee }`.
- `400` for invalid UUID.
- `401` for invalid session.
- `403` for missing employee feature.
- `404` when not found or not allowed by ownership.

### `PATCH /employees/:employeeId`

Decorators:

```ts
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["update:employees:self"])
```

Payload:

```ts
{
  name?: string;
  birthDate?: string | null;
  extraFeatures?: string[];
}
```

Rules:

- At least one field must be present.
- Establishments may send `extraFeatures`.
- Employees may not send `extraFeatures`.
- `extraFeatures` cannot contain defaults or system-managed session features.

Responses:

- `200` with `{ employee }`.
- `400` for invalid payload, invalid birth date, invalid feature, or employee sending `extraFeatures`.
- `401` for invalid session.
- `403` for missing employee feature.
- `404` when not found or not allowed by ownership.

### `DELETE /employees/:employeeId`

Decorators:

```ts
@Roles(["ESTABLISHMENT"])
```

Responses:

- `204` when deleted.
- `400` for invalid UUID.
- `401` for invalid session.
- `403` for non-establishment roles.
- `404` when not found or not owned by the establishment.

### `GET /employees`

Decorators:

```ts
@Roles(["ESTABLISHMENT"])
```

Query:

```ts
{
  name?: string;
}
```

Responses:

- `200` with `{ employees }`.
- `401` for invalid session.
- `403` for non-establishment roles.
- `404` when the authenticated establishment user has no establishment profile.

## Presenter And Swagger

`EmployeePresenter.toHTTP` adds:

```ts
deletedAt: employee.deletedAt?.toISOString() ?? null;
```

Swagger DTOs:

- Add `deletedAt` to `EmployeeDto`.
- Add `UpdateEmployeeBodyDto`.
- Add `EmployeeResponseDto` if the current response type is only named for registration.
- Add `ListEmployeesResponseDto`.
- Document session features as internal/system-managed and not accepted in request bodies.

## Testing Strategy

Domain tests:

- Default employee features include `read:employees:self`, `create:sessions:self`, and `read:sessions:self`.
- Feature policy rejects session features when sent as extra features.
- `Employee.softDelete()` sets `deletedAt` and removes session features.
- `Employee.softDelete()` preserves non-session features.
- Updating a deleted employee throws a domain error.
- `Employee.update()` updates `name`, `birthDate`, and allowed extra features.

Use case tests:

- Establishment updates employee fields and features.
- Employee self-updates `name` and `birthDate`.
- Employee self-update rejects `extraFeatures`.
- Employee cannot update another employee.
- Establishment cannot update employee from another establishment.
- Delete soft-deletes only employees owned by the establishment.
- Get by id works for establishment and self employee.
- List returns only active employees and filters by name.
- Deleted employees are treated as not found in update/get/delete/list.

Auth and guard tests:

- Employee login requires `create:sessions:self`.
- Employee refresh requires `read:sessions:self`.
- Employee authenticated requests require `read:sessions:self`.
- `@EmployeeFeatures` allows non-employee roles.
- `@EmployeeFeatures` rejects employee actors without the required feature.

E2E tests:

- `GET /employees/:employeeId` for establishment and self employee.
- `PATCH /employees/:employeeId` for establishment and self employee.
- `PATCH /employees/:employeeId` rejects employee-provided `extraFeatures`.
- `DELETE /employees/:employeeId` soft deletes and blocks subsequent employee requests.
- `GET /employees` lists active employees and filters by name.
- Role and feature failures return the expected HTTP statuses.

## Migration And Compatibility

Existing employees will have `deletedAt = null` after the migration.

Existing employees may not have the newly introduced default features in their persisted array. The implementation should include a backfill migration or application-level normalization plan so existing active employee rows receive:

```ts
["read:employees:self", "create:sessions:self", "read:sessions:self"]
```

The preferred approach is to update existing employee rows in the migration because session authorization depends on persisted features.

## Open Decisions Resolved

- Use plural feature names: `read:employees:self` and `update:employees:self`.
- Employees cannot update their own `features`.
- Session features are system-managed and not exposed to create/update payloads.
- Soft delete records `deletedAt` and removes session features.
- Existing employee access is blocked through login, refresh, and access-session checks rather than nulling user fields.
- Add a feature decorator and guard for employee-only feature checks.
