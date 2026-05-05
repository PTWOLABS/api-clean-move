# Register Employee Design

## Context

The application already supports establishment registration by creating a `User` and an `Establishment` in the same `UnitOfWork`. The employee registration flow should follow the same style: an authenticated establishment creates a user account with role `EMPLOYEE` and an `Employee` record scoped to that establishment.

The Prisma schema already contains `Employee` with:

- `establishmentId`
- `userId`
- `profileImageUrl`
- `name`
- `cpf`
- `birthDate`
- `features`
- `createdAt`
- `updatedAt`

This design covers the first employee creation use case and endpoint. It does not include employee update, delete, list, login authorization by feature, or profile image changes.

## Goals

- Add a coherent employee domain entity.
- Add a `BirthDate` value object with employee age rules.
- Add a static employee features policy.
- Add a register employee use case.
- Add employee repository abstractions and Prisma persistence.
- Add HTTP controller, presenter, and Swagger DTOs for employee creation.
- Keep `profileImageUrl` out of this request and endpoint.

## Non-Goals

- No database migration is planned because the employee table already exists.
- No employee profile image upload or update.
- No employee authorization guard based on `features`.
- No endpoint for listing, updating, or deleting employees.
- No invitation email or first-login password setup flow.

## Feature Policy

The request uses `extraFeatures`, not a final `features` list.

Default features are always present:

```ts
["read:appointments", "read:services", "read:customers"];
```

Allowed extra features are:

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
];
```

The domain should expose one shared type for valid employee features:

```ts
export type EmployeeFeature =
  | "read:appointments"
  | "read:services"
  | "read:customers"
  | "create:appointments"
  | "create:services"
  | "create:customers"
  | "update:appointments"
  | "update:services"
  | "update:customers"
  | "delete:appointments"
  | "delete:services"
  | "delete:customers";
```

The employee domain policy will:

- Add all default features automatically.
- Accept only allowed extra features.
- Reject any default feature sent as an extra feature.
- Reject unknown feature strings.
- Remove duplicate extra features.
- Preserve a stable output order: defaults first, then allowed extras in allowlist order.

## Birth Date Value Object

Create `src/modules/employees/domain/value-objects/birth-date.ts`.

`BirthDate.create(value, options?)` receives a `Date` and supports:

```ts
type BirthDateCreateOptions = {
  mustBeAdult?: boolean;
  referenceDate?: Date;
};
```

Rules:

- `mustBeAdult` defaults to `true`.
- `referenceDate` defaults to the current date.
- Dates before `1900-01-01` are invalid.
- Dates after the `referenceDate` calendar day are invalid.
- When `mustBeAdult` is `true`, the person must be at least 18 years old on the `referenceDate`.
- The value object exposes `value`, `toDate()`, `toString()`, and `equals()`.

The register employee endpoint will not expose `mustBeAdult`; it will use the default adult requirement. The option exists for future use cases that may legitimately allow minors.

## Domain Model

Create `src/modules/employees/domain/entities/employee.ts`.

Props:

```ts
export type EmployeeProps = {
  establishmentId: UniqueEntityId;
  userId: UniqueEntityId;
  profileImageUrl: string | null;
  name: string;
  cpf: Cpf | null;
  birthDate: BirthDate | null;
  features: EmployeeFeature[];
  createdAt: Date | null;
  updatedAt: Date | null;
};
```

Creation behavior:

- `name` is required and trimmed.
- Empty `name` throws `InvalidRegisterEmployeeInputError`.
- `cpf` is optional and normalized through the existing `Cpf` value object.
- `birthDate` is optional and represented by `BirthDate`.
- `features` are built through the employee features policy.
- `profileImageUrl` defaults to `null` and is not configurable by this use case.
- `createdAt` and `updatedAt` default to `new Date()`.

Domain methods:

- `changeName(name: string)`
- `changeCpf(cpf: Cpf | null)`
- `changeBirthDate(birthDate: BirthDate | null)`
- `replaceFeatures(extraFeatures: EmployeeFeature[])`
- `touch()`

The methods are useful for future update flows and keep entity behavior coherent without adding unrelated endpoint scope.

## Application Flow

Create `src/modules/application/use-cases/employee/register-employee.ts`.

Request shape:

```ts
type RegisterEmployeeUseCaseRequest = {
  establishmentOwnerId: string;
  name: string;
  email: string;
  password: string;
  cpf?: string | null;
  birthDate?: Date | null;
  extraFeatures?: string[];
};
```

Response shape:

```ts
type RegisterEmployeeUseCaseResponse = Either<
  | ResourceAlreadyExistsError
  | ResourceNotFoundError
  | InvalidRegisterEmployeeInputError
  | UnexpectedDomainError,
  { employee: Employee }
>;
```

Flow:

1. Find the establishment with `EstablishmentsRepository.findByOwnerId(establishmentOwnerId)`.
2. Return `ResourceNotFoundError({ resource: "Establishment" })` when the authenticated user does not own an establishment.
3. Validate `email` with the existing `Email` value object.
4. Validate optional `cpf` with the existing `Cpf` value object.
5. Validate optional `birthDate` with `BirthDate.create(birthDate)`.
6. Validate and compose `features` with the employee features policy.
7. Check `UsersRepository.findByEmail(email.toString())`.
8. Return `ResourceAlreadyExistsError("Employee already registered.")` if the email already exists.
9. Hash the password with `HashGenerator`.
10. Create `User` with role `EMPLOYEE`, using the request `name` as `User.name`.
11. Create `Employee` linked to the establishment and the user, using the same request `name` as `Employee.name`.
12. Persist both inside `UnitOfWork.execute`.
13. Return the created employee.

The use case catches known validation errors and wraps them in `InvalidRegisterEmployeeInputError`. Persistence and unique constraint failures follow the same pattern used in `RegisterEstablishmentUseCase`.

## Repositories

Create `src/modules/application/repositories/employees-repository.ts`.

Interface:

```ts
@Injectable()
export abstract class EmployeesRepository {
  abstract create(employee: Employee): Promise<void>;
  abstract findByUserId(userId: string): Promise<Employee | null>;
}
```

`findByUserId` supports mapper/repository tests and future authenticated employee profile lookups without broadening the first HTTP feature.

Add test repository:

- `tests/repositories/in-memory-employees-repository.ts`

Add factory:

- `tests/factories/employee-factory.ts`

## Prisma Infrastructure

Create mapper:

- `src/infra/database/prisma/mappers/prisma-employee-mapper.ts`

Mapper responsibilities:

- Convert Prisma `Employee` to domain `Employee`.
- Convert domain `Employee` to `Prisma.EmployeeUncheckedCreateInput`.
- Serialize `cpf` as normalized digits or `null`.
- Serialize `birthDate` as `Date | null`.
- Serialize `features` as `string[]`.
- Preserve `profileImageUrl` as `string | null`.

Create repository:

- `src/infra/database/prisma/repositories/prisma-employees-repository.ts`

Repository responsibilities:

- Use `PrismaUnitOfWork.getClient(this.prisma)`.
- Implement `create`.
- Implement `findByUserId`.
- Rethrow Prisma errors with `rethrowPrismaRepositoryError`.

Register the repository in `src/infra/database/database.module.ts`.

## HTTP Infrastructure

Create controller:

- `src/infra/http/controllers/register-employee.controller.ts`

Endpoint:

```http
POST /employees
Authorization: Bearer <access-token>
```

Role:

```ts
@Roles(["ESTABLISHMENT"])
```

Request body:

```json
{
  "name": "Ana Silva",
  "email": "ana@example.com",
  "password": "strong-password",
  "cpf": "52998224725",
  "birthDate": "1995-01-01T00:00:00.000Z",
  "extraFeatures": ["create:appointments", "update:customers"]
}
```

Required fields:

- `name`
- `email`
- `password`

Optional fields:

- `cpf`
- `birthDate`
- `extraFeatures`

Forbidden field:

- `profileImageUrl`

The Zod schema should be strict so `profileImageUrl` and other unknown keys are rejected with `400`.

Response body:

```json
{
  "employee": {
    "id": "uuid",
    "establishmentId": "uuid",
    "userId": "uuid",
    "profileImageUrl": null,
    "name": "Ana Silva",
    "cpf": "52998224725",
    "birthDate": "1995-01-01T00:00:00.000Z",
    "features": [
      "read:appointments",
      "read:services",
      "read:customers",
      "create:appointments",
      "update:customers"
    ],
    "createdAt": "2026-05-04T10:00:00.000Z",
    "updatedAt": "2026-05-04T10:00:00.000Z"
  }
}
```

Create presenter:

- `src/infra/http/presenters/employee-presenter.ts`

Add Swagger DTOs to:

- `src/infra/http/docs/domain-swagger.dto.ts`

Register controller and use case in:

- `src/infra/http/http.module.ts`

## Error Mapping

Use case errors:

- `ResourceNotFoundError` when no establishment exists for the authenticated owner.
- `ResourceAlreadyExistsError("Employee already registered.")` when email is already in use.
- `InvalidRegisterEmployeeInputError` for invalid email, empty name, invalid CPF, invalid birth date, invalid extra feature, or default feature submitted as extra.
- `UnexpectedDomainError` for unknown domain or persistence failures.

HTTP mapping:

- `InvalidRegisterEmployeeInputError` -> `400 Bad Request`
- Zod validation errors -> `400 Bad Request`
- `ResourceNotFoundError` -> `404 Not Found`
- `ResourceAlreadyExistsError` -> `409 Conflict`
- `UnexpectedDomainError` -> `500 Internal Server Error`

## Tests

Domain tests:

- `src/modules/employees/domain/value-objects/birth-date.spec.ts`
- `src/modules/employees/domain/policies/employee-features-policy.spec.ts`
- `src/modules/employees/domain/entities/employee.spec.ts`

Use case tests:

- `src/modules/application/use-cases/employee/register-employee.spec.ts`

E2E tests:

- `src/infra/http/controllers/register-employee.controller.e2e-spec.ts`

Required coverage:

- Creates employee with only required fields.
- Creates employee with optional `cpf`, `birthDate`, and `extraFeatures`.
- Hashes password and creates `User` with role `EMPLOYEE`.
- Links employee to the authenticated establishment.
- Rejects duplicate email.
- Rejects authenticated establishment user without establishment profile.
- Rejects unauthenticated, invalid token, expired token, and non-establishment role.
- Rejects invalid email, invalid CPF, invalid birth date before 1900, future birth date, minor birth date, invalid extra feature, and default feature sent as extra.
- Rejects `profileImageUrl` in the request body.
- Persists through Prisma with expected normalized values.

## Open Decisions Resolved

- Feature policy uses `extraFeatures` only.
- Default read features are always added by domain policy.
- `BirthDate` is a value object.
- Register employee requires adult birth date by default.
- `profileImageUrl` is represented in the entity/mapper/presenter but not accepted by the request.
