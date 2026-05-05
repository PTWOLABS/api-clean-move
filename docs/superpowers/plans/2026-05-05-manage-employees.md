# Manage Employees Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add update, soft delete, get-by-id, list-by-name, and employee feature authorization for employees.

**Architecture:** Extend the existing employee aggregate and feature policy first, then carry the contract through repositories, Prisma, authentication, application use cases, and HTTP controllers. Employee deletion remains a soft delete with `deletedAt`, while session blocking is controlled by removing system-managed employee session features and checking those features during login, refresh, and authenticated requests.

**Tech Stack:** Node.js 22, TypeScript, NestJS, Prisma 7, PostgreSQL, Zod, Vitest, Supertest.

---

## Scope Check

This is one implementation plan because the feature changes share one aggregate and one authorization model: `Employee`. The work includes a Prisma migration, domain behavior, repository methods, auth guard support, four use cases, HTTP controllers, and tests. It does not add profile image updates, CPF updates, hard deletes, nullable user emails/passwords, or a generic `User.disabledAt`.

## File Structure

Create:

- `src/modules/employees/domain/errors/employee-already-deleted-error.ts`: domain error thrown when mutating or deleting an already deleted employee.
- `src/modules/application/services/employee-session-access.ts`: shared service for employee session feature checks used by login, refresh, and access-session guard.
- `src/infra/auth/employee-features.ts`: metadata decorator for employee feature requirements.
- `src/infra/auth/employee-features.guard.ts`: Nest guard that enforces `@EmployeeFeatures` only for `EMPLOYEE` actors.
- `src/modules/application/use-cases/employee/update-employee.ts`: update employee use case.
- `src/modules/application/use-cases/employee/update-employee.spec.ts`: update use case tests.
- `src/modules/application/use-cases/employee/delete-employee.ts`: soft-delete employee use case.
- `src/modules/application/use-cases/employee/delete-employee.spec.ts`: delete use case tests.
- `src/modules/application/use-cases/employee/get-employee.ts`: get employee by id use case.
- `src/modules/application/use-cases/employee/get-employee.spec.ts`: get use case tests.
- `src/modules/application/use-cases/employee/list-employees.ts`: list employees use case.
- `src/modules/application/use-cases/employee/list-employees.spec.ts`: list use case tests.
- `src/infra/http/controllers/update-employee.controller.ts`: `PATCH /employees/:employeeId`.
- `src/infra/http/controllers/delete-employee.controller.ts`: `DELETE /employees/:employeeId`.
- `src/infra/http/controllers/get-employee.controller.ts`: `GET /employees/:employeeId`.
- `src/infra/http/controllers/list-employees.controller.ts`: `GET /employees`.
- `src/infra/http/controllers/manage-employees.controller.e2e-spec.ts`: e2e coverage for the new endpoints and access blocking.
- `prisma/migrations/20260505120000_manage_employees/migration.sql`: `deleted_at` column, index, and default feature backfill.

Modify:

- `prisma/schema.prisma`: add `Employee.deletedAt` and index.
- `src/generated/prisma/**`: regenerate after schema migration.
- `src/modules/employees/domain/policies/employee-features-policy.ts`: add employee self and session features.
- `src/modules/employees/domain/policies/employee-features-policy.spec.ts`: cover new feature policy rules.
- `src/modules/employees/domain/entities/employee.ts`: add `deletedAt`, update, and soft-delete behavior.
- `src/modules/employees/domain/entities/employee.spec.ts`: cover deleted/update behavior.
- `src/modules/application/repositories/employees-repository.ts`: add query/save methods and filters.
- `tests/repositories/in-memory-employees-repository.ts`: implement the new repository contract.
- `tests/factories/employee-factory.ts`: support `deletedAt` through `EmployeeCreateProps`.
- `src/infra/database/prisma/mappers/prisma-employee-mapper.ts`: map `deletedAt` and add update mapper.
- `src/infra/database/prisma/repositories/prisma-employees-repository.ts`: implement query/save methods.
- `src/modules/application/use-cases/auth/login-with-credentials.ts`: require employee `create:sessions:self`.
- `src/modules/application/use-cases/auth/login-with-credentials.spec.ts`: add employee session feature tests.
- `src/modules/application/use-cases/auth/refresh-session.ts`: require employee `read:sessions:self`.
- `src/modules/application/use-cases/auth/refresh-session.spec.ts`: add employee session feature tests.
- `src/infra/auth/access-session.guard.ts`: require employee `read:sessions:self` on every authenticated request.
- `src/infra/auth/auth.module.ts`: register `EmployeeFeaturesGuard` and `EmployeeSessionAccessService`.
- `src/infra/http/presenters/employee-presenter.ts`: expose `deletedAt`.
- `src/infra/http/docs/domain-swagger.dto.ts`: add update/list DTOs and `deletedAt`.
- `src/infra/http/http.module.ts`: register new use cases and controllers.
- `src/infra/http/controllers/register-employee.controller.e2e-spec.ts`: include new default features in response schema/expectations.
- `src/modules/application/use-cases/employee/register-employee.spec.ts`: include new default features in expectations.

## Task 1: Employee Feature Policy

**Files:**

- Modify: `src/modules/employees/domain/policies/employee-features-policy.spec.ts`
- Modify: `src/modules/employees/domain/policies/employee-features-policy.ts`
- Test: `src/modules/employees/domain/policies/employee-features-policy.spec.ts`

- [ ] **Step 1: Replace the feature policy tests with the failing spec**

Replace `src/modules/employees/domain/policies/employee-features-policy.spec.ts` with:

```ts
import {
  DEFAULT_EMPLOYEE_FEATURES,
  EmployeeFeaturesPolicy,
  InvalidEmployeeFeatureError,
  SYSTEM_MANAGED_EMPLOYEE_FEATURES,
} from "./employee-features-policy";

describe("EmployeeFeaturesPolicy", () => {
  it("should return active default features when no extra feature is provided", () => {
    const features = EmployeeFeaturesPolicy.build();

    expect(features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
    ]);
    expect(features).toEqual(DEFAULT_EMPLOYEE_FEATURES);
  });

  it("should add allowed extra features after defaults", () => {
    const features = EmployeeFeaturesPolicy.build([
      "update:customers",
      "create:appointments",
      "update:employees:self",
    ]);

    expect(features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
      "create:appointments",
      "update:customers",
      "update:employees:self",
    ]);
  });

  it("should remove duplicated extra features", () => {
    const features = EmployeeFeaturesPolicy.build([
      "create:appointments",
      "create:appointments",
      "delete:services",
    ]);

    expect(features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
      "create:appointments",
      "delete:services",
    ]);
  });

  it.each([
    "read:appointments",
    "read:employees:self",
    "create:sessions:self",
    "read:sessions:self",
  ])("should reject default or system-managed feature %s sent as extra", (feature) => {
    expect(() => EmployeeFeaturesPolicy.build([feature])).toThrow(
      InvalidEmployeeFeatureError,
    );
  });

  it("should reject unknown features", () => {
    expect(() => EmployeeFeaturesPolicy.build(["approve:payments"])).toThrow(
      InvalidEmployeeFeatureError,
    );
  });

  it("should validate and normalize persisted final employee features", () => {
    const features = EmployeeFeaturesPolicy.normalizePersisted([
      "create:services",
      "read:sessions:self",
      "read:customers",
      "read:appointments",
      "create:sessions:self",
      "read:services",
      "read:employees:self",
      "create:services",
    ]);

    expect(features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
      "create:services",
    ]);
  });

  it("should remove system-managed session features", () => {
    const features = EmployeeFeaturesPolicy.withoutSystemManagedFeatures([
      "read:appointments",
      "create:sessions:self",
      "read:sessions:self",
      "update:employees:self",
    ]);

    expect(SYSTEM_MANAGED_EMPLOYEE_FEATURES).toEqual([
      "create:sessions:self",
      "read:sessions:self",
    ]);
    expect(features).toEqual(["read:appointments", "update:employees:self"]);
  });

  it("should check if all required features are present", () => {
    expect(
      EmployeeFeaturesPolicy.hasAll(
        ["read:employees:self", "update:employees:self"],
        ["read:employees:self"],
      ),
    ).toBe(true);
    expect(
      EmployeeFeaturesPolicy.hasAll(
        ["read:employees:self"],
        ["read:employees:self", "update:employees:self"],
      ),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the feature policy tests and verify they fail**

Run:

```bash
npm run test -- src/modules/employees/domain/policies/employee-features-policy.spec.ts
```

Expected: FAIL with missing `SYSTEM_MANAGED_EMPLOYEE_FEATURES`, missing session features, and missing helper methods.

- [ ] **Step 3: Implement the feature policy**

Replace `src/modules/employees/domain/policies/employee-features-policy.ts` with:

```ts
export const DEFAULT_EMPLOYEE_FEATURES = [
  "read:appointments",
  "read:services",
  "read:customers",
  "read:employees:self",
  "create:sessions:self",
  "read:sessions:self",
] as const;

export const SYSTEM_MANAGED_EMPLOYEE_FEATURES = [
  "create:sessions:self",
  "read:sessions:self",
] as const;

export const ALLOWED_EXTRA_EMPLOYEE_FEATURES = [
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
] as const;

export const ALLOWED_EMPLOYEE_FEATURES = [
  ...DEFAULT_EMPLOYEE_FEATURES,
  ...ALLOWED_EXTRA_EMPLOYEE_FEATURES,
] as const;

export type DefaultEmployeeFeature = (typeof DEFAULT_EMPLOYEE_FEATURES)[number];
export type SystemManagedEmployeeFeature =
  (typeof SYSTEM_MANAGED_EMPLOYEE_FEATURES)[number];
export type ExtraEmployeeFeature =
  (typeof ALLOWED_EXTRA_EMPLOYEE_FEATURES)[number];
export type EmployeeFeature = (typeof ALLOWED_EMPLOYEE_FEATURES)[number];

export class InvalidEmployeeFeatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidEmployeeFeatureError";
  }
}

export class EmployeeFeaturesPolicy {
  static build(extraFeatures: string[] = []): EmployeeFeature[] {
    const defaultFeatures = new Set<string>(DEFAULT_EMPLOYEE_FEATURES);
    const allowedExtraFeatures = new Set<string>(
      ALLOWED_EXTRA_EMPLOYEE_FEATURES,
    );

    for (const feature of extraFeatures) {
      if (defaultFeatures.has(feature)) {
        throw new InvalidEmployeeFeatureError(
          `${feature} is a default employee feature and cannot be sent as extra.`,
        );
      }

      if (!allowedExtraFeatures.has(feature)) {
        throw new InvalidEmployeeFeatureError(
          `Invalid employee feature: ${feature}`,
        );
      }
    }

    const requestedFeatures = new Set(extraFeatures);

    return [
      ...DEFAULT_EMPLOYEE_FEATURES,
      ...ALLOWED_EXTRA_EMPLOYEE_FEATURES.filter((feature) =>
        requestedFeatures.has(feature),
      ),
    ];
  }

  static normalizePersisted(features: string[]): EmployeeFeature[] {
    for (const feature of features) {
      if (!EmployeeFeaturesPolicy.isEmployeeFeature(feature)) {
        throw new InvalidEmployeeFeatureError(
          `Invalid persisted employee feature: ${feature}`,
        );
      }
    }

    const requestedFeatures = new Set(features);

    return ALLOWED_EMPLOYEE_FEATURES.filter((feature) =>
      requestedFeatures.has(feature),
    );
  }

  static withoutSystemManagedFeatures(
    features: EmployeeFeature[],
  ): EmployeeFeature[] {
    const systemManagedFeatures = new Set<string>(
      SYSTEM_MANAGED_EMPLOYEE_FEATURES,
    );

    return features.filter((feature) => !systemManagedFeatures.has(feature));
  }

  static hasAll(
    features: readonly EmployeeFeature[],
    requiredFeatures: readonly EmployeeFeature[],
  ) {
    return requiredFeatures.every((feature) => features.includes(feature));
  }

  static isEmployeeFeature(feature: string): feature is EmployeeFeature {
    return (ALLOWED_EMPLOYEE_FEATURES as readonly string[]).includes(feature);
  }
}
```

- [ ] **Step 4: Run the feature policy tests and verify they pass**

Run:

```bash
npm run test -- src/modules/employees/domain/policies/employee-features-policy.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the feature policy**

Run:

```bash
git add src/modules/employees/domain/policies/employee-features-policy.ts src/modules/employees/domain/policies/employee-features-policy.spec.ts
git commit -m "feat: extend employee feature policy"
```

Expected: commit created.

## Task 2: Employee Domain Soft Delete And Update

**Files:**

- Create: `src/modules/employees/domain/errors/employee-already-deleted-error.ts`
- Modify: `src/modules/employees/domain/entities/employee.spec.ts`
- Modify: `src/modules/employees/domain/entities/employee.ts`
- Test: `src/modules/employees/domain/entities/employee.spec.ts`

- [ ] **Step 1: Add failing employee domain tests**

Replace `src/modules/employees/domain/entities/employee.spec.ts` with:

```ts
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Cpf } from "../../../accounts/domain/value-objects/cpf";
import { EmployeeAlreadyDeletedError } from "../errors/employee-already-deleted-error";
import { InvalidRegisterEmployeeInputError } from "../errors/invalid-register-employee-input-error";
import { InvalidEmployeeFeatureError } from "../policies/employee-features-policy";
import { BirthDate } from "../value-objects/birth-date";
import { Employee } from "./employee";

describe("Employee", () => {
  const referenceDate = new Date("2026-05-05T12:00:00.000Z");

  it("should create an active employee with normalized values", () => {
    const establishmentId = new UniqueEntityId();
    const userId = new UniqueEntityId();
    const birthDate = BirthDate.create(new Date("1995-01-01T00:00:00.000Z"), {
      referenceDate,
    });

    const employee = Employee.create({
      establishmentId,
      userId,
      name: " Ana Silva ",
      cpf: "529.982.247-25",
      birthDate,
      extraFeatures: ["update:customers", "create:appointments"],
    });

    expect(employee.establishmentId).toBe(establishmentId);
    expect(employee.userId).toBe(userId);
    expect(employee.name).toBe("Ana Silva");
    expect(employee.cpf?.toString()).toBe("52998224725");
    expect(employee.birthDate?.equals(birthDate)).toBe(true);
    expect(employee.profileImageUrl).toBeNull();
    expect(employee.deletedAt).toBeNull();
    expect(employee.isDeleted()).toBe(false);
    expect(employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
      "create:appointments",
      "update:customers",
    ]);
  });

  it("should create an employee with nullable optional values", () => {
    const employee = Employee.create({
      establishmentId: new UniqueEntityId(),
      userId: new UniqueEntityId(),
      name: "Ana Silva",
    });

    expect(employee.cpf).toBeNull();
    expect(employee.birthDate).toBeNull();
    expect(employee.profileImageUrl).toBeNull();
    expect(employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
    ]);
  });

  it("should normalize profileImageUrl on create", () => {
    const baseProps = {
      establishmentId: new UniqueEntityId(),
      userId: new UniqueEntityId(),
      name: "Ana Silva",
    };

    const omitted = Employee.create(baseProps);
    const withNull = Employee.create({ ...baseProps, profileImageUrl: null });
    const withBlank = Employee.create({
      ...baseProps,
      profileImageUrl: "   ",
    });
    const withTrim = Employee.create({
      ...baseProps,
      profileImageUrl: " https://cdn.example/avatar.png ",
    });

    expect(omitted.profileImageUrl).toBeNull();
    expect(withNull.profileImageUrl).toBeNull();
    expect(withBlank.profileImageUrl).toBeNull();
    expect(withTrim.profileImageUrl).toBe("https://cdn.example/avatar.png");
  });

  it("should reject an empty employee name", () => {
    expect(() =>
      Employee.create({
        establishmentId: new UniqueEntityId(),
        userId: new UniqueEntityId(),
        name: "   ",
      }),
    ).toThrow(InvalidRegisterEmployeeInputError);
  });

  it("should update coherent employee fields", () => {
    const employee = Employee.create({
      establishmentId: new UniqueEntityId(),
      userId: new UniqueEntityId(),
      name: "Ana Silva",
    });
    const birthDate = BirthDate.create(new Date("1995-01-01T00:00:00.000Z"), {
      referenceDate,
    });

    employee.changeName(" Beatriz Souza ");
    employee.changeCpf(Cpf.create("52998224725"));
    employee.changeBirthDate(birthDate);
    employee.replaceFeatures(["delete:services", "update:employees:self"]);

    expect(employee.name).toBe("Beatriz Souza");
    expect(employee.cpf?.toString()).toBe("52998224725");
    expect(employee.birthDate?.equals(birthDate)).toBe(true);
    expect(employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
      "delete:services",
      "update:employees:self",
    ]);
  });

  it("should update through the aggregate update method", () => {
    const employee = Employee.create({
      establishmentId: new UniqueEntityId(),
      userId: new UniqueEntityId(),
      name: "Ana Silva",
      extraFeatures: ["create:appointments"],
    });

    employee.update({
      name: " Beatriz Souza ",
      birthDate: new Date("1995-01-01T00:00:00.000Z"),
      extraFeatures: ["update:employees:self"],
    });

    expect(employee.name).toBe("Beatriz Souza");
    expect(employee.birthDate?.toString()).toBe("1995-01-01T00:00:00.000Z");
    expect(employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
      "update:employees:self",
    ]);
  });

  it("should soft-delete an employee and remove only session features", () => {
    const deletedAt = new Date("2026-05-05T10:00:00.000Z");
    const employee = Employee.create({
      establishmentId: new UniqueEntityId(),
      userId: new UniqueEntityId(),
      name: "Ana Silva",
      extraFeatures: ["create:appointments", "update:employees:self"],
    });

    employee.softDelete(deletedAt);

    expect(employee.deletedAt).toEqual(deletedAt);
    expect(employee.isDeleted()).toBe(true);
    expect(employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:appointments",
      "update:employees:self",
    ]);
  });

  it("should reject updates after soft delete", () => {
    const employee = Employee.create({
      establishmentId: new UniqueEntityId(),
      userId: new UniqueEntityId(),
      name: "Ana Silva",
    });

    employee.softDelete(new Date("2026-05-05T10:00:00.000Z"));

    expect(() => employee.update({ name: "Beatriz Souza" })).toThrow(
      EmployeeAlreadyDeletedError,
    );
    expect(() => employee.changeName("Beatriz Souza")).toThrow(
      EmployeeAlreadyDeletedError,
    );
    expect(() => employee.replaceFeatures(["update:employees:self"])).toThrow(
      EmployeeAlreadyDeletedError,
    );
    expect(() => employee.softDelete()).toThrow(EmployeeAlreadyDeletedError);
  });

  it("should return a defensive copy for features getter", () => {
    const employee = Employee.create({
      establishmentId: new UniqueEntityId(),
      userId: new UniqueEntityId(),
      name: "Ana Silva",
      extraFeatures: ["create:appointments"],
    });

    const features = employee.features;
    features.push("update:customers");

    expect(employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
      "create:appointments",
    ]);
  });

  it("should normalize required name, features, and deletedAt on restore", () => {
    const establishmentId = new UniqueEntityId();
    const userId = new UniqueEntityId();

    const employee = Employee.restore({
      establishmentId,
      userId,
      profileImageUrl: null,
      name: " Ana Silva ",
      cpf: null,
      birthDate: null,
      features: ["read:services", "read:appointments", "read:customers"],
      deletedAt: new Date("2026-05-05T10:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(employee.name).toBe("Ana Silva");
    expect(employee.deletedAt).toEqual(new Date("2026-05-05T10:00:00.000Z"));
    expect(employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
    ]);
  });

  it("should reject invalid persisted features on restore", () => {
    expect(() =>
      Employee.restore({
        establishmentId: new UniqueEntityId(),
        userId: new UniqueEntityId(),
        profileImageUrl: null,
        name: "Ana Silva",
        cpf: null,
        birthDate: null,
        features: ["invalid:feature"] as unknown as Employee["features"],
        deletedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toThrow(InvalidEmployeeFeatureError);
  });
});
```

- [ ] **Step 2: Run the employee domain tests and verify they fail**

Run:

```bash
npm run test -- src/modules/employees/domain/entities/employee.spec.ts
```

Expected: FAIL with missing `EmployeeAlreadyDeletedError`, `deletedAt`, `isDeleted`, `update`, and `softDelete`.

- [ ] **Step 3: Add the employee deleted error**

Create `src/modules/employees/domain/errors/employee-already-deleted-error.ts`:

```ts
export class EmployeeAlreadyDeletedError extends Error {
  constructor(message = "Employee already deleted.") {
    super(message);
    this.name = "EmployeeAlreadyDeletedError";
  }
}
```

- [ ] **Step 4: Implement employee domain behavior**

Replace `src/modules/employees/domain/entities/employee.ts` with:

```ts
import { AggregateRoot } from "../../../../shared/entities/aggregate-root";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Cpf } from "../../../accounts/domain/value-objects/cpf";
import { EmployeeAlreadyDeletedError } from "../errors/employee-already-deleted-error";
import { InvalidRegisterEmployeeInputError } from "../errors/invalid-register-employee-input-error";
import {
  EmployeeFeature,
  EmployeeFeaturesPolicy,
} from "../policies/employee-features-policy";
import { BirthDate } from "../value-objects/birth-date";

export type EmployeeProps = {
  establishmentId: UniqueEntityId;
  userId: UniqueEntityId;
  profileImageUrl: string | null;
  name: string;
  cpf: Cpf | null;
  birthDate: BirthDate | null;
  features: EmployeeFeature[];
  deletedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type EmployeeCreateProps = {
  establishmentId: UniqueEntityId;
  userId: UniqueEntityId;
  name: string;
  cpf?: Cpf | string | null;
  birthDate?: BirthDate | Date | null;
  extraFeatures?: string[];
  profileImageUrl?: string | null;
  deletedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export class Employee extends AggregateRoot<EmployeeProps> {
  get establishmentId() {
    return this.props.establishmentId;
  }

  get userId() {
    return this.props.userId;
  }

  get profileImageUrl() {
    return this.props.profileImageUrl;
  }

  get name() {
    return this.props.name;
  }

  get cpf() {
    return this.props.cpf;
  }

  get birthDate() {
    return this.props.birthDate;
  }

  get features() {
    return [...this.props.features];
  }

  get deletedAt() {
    return this.props.deletedAt;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }

  static create(props: EmployeeCreateProps, id?: UniqueEntityId) {
    return new Employee(
      {
        establishmentId: props.establishmentId,
        userId: props.userId,
        profileImageUrl: Employee.normalizeOptionalText(props.profileImageUrl),
        name: Employee.normalizeRequiredText(props.name, "name"),
        cpf: Employee.normalizeCpf(props.cpf ?? null),
        birthDate: Employee.normalizeBirthDate(props.birthDate ?? null),
        features: EmployeeFeaturesPolicy.build(props.extraFeatures ?? []),
        deletedAt: props.deletedAt ?? null,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id,
    );
  }

  static restore(props: EmployeeProps, id?: UniqueEntityId) {
    return new Employee(
      {
        ...props,
        name: Employee.normalizeRequiredText(props.name, "name"),
        features: EmployeeFeaturesPolicy.normalizePersisted(props.features),
      },
      id,
    );
  }

  update(data: {
    name?: string;
    birthDate?: BirthDate | Date | null;
    extraFeatures?: string[];
  }) {
    this.ensureActive();

    if (data.name !== undefined) {
      this.changeName(data.name);
    }

    if (data.birthDate !== undefined) {
      this.changeBirthDate(Employee.normalizeBirthDate(data.birthDate));
    }

    if (data.extraFeatures !== undefined) {
      this.replaceFeatures(data.extraFeatures);
    }
  }

  changeName(name: string) {
    this.ensureActive();

    const normalizedName = Employee.normalizeRequiredText(name, "name");

    if (this.props.name === normalizedName) {
      return;
    }

    this.props.name = normalizedName;
    this.touch();
  }

  changeCpf(cpf: Cpf | null) {
    this.ensureActive();

    if ((cpf && this.props.cpf?.equals(cpf)) || this.props.cpf === cpf) {
      return;
    }

    this.props.cpf = cpf;
    this.touch();
  }

  changeBirthDate(birthDate: BirthDate | null) {
    this.ensureActive();

    if (
      this.props.birthDate !== null &&
      birthDate !== null &&
      this.props.birthDate.equals(birthDate)
    ) {
      return;
    }

    if (this.props.birthDate === birthDate) {
      return;
    }

    this.props.birthDate = birthDate;
    this.touch();
  }

  replaceFeatures(extraFeatures: string[]) {
    this.ensureActive();
    this.props.features = EmployeeFeaturesPolicy.build(extraFeatures);
    this.touch();
  }

  softDelete(referenceDate: Date = new Date()) {
    this.ensureActive();
    this.props.deletedAt = referenceDate;
    this.props.features = EmployeeFeaturesPolicy.withoutSystemManagedFeatures(
      this.props.features,
    );
    this.touch(referenceDate);
  }

  isDeleted() {
    return this.props.deletedAt !== null;
  }

  touch(referenceDate: Date = new Date()) {
    this.props.updatedAt = referenceDate;
  }

  private ensureActive() {
    if (this.isDeleted()) {
      throw new EmployeeAlreadyDeletedError();
    }
  }

  private static normalizeCpf(value: Cpf | string | null) {
    if (value === null) {
      return null;
    }

    if (value instanceof Cpf) {
      return value;
    }

    if (!value.trim()) {
      return null;
    }

    return Cpf.create(value);
  }

  private static normalizeBirthDate(value: BirthDate | Date | null) {
    if (value === null) {
      return null;
    }

    if (value instanceof BirthDate) {
      return value;
    }

    return BirthDate.create(value);
  }

  private static normalizeRequiredText(value: string, field: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new InvalidRegisterEmployeeInputError(`${field} is required.`);
    }

    return normalized;
  }

  private static normalizeOptionalText(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim();

    if (!normalized) {
      return null;
    }

    return normalized;
  }
}
```

- [ ] **Step 5: Run employee domain tests and verify they pass**

Run:

```bash
npm run test -- src/modules/employees/domain/entities/employee.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Run register employee tests and update stale default feature expectations**

Run:

```bash
npm run test -- src/modules/application/use-cases/employee/register-employee.spec.ts
```

Expected: FAIL only where old default feature arrays omit `read:employees:self`, `create:sessions:self`, and `read:sessions:self`.

Update expected arrays in `src/modules/application/use-cases/employee/register-employee.spec.ts` to include:

```ts
[
  "read:appointments",
  "read:services",
  "read:customers",
  "read:employees:self",
  "create:sessions:self",
  "read:sessions:self",
]
```

and, when extra features are expected, keep extras after those defaults:

```ts
[
  "read:appointments",
  "read:services",
  "read:customers",
  "read:employees:self",
  "create:sessions:self",
  "read:sessions:self",
  "create:appointments",
  "update:customers",
]
```

- [ ] **Step 7: Re-run affected domain and register tests**

Run:

```bash
npm run test -- src/modules/employees/domain/entities/employee.spec.ts src/modules/employees/domain/policies/employee-features-policy.spec.ts src/modules/application/use-cases/employee/register-employee.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit employee domain behavior**

Run:

```bash
git add src/modules/employees/domain/entities/employee.ts src/modules/employees/domain/entities/employee.spec.ts src/modules/employees/domain/errors/employee-already-deleted-error.ts src/modules/application/use-cases/employee/register-employee.spec.ts
git commit -m "feat: add employee soft delete behavior"
```

Expected: commit created.

## Task 3: Prisma Schema, Mapper, And Repositories

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260505120000_manage_employees/migration.sql`
- Modify: `src/generated/prisma/**`
- Modify: `src/modules/application/repositories/employees-repository.ts`
- Modify: `tests/repositories/in-memory-employees-repository.ts`
- Modify: `src/infra/database/prisma/mappers/prisma-employee-mapper.ts`
- Modify: `src/infra/database/prisma/repositories/prisma-employees-repository.ts`
- Test: `src/modules/application/use-cases/employee/register-employee.spec.ts`

- [ ] **Step 1: Update Prisma schema**

In `prisma/schema.prisma`, update `model Employee` to include:

```prisma
  deletedAt       DateTime? @map("deleted_at")
```

Place it between `features` and `createdAt`, then add this index below the existing employee establishment index:

```prisma
  @@index([establishmentId, deletedAt])
```

The resulting employee model must include:

```prisma
model Employee {
  id              String    @id @default(uuid()) @db.Uuid
  establishmentId String    @map("establishment_id") @db.Uuid
  userId          String    @unique @map("user_id") @db.Uuid
  profileImageUrl String?   @map("profile_image_url")
  name            String?
  cpf             String?   @db.VarChar(11)
  birthDate       DateTime? @map("birth_date")
  features        String[]  @default(["read:services", "read:appointments", "read:customers"])
  deletedAt       DateTime? @map("deleted_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @default(now()) @updatedAt @map("updated_at")

  establishment Establishment @relation(fields: [establishmentId], references: [id], onDelete: Restrict)
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([establishmentId])
  @@index([establishmentId, deletedAt])
  @@map("employees")
}
```

- [ ] **Step 2: Add the migration SQL**

Create `prisma/migrations/20260505120000_manage_employees/migration.sql`:

```sql
ALTER TABLE "employees" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "employees_establishment_id_deleted_at_idx"
ON "employees"("establishment_id", "deleted_at");

UPDATE "employees"
SET "features" =
  "features"
  || CASE
    WHEN NOT ('read:employees:self' = ANY("features"))
    THEN ARRAY['read:employees:self']::text[]
    ELSE ARRAY[]::text[]
  END
  || CASE
    WHEN NOT ('create:sessions:self' = ANY("features"))
    THEN ARRAY['create:sessions:self']::text[]
    ELSE ARRAY[]::text[]
  END
  || CASE
    WHEN NOT ('read:sessions:self' = ANY("features"))
    THEN ARRAY['read:sessions:self']::text[]
    ELSE ARRAY[]::text[]
  END;
```

- [ ] **Step 3: Regenerate Prisma client**

Run:

```bash
npm run prisma:generate
```

Expected: generated Prisma client updates successfully and includes `Employee.deletedAt`.

- [ ] **Step 4: Extend the repository contract**

Replace `src/modules/application/repositories/employees-repository.ts` with:

```ts
import { Injectable } from "@nestjs/common";
import { Employee } from "../../employees/domain/entities/employee";

export type EmployeeFilters = {
  name?: string;
  includeDeleted?: boolean;
};

@Injectable()
export abstract class EmployeesRepository {
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
}
```

- [ ] **Step 5: Update the in-memory employee repository**

Replace `tests/repositories/in-memory-employees-repository.ts` with:

```ts
import {
  EmployeeFilters,
  EmployeesRepository,
} from "../../src/modules/application/repositories/employees-repository";
import { Employee } from "../../src/modules/employees/domain/entities/employee";

export class InMemoryEmployeesRepository implements EmployeesRepository {
  public items: Employee[] = [];

  async create(employee: Employee): Promise<void> {
    this.items.push(employee);
  }

  async findById(id: string): Promise<Employee | null> {
    const employee = this.items.find((item) => item.id.toString() === id);

    return employee ?? null;
  }

  async findByUserId(userId: string): Promise<Employee | null> {
    const employee = this.items.find(
      (item) => item.userId.toString() === userId,
    );

    return employee ?? null;
  }

  async findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<Employee | null> {
    const employee = this.items.find(
      (item) =>
        item.id.toString() === id &&
        item.establishmentId.toString() === establishmentId,
    );

    return employee ?? null;
  }

  async findManyByEstablishmentId(
    establishmentId: string,
    filters?: EmployeeFilters,
  ): Promise<Employee[]> {
    const name = filters?.name?.trim().toLowerCase();

    return this.items
      .slice()
      .sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime())
      .filter((item) => item.establishmentId.toString() === establishmentId)
      .filter((item) => filters?.includeDeleted || !item.isDeleted())
      .filter((item) => {
        if (!name) {
          return true;
        }

        return item.name.toLowerCase().includes(name);
      });
  }

  async save(employee: Employee): Promise<void> {
    const employeeIndex = this.items.findIndex((item) =>
      item.id.equals(employee.id),
    );

    if (employeeIndex === -1) {
      this.items.push(employee);
      return;
    }

    this.items[employeeIndex] = employee;
  }
}
```

- [ ] **Step 6: Update the Prisma employee mapper**

Replace `src/infra/database/prisma/mappers/prisma-employee-mapper.ts` with:

```ts
import {
  Employee as PrismaEmployee,
  Prisma,
} from "../../../../generated/prisma/client";
import { Cpf } from "../../../../modules/accounts/domain/value-objects/cpf";
import { Employee } from "../../../../modules/employees/domain/entities/employee";
import { EmployeeFeaturesPolicy } from "../../../../modules/employees/domain/policies/employee-features-policy";
import { BirthDate } from "../../../../modules/employees/domain/value-objects/birth-date";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";

export class PrismaEmployeeMapper {
  static toDomain(raw: PrismaEmployee): Employee {
    return Employee.restore(
      {
        establishmentId: new UniqueEntityId(raw.establishmentId),
        userId: new UniqueEntityId(raw.userId),
        profileImageUrl: raw.profileImageUrl,
        name: raw.name ?? "",
        cpf: raw.cpf ? Cpf.create(raw.cpf) : null,
        birthDate: raw.birthDate
          ? BirthDate.create(raw.birthDate, { mustBeAdult: false })
          : null,
        features: EmployeeFeaturesPolicy.normalizePersisted(raw.features),
        deletedAt: raw.deletedAt,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPrisma(raw: Employee): Prisma.EmployeeUncheckedCreateInput {
    return {
      id: raw.id.toString(),
      establishmentId: raw.establishmentId.toString(),
      userId: raw.userId.toString(),
      profileImageUrl: raw.profileImageUrl,
      name: raw.name,
      cpf: raw.cpf?.toString() ?? null,
      birthDate: raw.birthDate?.toDate() ?? null,
      features: raw.features,
      deletedAt: raw.deletedAt,
      ...(raw.createdAt ? { createdAt: raw.createdAt } : {}),
      ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
    };
  }

  static toPrismaUpdate(raw: Employee): Prisma.EmployeeUncheckedUpdateInput {
    return {
      profileImageUrl: raw.profileImageUrl,
      name: raw.name,
      cpf: raw.cpf?.toString() ?? null,
      birthDate: raw.birthDate?.toDate() ?? null,
      features: raw.features,
      deletedAt: raw.deletedAt,
      ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
    };
  }
}
```

- [ ] **Step 7: Update the Prisma employee repository**

Replace `src/infra/database/prisma/repositories/prisma-employees-repository.ts` with:

```ts
import { Injectable } from "@nestjs/common";

import {
  EmployeeFilters,
  EmployeesRepository,
} from "../../../../modules/application/repositories/employees-repository";
import { Employee } from "../../../../modules/employees/domain/entities/employee";
import { PrismaEmployeeMapper } from "../mappers/prisma-employee-mapper";
import { rethrowPrismaRepositoryError } from "../prisma-repository-error-handler";
import { PrismaUnitOfWork } from "../prisma-unit-of-work";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaEmployeesRepository implements EmployeesRepository {
  constructor(private prisma: PrismaService) {}

  async create(employee: Employee): Promise<void> {
    const data = PrismaEmployeeMapper.toPrisma(employee);

    try {
      await PrismaUnitOfWork.getClient(this.prisma).employee.create({
        data,
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findById(id: string): Promise<Employee | null> {
    try {
      const employee = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).employee.findUnique({
        where: {
          id,
        },
      });

      if (!employee) {
        return null;
      }

      return PrismaEmployeeMapper.toDomain(employee);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findByUserId(userId: string): Promise<Employee | null> {
    try {
      const employee = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).employee.findUnique({
        where: {
          userId,
        },
      });

      if (!employee) {
        return null;
      }

      return PrismaEmployeeMapper.toDomain(employee);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<Employee | null> {
    try {
      const employee = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).employee.findFirst({
        where: {
          id,
          establishmentId,
        },
      });

      if (!employee) {
        return null;
      }

      return PrismaEmployeeMapper.toDomain(employee);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findManyByEstablishmentId(
    establishmentId: string,
    filters?: EmployeeFilters,
  ): Promise<Employee[]> {
    const name = filters?.name?.trim();

    try {
      const employees = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).employee.findMany({
        where: {
          establishmentId,
          ...(filters?.includeDeleted ? {} : { deletedAt: null }),
          ...(name
            ? {
                name: {
                  contains: name,
                  mode: "insensitive",
                },
              }
            : {}),
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      return employees.map((employee) =>
        PrismaEmployeeMapper.toDomain(employee),
      );
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async save(employee: Employee): Promise<void> {
    const data = PrismaEmployeeMapper.toPrismaUpdate(employee);

    try {
      await PrismaUnitOfWork.getClient(this.prisma).employee.update({
        where: {
          id: employee.id.toString(),
        },
        data,
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }
}
```

- [ ] **Step 8: Run repository-dependent unit tests**

Run:

```bash
npm run test -- src/modules/application/use-cases/employee/register-employee.spec.ts
```

Expected: PASS.

- [ ] **Step 9: Typecheck the repository and generated types**

Run:

```bash
npm run typecheck
```

Expected: PASS. If it fails on generated Prisma types, confirm `npm run prisma:generate` was run after the schema edit.

- [ ] **Step 10: Commit persistence changes**

Run:

```bash
git add prisma/schema.prisma prisma/migrations/20260505120000_manage_employees/migration.sql src/generated/prisma src/modules/application/repositories/employees-repository.ts tests/repositories/in-memory-employees-repository.ts src/infra/database/prisma/mappers/prisma-employee-mapper.ts src/infra/database/prisma/repositories/prisma-employees-repository.ts
git commit -m "feat: persist manageable employees"
```

Expected: commit created.

## Task 4: Employee Session Feature Checks In Auth

**Files:**

- Create: `src/modules/application/services/employee-session-access.ts`
- Create: `src/infra/auth/employee-features.ts`
- Create: `src/infra/auth/employee-features.guard.ts`
- Modify: `src/infra/auth/access-session.guard.ts`
- Modify: `src/infra/auth/auth.module.ts`
- Modify: `src/modules/application/use-cases/auth/login-with-credentials.ts`
- Modify: `src/modules/application/use-cases/auth/login-with-credentials.spec.ts`
- Modify: `src/modules/application/use-cases/auth/refresh-session.ts`
- Modify: `src/modules/application/use-cases/auth/refresh-session.spec.ts`
- Test: `src/modules/application/use-cases/auth/login-with-credentials.spec.ts`
- Test: `src/modules/application/use-cases/auth/refresh-session.spec.ts`

- [ ] **Step 1: Add failing login and refresh tests for employee session features**

In `src/modules/application/use-cases/auth/login-with-credentials.spec.ts`, add imports:

```ts
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { EmployeeSessionAccessService } from "../../services/employee-session-access";
```

Add declarations beside the existing repository/service declarations:

```ts
let inMemoryEmployeesRepository: InMemoryEmployeesRepository;
let employeeSessionAccessService: EmployeeSessionAccessService;
```

In `beforeEach`, instantiate the new repository and service:

```ts
    inMemoryEmployeesRepository = new InMemoryEmployeesRepository();
    employeeSessionAccessService = new EmployeeSessionAccessService(
      inMemoryEmployeesRepository,
    );
```

Pass `employeeSessionAccessService` as the last constructor argument:

```ts
    sut = new LoginWithCredentialsUseCase(
      inMemoryUsersRepository,
      inMemorySessionsRepository,
      fakeHashComparer,
      fakeTokenHasher,
      sessionCreationService,
      envService as EnvService,
      authService,
      employeeSessionAccessService,
    );
```

Add these tests before the final `should create a session with null metadata` test:

```ts
it("should reject employee login without create sessions feature", async () => {
  const plainPassword = "strong-password";
  const hashedPassword = await fakeHashGenerator.hash(plainPassword);
  const user = makeUser("EMPLOYEE", {
    email: new Email("blocked.employee@example.com"),
    hashedPassword,
  });
  const employee = makeEmployee({
    userId: user.id,
    name: user.name,
    extraFeatures: ["update:employees:self"],
  });
  employee.softDelete(new Date("2026-05-05T10:00:00.000Z"));
  await inMemoryUsersRepository.create(user);
  await inMemoryEmployeesRepository.create(employee);

  const result = await sut.execute({
    email: "blocked.employee@example.com",
    password: plainPassword,
  });

  expect(result.isLeft()).toBe(true);
  expect(result.value).toBeInstanceOf(InvalidCredentialsError);
  expect(inMemorySessionsRepository.items).toHaveLength(0);
});

it("should allow employee login with create sessions feature", async () => {
  const plainPassword = "strong-password";
  const hashedPassword = await fakeHashGenerator.hash(plainPassword);
  const user = makeUser("EMPLOYEE", {
    email: new Email("active.employee@example.com"),
    hashedPassword,
  });
  await inMemoryUsersRepository.create(user);
  await inMemoryEmployeesRepository.create(
    makeEmployee({
      userId: user.id,
      name: user.name,
    }),
  );

  const result = await sut.execute({
    email: "active.employee@example.com",
    password: plainPassword,
  });

  expect(result.isRight()).toBe(true);
  expect(inMemorySessionsRepository.items).toHaveLength(1);
});
```

In `src/modules/application/use-cases/auth/refresh-session.spec.ts`, add imports:

```ts
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { EmployeeSessionAccessService } from "../../services/employee-session-access";
```

Add declarations inside `describe("RefreshSessionUseCase", () => {` beside the existing declarations:

```ts
  let inMemoryEmployeesRepository: InMemoryEmployeesRepository;
  let employeeSessionAccessService: EmployeeSessionAccessService;
```

In `beforeEach`, instantiate the repository and service:

```ts
    inMemoryEmployeesRepository = new InMemoryEmployeesRepository();
    employeeSessionAccessService = new EmployeeSessionAccessService(
      inMemoryEmployeesRepository,
    );
```

Pass `employeeSessionAccessService` as the last constructor argument:

```ts
    sut = new RefreshSessionUseCase(
      authService,
      envService as EnvService,
      inMemorySessionsRepository,
      inMemoryUsersRepository,
      fakeTokenHasher,
      employeeSessionAccessService,
    );
```

Add this helper inside the `describe` block after `afterEach`:

```ts
  async function makeRefreshableUserSession(role: "CUSTOMER" | "EMPLOYEE") {
    const user = makeUser(role);
    const sessionId = new UniqueEntityId();
    const refreshToken = await authService.generateRefreshToken({
      sub: user.id.toString(),
      sid: sessionId.toString(),
    });
    const refreshTokenHash = await fakeTokenHasher.hash(refreshToken);
    const session = sessionCreationService.execute({
      id: sessionId,
      userId: user.id,
      refreshTokenHash,
      ttlInMs: refreshTokenTtlInMs,
      referenceDate: new Date("2026-04-17T12:00:00.000Z"),
    });

    await inMemoryUsersRepository.create(user);
    await inMemorySessionsRepository.create(session);

    return {
      refreshToken,
      session,
      user,
    };
  }
```

Add these tests after `should reject an invalid refresh token`:

```ts
it("should reject employee refresh without read sessions feature", async () => {
  const { refreshToken, session, user } =
    await makeRefreshableUserSession("EMPLOYEE");
  const employee = makeEmployee({
    userId: user.id,
    name: user.name,
  });
  employee.softDelete(new Date("2026-05-05T10:00:00.000Z"));
  await inMemoryEmployeesRepository.create(employee);

  const result = await sut.execute({ refreshToken });

  expect(result.isLeft()).toBe(true);
  expect(result.value).toBeInstanceOf(InvalidSessionError);
  expect(inMemorySessionsRepository.items[0]?.refreshTokenHash).toBe(
    session.refreshTokenHash,
  );
});

it("should allow employee refresh with read sessions feature", async () => {
  const { refreshToken, user } =
    await makeRefreshableUserSession("EMPLOYEE");
  await inMemoryEmployeesRepository.create(
    makeEmployee({
      userId: user.id,
      name: user.name,
    }),
  );

  const result = await sut.execute({ refreshToken });

  expect(result.isRight()).toBe(true);
});
```

- [ ] **Step 2: Run auth use case tests and verify they fail**

Run:

```bash
npm run test -- src/modules/application/use-cases/auth/login-with-credentials.spec.ts src/modules/application/use-cases/auth/refresh-session.spec.ts
```

Expected: FAIL with missing `EmployeeSessionAccessService` constructor wiring and missing employee feature checks.

- [ ] **Step 3: Add the shared employee session access service**

Create `src/modules/application/services/employee-session-access.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "../../accounts/domain/value-objects/user-role";
import { EmployeesRepository } from "../repositories/employees-repository";
import { EmployeeFeaturesPolicy } from "../../employees/domain/policies/employee-features-policy";

type EmployeeSessionActor = {
  userId: string;
  role: UserRole;
};

@Injectable()
export class EmployeeSessionAccessService {
  constructor(private readonly employeesRepository: EmployeesRepository) {}

  async canCreateSessionFor(actor: EmployeeSessionActor) {
    return this.hasEmployeeFeature(actor, "create:sessions:self");
  }

  async canReadSessionFor(actor: EmployeeSessionActor) {
    return this.hasEmployeeFeature(actor, "read:sessions:self");
  }

  private async hasEmployeeFeature(
    actor: EmployeeSessionActor,
    feature: "create:sessions:self" | "read:sessions:self",
  ) {
    if (actor.role !== "EMPLOYEE") {
      return true;
    }

    const employee = await this.employeesRepository.findByUserId(actor.userId);

    if (!employee || employee.isDeleted()) {
      return false;
    }

    return EmployeeFeaturesPolicy.hasAll(employee.features, [feature]);
  }
}
```

- [ ] **Step 4: Update login use case to require create session feature**

Modify `src/modules/application/use-cases/auth/login-with-credentials.ts`:

Add import:

```ts
import { EmployeeSessionAccessService } from "../../services/employee-session-access";
```

Add constructor dependency after `authService`:

```ts
    private employeeSessionAccess: EmployeeSessionAccessService,
```

After password comparison succeeds and before session creation, add:

```ts
    const canCreateSession =
      await this.employeeSessionAccess.canCreateSessionFor({
        userId: user.id.toString(),
        role: user.role,
      });

    if (!canCreateSession) {
      return left(new InvalidCredentialsError());
    }
```

- [ ] **Step 5: Update refresh use case to require read session feature**

Modify `src/modules/application/use-cases/auth/refresh-session.ts`:

Add import:

```ts
import { EmployeeSessionAccessService } from "../../services/employee-session-access";
```

Add constructor dependency after `tokenHasher`:

```ts
    private readonly employeeSessionAccess: EmployeeSessionAccessService,
```

After user lookup and before generating the new refresh token, add:

```ts
      const canReadSession =
        await this.employeeSessionAccess.canReadSessionFor({
          userId: user.id.toString(),
          role: user.role,
        });

      if (!canReadSession) {
        return left(new InvalidSessionError());
      }
```

- [ ] **Step 6: Add employee feature decorator and guard**

Create `src/infra/auth/employee-features.ts`:

```ts
import { Reflector } from "@nestjs/core";
import { EmployeeFeature } from "../../modules/employees/domain/policies/employee-features-policy";

export const EmployeeFeatures = Reflector.createDecorator<EmployeeFeature[]>();
```

Create `src/infra/auth/employee-features.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { EmployeesRepository } from "../../modules/application/repositories/employees-repository";
import { EmployeeFeaturesPolicy } from "../../modules/employees/domain/policies/employee-features-policy";
import { AuthenticatedRequest } from "./authenticated-user";
import { EmployeeFeatures } from "./employee-features";

@Injectable()
export class EmployeeFeaturesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly employeesRepository: EmployeesRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeatures = this.reflector.getAllAndOverride(
      EmployeeFeatures,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredFeatures || requiredFeatures.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      return false;
    }

    if (user.role !== "EMPLOYEE") {
      return true;
    }

    const employee = await this.employeesRepository.findByUserId(user.userId);

    if (!employee || employee.isDeleted()) {
      return false;
    }

    return EmployeeFeaturesPolicy.hasAll(employee.features, requiredFeatures);
  }
}
```

- [ ] **Step 7: Update access-session guard**

Modify `src/infra/auth/access-session.guard.ts`:

Add import:

```ts
import { EmployeeSessionAccessService } from "../../modules/application/services/employee-session-access";
```

Add constructor dependency:

```ts
    private readonly employeeSessionAccess: EmployeeSessionAccessService,
```

After the existing session validity check and before assigning `request.user`, add:

```ts
      const role = payload.role as UserRole;
      const canReadSession =
        await this.employeeSessionAccess.canReadSessionFor({
          userId: payload.sub,
          role,
        });

      if (!canReadSession) {
        throw new UnauthorizedException("Invalid or expired session.");
      }
```

Then update the existing `request.user` assignment to use `role`:

```ts
      request.user = {
        userId: payload.sub,
        sessionId: payload.sid,
        role,
      };
```

- [ ] **Step 8: Register auth providers and guard**

Modify `src/infra/auth/auth.module.ts`:

Add imports:

```ts
import { EmployeeSessionAccessService } from "../../modules/application/services/employee-session-access";
import { EmployeeFeaturesGuard } from "./employee-features.guard";
```

Add the APP guard after `RolesGuard`:

```ts
    {
      provide: APP_GUARD,
      useClass: EmployeeFeaturesGuard,
    },
```

Add `EmployeeSessionAccessService` to providers and exports:

```ts
    EmployeeSessionAccessService,
```

- [ ] **Step 9: Update auth specs constructor wiring**

In `src/modules/application/use-cases/auth/login-with-credentials.spec.ts` and `src/modules/application/use-cases/auth/refresh-session.spec.ts`, instantiate:

```ts
inMemoryEmployeesRepository = new InMemoryEmployeesRepository();
employeeSessionAccessService = new EmployeeSessionAccessService(
  inMemoryEmployeesRepository,
);
```

Pass `employeeSessionAccessService` as the last constructor argument for the updated use case.

- [ ] **Step 10: Run auth tests**

Run:

```bash
npm run test -- src/modules/application/use-cases/auth/login-with-credentials.spec.ts src/modules/application/use-cases/auth/refresh-session.spec.ts
```

Expected: PASS.

- [ ] **Step 11: Typecheck auth changes**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 12: Commit auth feature checks**

Run:

```bash
git add src/modules/application/services/employee-session-access.ts src/infra/auth/employee-features.ts src/infra/auth/employee-features.guard.ts src/infra/auth/access-session.guard.ts src/infra/auth/auth.module.ts src/modules/application/use-cases/auth/login-with-credentials.ts src/modules/application/use-cases/auth/login-with-credentials.spec.ts src/modules/application/use-cases/auth/refresh-session.ts src/modules/application/use-cases/auth/refresh-session.spec.ts
git commit -m "feat: enforce employee session features"
```

Expected: commit created.

## Task 5: Employee Management Use Cases

**Files:**

- Create: `src/modules/application/use-cases/employee/update-employee.ts`
- Create: `src/modules/application/use-cases/employee/update-employee.spec.ts`
- Create: `src/modules/application/use-cases/employee/delete-employee.ts`
- Create: `src/modules/application/use-cases/employee/delete-employee.spec.ts`
- Create: `src/modules/application/use-cases/employee/get-employee.ts`
- Create: `src/modules/application/use-cases/employee/get-employee.spec.ts`
- Create: `src/modules/application/use-cases/employee/list-employees.ts`
- Create: `src/modules/application/use-cases/employee/list-employees.spec.ts`
- Test: `src/modules/application/use-cases/employee/*.spec.ts`

- [ ] **Step 1: Write failing use case tests**

Create `src/modules/application/use-cases/employee/update-employee.spec.ts`:

```ts
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { InvalidRegisterEmployeeInputError } from "../../../employees/domain/errors/invalid-register-employee-input-error";
import { UpdateEmployeeUseCase } from "./update-employee";

let employeesRepository: InMemoryEmployeesRepository;
let establishmentsRepository: InMemoryEstablishmentsRepository;
let sut: UpdateEmployeeUseCase;

describe("Update employee", () => {
  beforeEach(() => {
    employeesRepository = new InMemoryEmployeesRepository();
    establishmentsRepository = new InMemoryEstablishmentsRepository(
      new InMemoryServicesRepository(),
    );
    sut = new UpdateEmployeeUseCase(employeesRepository, establishmentsRepository);
  });

  it("should allow an establishment to update employee data and features", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const employee = makeEmployee({ establishmentId: establishment.id });
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      employeeId: employee.id.toString(),
      name: " Beatriz Souza ",
      birthDate: new Date("1995-01-01T00:00:00.000Z"),
      extraFeatures: ["update:employees:self"],
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.employee.name).toBe("Beatriz Souza");
    expect(result.value.employee.birthDate?.toString()).toBe(
      "1995-01-01T00:00:00.000Z",
    );
    expect(result.value.employee.features).toContain("update:employees:self");
    expect(result.value.employee.features).toContain("read:sessions:self");
  });

  it("should allow an employee to update only their own name and birth date", async () => {
    const employeeUser = makeUser("EMPLOYEE");
    const employee = makeEmployee({
      userId: employeeUser.id,
      extraFeatures: ["update:employees:self"],
    });
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: employeeUser.id.toString(), role: "EMPLOYEE" },
      employeeId: employee.id.toString(),
      name: " Beatriz Souza ",
      birthDate: null,
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.employee.name).toBe("Beatriz Souza");
    expect(result.value.employee.birthDate).toBeNull();
  });

  it("should reject employee self-update without update feature", async () => {
    const employeeUser = makeUser("EMPLOYEE");
    const employee = makeEmployee({ userId: employeeUser.id });
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: employeeUser.id.toString(), role: "EMPLOYEE" },
      employeeId: employee.id.toString(),
      name: "Blocked",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should reject employee feature updates from self actor", async () => {
    const employeeUser = makeUser("EMPLOYEE");
    const employee = makeEmployee({
      userId: employeeUser.id,
      extraFeatures: ["update:employees:self"],
    });
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: employeeUser.id.toString(), role: "EMPLOYEE" },
      employeeId: employee.id.toString(),
      extraFeatures: ["delete:customers"],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should hide cross-establishment employees", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const otherEmployee = makeEmployee();
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(otherEmployee);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      employeeId: otherEmployee.id.toString(),
      name: "Blocked",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should treat deleted employees as not found", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const employee = makeEmployee({ establishmentId: establishment.id });
    employee.softDelete(new Date("2026-05-05T10:00:00.000Z"));
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      employeeId: employee.id.toString(),
      name: "Blocked",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject invalid employee data", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const employee = makeEmployee({ establishmentId: establishment.id });
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      employeeId: employee.id.toString(),
      name: "   ",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidRegisterEmployeeInputError);
  });
});
```

Create `src/modules/application/use-cases/employee/delete-employee.spec.ts`:

```ts
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { DeleteEmployeeUseCase } from "./delete-employee";

let employeesRepository: InMemoryEmployeesRepository;
let establishmentsRepository: InMemoryEstablishmentsRepository;
let sut: DeleteEmployeeUseCase;

describe("Delete employee", () => {
  beforeEach(() => {
    employeesRepository = new InMemoryEmployeesRepository();
    establishmentsRepository = new InMemoryEstablishmentsRepository(
      new InMemoryServicesRepository(),
    );
    sut = new DeleteEmployeeUseCase(employeesRepository, establishmentsRepository);
  });

  it("should soft-delete an employee and remove session features", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const employee = makeEmployee({
      establishmentId: establishment.id,
      extraFeatures: ["update:employees:self"],
    });
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(employee);

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      employeeId: employee.id.toString(),
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.employee.deletedAt).toBeInstanceOf(Date);
    expect(result.value.employee.features).not.toContain("create:sessions:self");
    expect(result.value.employee.features).not.toContain("read:sessions:self");
    expect(result.value.employee.features).toContain("update:employees:self");
  });

  it("should hide employees from another establishment", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const otherEmployee = makeEmployee();
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(otherEmployee);

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      employeeId: otherEmployee.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should treat already deleted employees as not found", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const employee = makeEmployee({ establishmentId: establishment.id });
    employee.softDelete(new Date("2026-05-05T10:00:00.000Z"));
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(employee);

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      employeeId: employee.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
```

Create `src/modules/application/use-cases/employee/get-employee.spec.ts`:

```ts
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { GetEmployeeUseCase } from "./get-employee";

let employeesRepository: InMemoryEmployeesRepository;
let establishmentsRepository: InMemoryEstablishmentsRepository;
let sut: GetEmployeeUseCase;

describe("Get employee", () => {
  beforeEach(() => {
    employeesRepository = new InMemoryEmployeesRepository();
    establishmentsRepository = new InMemoryEstablishmentsRepository(
      new InMemoryServicesRepository(),
    );
    sut = new GetEmployeeUseCase(employeesRepository, establishmentsRepository);
  });

  it("should allow establishment to get owned employee", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const employee = makeEmployee({ establishmentId: establishment.id });
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      employeeId: employee.id.toString(),
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.employee.id.equals(employee.id)).toBe(true);
  });

  it("should allow employee to get itself", async () => {
    const user = makeUser("EMPLOYEE");
    const employee = makeEmployee({ userId: user.id });
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: user.id.toString(), role: "EMPLOYEE" },
      employeeId: employee.id.toString(),
    });

    expect(result.isRight()).toBe(true);
  });

  it("should reject employee without read self feature", async () => {
    const user = makeUser("EMPLOYEE");
    const employee = makeEmployee({ userId: user.id });
    employee.softDelete(new Date("2026-05-05T10:00:00.000Z"));
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: user.id.toString(), role: "EMPLOYEE" },
      employeeId: employee.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject employee getting another employee", async () => {
    const user = makeUser("EMPLOYEE");
    const employee = makeEmployee({ userId: user.id });
    const otherEmployee = makeEmployee();
    await employeesRepository.create(employee);
    await employeesRepository.create(otherEmployee);

    const result = await sut.execute({
      actor: { userId: user.id.toString(), role: "EMPLOYEE" },
      employeeId: otherEmployee.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject unsupported roles", async () => {
    const result = await sut.execute({
      actor: { userId: "customer-id", role: "CUSTOMER" },
      employeeId: "employee-id",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });
});
```

Create `src/modules/application/use-cases/employee/list-employees.spec.ts`:

```ts
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { ListEmployeesUseCase } from "./list-employees";

let employeesRepository: InMemoryEmployeesRepository;
let establishmentsRepository: InMemoryEstablishmentsRepository;
let sut: ListEmployeesUseCase;

describe("List employees", () => {
  beforeEach(() => {
    employeesRepository = new InMemoryEmployeesRepository();
    establishmentsRepository = new InMemoryEstablishmentsRepository(
      new InMemoryServicesRepository(),
    );
    sut = new ListEmployeesUseCase(employeesRepository, establishmentsRepository);
  });

  it("should list active employees by establishment and filter by name", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const ana = makeEmployee({
      establishmentId: establishment.id,
      name: "Ana Silva",
    });
    const bia = makeEmployee({
      establishmentId: establishment.id,
      name: "Beatriz Souza",
    });
    const deleted = makeEmployee({
      establishmentId: establishment.id,
      name: "Ana Deleted",
    });
    const other = makeEmployee({ name: "Ana Other" });
    deleted.softDelete(new Date("2026-05-05T10:00:00.000Z"));
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(ana);
    await employeesRepository.create(bia);
    await employeesRepository.create(deleted);
    await employeesRepository.create(other);

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      name: "ana",
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.employees.map((employee) => employee.id.toString())).toEqual([
      ana.id.toString(),
    ]);
  });

  it("should reject establishment user without establishment profile", async () => {
    const owner = makeUser("ESTABLISHMENT");

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
```

- [ ] **Step 2: Run the use case tests and verify they fail**

Run:

```bash
npm run test -- src/modules/application/use-cases/employee/update-employee.spec.ts src/modules/application/use-cases/employee/delete-employee.spec.ts src/modules/application/use-cases/employee/get-employee.spec.ts src/modules/application/use-cases/employee/list-employees.spec.ts
```

Expected: FAIL with missing use case files.

- [ ] **Step 3: Implement UpdateEmployeeUseCase**

Create `src/modules/application/use-cases/employee/update-employee.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { UserRole } from "../../../accounts/domain/value-objects/user-role";
import { Employee } from "../../../employees/domain/entities/employee";
import { EmployeeAlreadyDeletedError } from "../../../employees/domain/errors/employee-already-deleted-error";
import { InvalidRegisterEmployeeInputError } from "../../../employees/domain/errors/invalid-register-employee-input-error";
import {
  EmployeeFeaturesPolicy,
  InvalidEmployeeFeatureError,
} from "../../../employees/domain/policies/employee-features-policy";
import { InvalidBirthDateError } from "../../../employees/domain/value-objects/birth-date";
import { EmployeesRepository } from "../../repositories/employees-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

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

type UpdateEmployeeUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | InvalidRegisterEmployeeInputError
  | UnexpectedDomainError,
  { employee: Employee }
>;

@Injectable()
export class UpdateEmployeeUseCase {
  constructor(
    private employeesRepository: EmployeesRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    actor,
    employeeId,
    name,
    birthDate,
    extraFeatures,
  }: UpdateEmployeeUseCaseRequest): Promise<UpdateEmployeeUseCaseResponse> {
    if (actor.role === "ESTABLISHMENT") {
      return this.updateAsEstablishment({
        establishmentOwnerId: actor.userId,
        employeeId,
        name,
        birthDate,
        extraFeatures,
      });
    }

    if (actor.role === "EMPLOYEE") {
      return this.updateAsEmployee({
        actorUserId: actor.userId,
        employeeId,
        name,
        birthDate,
        extraFeatures,
      });
    }

    return left(new NotAllowedError());
  }

  private async updateAsEstablishment({
    establishmentOwnerId,
    employeeId,
    name,
    birthDate,
    extraFeatures,
  }: {
    establishmentOwnerId: string;
    employeeId: string;
    name?: string;
    birthDate?: Date | null;
    extraFeatures?: string[];
  }): Promise<UpdateEmployeeUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const employee = await this.employeesRepository.findByIdAndEstablishmentId(
      employeeId,
      establishment.id.toString(),
    );

    if (!employee || employee.isDeleted()) {
      return left(new ResourceNotFoundError({ resource: "employee" }));
    }

    return this.applyUpdate(employee, { name, birthDate, extraFeatures });
  }

  private async updateAsEmployee({
    actorUserId,
    employeeId,
    name,
    birthDate,
    extraFeatures,
  }: {
    actorUserId: string;
    employeeId: string;
    name?: string;
    birthDate?: Date | null;
    extraFeatures?: string[];
  }): Promise<UpdateEmployeeUseCaseResponse> {
    const employee = await this.employeesRepository.findByUserId(actorUserId);

    if (!employee || employee.isDeleted() || employee.id.toString() !== employeeId) {
      return left(new ResourceNotFoundError({ resource: "employee" }));
    }

    if (
      !EmployeeFeaturesPolicy.hasAll(employee.features, [
        "update:employees:self",
      ])
    ) {
      return left(new NotAllowedError());
    }

    if (extraFeatures !== undefined) {
      return left(new NotAllowedError("Employees cannot update features."));
    }

    return this.applyUpdate(employee, { name, birthDate });
  }

  private async applyUpdate(
    employee: Employee,
    data: {
      name?: string;
      birthDate?: Date | null;
      extraFeatures?: string[];
    },
  ): Promise<UpdateEmployeeUseCaseResponse> {
    try {
      employee.update(data);
      await this.employeesRepository.save(employee);
      return right({ employee });
    } catch (error) {
      if (
        error instanceof InvalidRegisterEmployeeInputError ||
        error instanceof InvalidBirthDateError ||
        error instanceof InvalidEmployeeFeatureError
      ) {
        return left(new InvalidRegisterEmployeeInputError(error.message));
      }

      if (error instanceof EmployeeAlreadyDeletedError) {
        return left(new ResourceNotFoundError({ resource: "employee" }));
      }

      return left(new UnexpectedDomainError());
    }
  }
}
```

- [ ] **Step 4: Implement DeleteEmployeeUseCase**

Create `src/modules/application/use-cases/employee/delete-employee.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { Employee } from "../../../employees/domain/entities/employee";
import { EmployeeAlreadyDeletedError } from "../../../employees/domain/errors/employee-already-deleted-error";
import { EmployeesRepository } from "../../repositories/employees-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type DeleteEmployeeUseCaseRequest = {
  establishmentOwnerId: string;
  employeeId: string;
};

type DeleteEmployeeUseCaseResponse = Either<
  ResourceNotFoundError | UnexpectedDomainError,
  { employee: Employee }
>;

@Injectable()
export class DeleteEmployeeUseCase {
  constructor(
    private employeesRepository: EmployeesRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    employeeId,
  }: DeleteEmployeeUseCaseRequest): Promise<DeleteEmployeeUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const employee = await this.employeesRepository.findByIdAndEstablishmentId(
      employeeId,
      establishment.id.toString(),
    );

    if (!employee || employee.isDeleted()) {
      return left(new ResourceNotFoundError({ resource: "employee" }));
    }

    try {
      employee.softDelete();
      await this.employeesRepository.save(employee);
    } catch (error) {
      if (error instanceof EmployeeAlreadyDeletedError) {
        return left(new ResourceNotFoundError({ resource: "employee" }));
      }

      return left(new UnexpectedDomainError());
    }

    return right({ employee });
  }
}
```

- [ ] **Step 5: Implement GetEmployeeUseCase**

Create `src/modules/application/use-cases/employee/get-employee.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UserRole } from "../../../accounts/domain/value-objects/user-role";
import { Employee } from "../../../employees/domain/entities/employee";
import { EmployeeFeaturesPolicy } from "../../../employees/domain/policies/employee-features-policy";
import { EmployeesRepository } from "../../repositories/employees-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type GetEmployeeActor = {
  userId: string;
  role: UserRole;
};

type GetEmployeeUseCaseRequest = {
  actor: GetEmployeeActor;
  employeeId: string;
};

type GetEmployeeUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  { employee: Employee }
>;

@Injectable()
export class GetEmployeeUseCase {
  constructor(
    private employeesRepository: EmployeesRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    actor,
    employeeId,
  }: GetEmployeeUseCaseRequest): Promise<GetEmployeeUseCaseResponse> {
    if (actor.role === "ESTABLISHMENT") {
      const establishment = await this.establishmentsRepository.findByOwnerId(
        actor.userId,
      );

      if (!establishment) {
        return left(new ResourceNotFoundError({ resource: "establishment" }));
      }

      const employee =
        await this.employeesRepository.findByIdAndEstablishmentId(
          employeeId,
          establishment.id.toString(),
        );

      if (!employee || employee.isDeleted()) {
        return left(new ResourceNotFoundError({ resource: "employee" }));
      }

      return right({ employee });
    }

    if (actor.role === "EMPLOYEE") {
      const employee = await this.employeesRepository.findByUserId(actor.userId);

      if (!employee || employee.isDeleted() || employee.id.toString() !== employeeId) {
        return left(new ResourceNotFoundError({ resource: "employee" }));
      }

      if (
        !EmployeeFeaturesPolicy.hasAll(employee.features, [
          "read:employees:self",
        ])
      ) {
        return left(new NotAllowedError());
      }

      return right({ employee });
    }

    return left(new NotAllowedError());
  }
}
```

- [ ] **Step 6: Implement ListEmployeesUseCase**

Create `src/modules/application/use-cases/employee/list-employees.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { Employee } from "../../../employees/domain/entities/employee";
import { EmployeesRepository } from "../../repositories/employees-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type ListEmployeesUseCaseRequest = {
  establishmentOwnerId: string;
  name?: string;
};

type ListEmployeesUseCaseResponse = Either<
  ResourceNotFoundError,
  { employees: Employee[] }
>;

@Injectable()
export class ListEmployeesUseCase {
  constructor(
    private employeesRepository: EmployeesRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    name,
  }: ListEmployeesUseCaseRequest): Promise<ListEmployeesUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const employees = await this.employeesRepository.findManyByEstablishmentId(
      establishment.id.toString(),
      {
        ...(name !== undefined ? { name } : {}),
      },
    );

    return right({ employees });
  }
}
```

- [ ] **Step 7: Run employee use case tests**

Run:

```bash
npm run test -- src/modules/application/use-cases/employee/update-employee.spec.ts src/modules/application/use-cases/employee/delete-employee.spec.ts src/modules/application/use-cases/employee/get-employee.spec.ts src/modules/application/use-cases/employee/list-employees.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Run all employee unit tests**

Run:

```bash
npm run test -- src/modules/employees/domain src/modules/application/use-cases/employee
```

Expected: PASS.

- [ ] **Step 9: Commit use cases**

Run:

```bash
git add src/modules/application/use-cases/employee/update-employee.ts src/modules/application/use-cases/employee/update-employee.spec.ts src/modules/application/use-cases/employee/delete-employee.ts src/modules/application/use-cases/employee/delete-employee.spec.ts src/modules/application/use-cases/employee/get-employee.ts src/modules/application/use-cases/employee/get-employee.spec.ts src/modules/application/use-cases/employee/list-employees.ts src/modules/application/use-cases/employee/list-employees.spec.ts
git commit -m "feat: add employee management use cases"
```

Expected: commit created.

## Task 6: HTTP Controllers, DTOs, Presenter, And Module Wiring

**Files:**

- Modify: `src/infra/http/presenters/employee-presenter.ts`
- Modify: `src/infra/http/docs/domain-swagger.dto.ts`
- Create: `src/infra/http/controllers/get-employee.controller.ts`
- Create: `src/infra/http/controllers/list-employees.controller.ts`
- Create: `src/infra/http/controllers/update-employee.controller.ts`
- Create: `src/infra/http/controllers/delete-employee.controller.ts`
- Modify: `src/infra/http/http.module.ts`
- Test: `npm run typecheck`

- [ ] **Step 1: Update employee presenter**

Modify `src/infra/http/presenters/employee-presenter.ts` so `toHTTP` returns `deletedAt`:

```ts
import { Employee } from "../../../modules/employees/domain/entities/employee";

export class EmployeePresenter {
  static toHTTP(employee: Employee) {
    return {
      id: employee.id.toString(),
      establishmentId: employee.establishmentId.toString(),
      userId: employee.userId.toString(),
      profileImageUrl: employee.profileImageUrl,
      name: employee.name,
      cpf: employee.cpf?.toString() ?? null,
      birthDate: employee.birthDate?.toString() ?? null,
      features: employee.features,
      deletedAt: employee.deletedAt?.toISOString() ?? null,
      createdAt: employee.createdAt?.toISOString() ?? null,
      updatedAt: employee.updatedAt?.toISOString() ?? null,
    };
  }
}
```

- [ ] **Step 2: Update Swagger DTOs**

In `src/infra/http/docs/domain-swagger.dto.ts`, add `deletedAt` to `EmployeeDto` after `features`:

```ts
  @ApiProperty({
    type: String,
    example: null,
    nullable: true,
    format: "date-time",
  })
  deletedAt!: string | null;
```

Add these DTO classes after `RegisterEmployeeResponseDto`:

```ts
export class EmployeeResponseDto {
  @ApiProperty({ type: EmployeeDto })
  employee!: EmployeeDto;
}

export class ListEmployeesResponseDto {
  @ApiProperty({ type: EmployeeDto, isArray: true })
  employees!: EmployeeDto[];
}

export class UpdateEmployeeBodyDto {
  @ApiPropertyOptional({ example: "Ana Silva", minLength: 1 })
  name?: string;

  @ApiPropertyOptional({
    type: String,
    example: "1995-01-01T00:00:00.000Z",
    nullable: true,
    format: "date-time",
    description:
      "Optional birth date. Employees must be at least 18 years old when provided.",
  })
  birthDate?: string | null;

  @ApiPropertyOptional({
    enum: ALLOWED_EXTRA_EMPLOYEE_FEATURES,
    isArray: true,
    example: ["create:appointments", "update:employees:self"],
    description:
      "Optional business features. System-managed session features are not accepted.",
  })
  extraFeatures?: string[];
}
```

- [ ] **Step 3: Create get employee controller**

Create `src/infra/http/controllers/get-employee.controller.ts`:

```ts
import {
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";
import { GetEmployeeUseCase } from "../../../modules/application/use-cases/employee/get-employee";
import { NotAllowedError } from "../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { EmployeeFeatures } from "../../auth/employee-features";
import { Roles } from "../../auth/roles";
import { EmployeeResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { EmployeePresenter } from "../presenters/employee-presenter";

const employeeIdParamSchema = z.uuid();

@ApiTags("employees")
@ApiBearerAuth("access-token")
@Controller("/employees/:employeeId")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["read:employees:self"])
export class GetEmployeeController {
  constructor(private readonly getEmployee: GetEmployeeUseCase) {}

  @Get()
  @ApiOperation({ summary: "Get an employee by id." })
  @ApiParam({ name: "employeeId", format: "uuid" })
  @ApiOkResponse({ type: EmployeeResponseDto })
  @ApiBadRequestResponse({ description: "Invalid employee id." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({ description: "Missing employee feature." })
  @ApiNotFoundResponse({ description: "Employee not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected failure." })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("employeeId", new ZodValidationPipe(employeeIdParamSchema))
    employeeId: string,
  ) {
    const result = await this.getEmployee.execute({
      actor: {
        userId: user.userId,
        role: user.role,
      },
      employeeId,
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case NotAllowedError:
          throw new ForbiddenException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new InternalServerErrorException(error.message);
      }
    }

    return {
      employee: EmployeePresenter.toHTTP(result.value.employee),
    };
  }
}
```

- [ ] **Step 4: Create list employees controller**

Create `src/infra/http/controllers/list-employees.controller.ts`:

```ts
import {
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";
import { ListEmployeesUseCase } from "../../../modules/application/use-cases/employee/list-employees";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ListEmployeesResponseDto } from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { EmployeePresenter } from "../presenters/employee-presenter";

const listEmployeesQuerySchema = z.object({
  name: z.string().trim().optional(),
});

type ListEmployeesQuerySchema = z.infer<typeof listEmployeesQuerySchema>;

@ApiTags("employees")
@ApiBearerAuth("access-token")
@Controller("/employees")
@Roles(["ESTABLISHMENT"])
export class ListEmployeesController {
  constructor(private readonly listEmployees: ListEmployeesUseCase) {}

  @Get()
  @ApiOperation({ summary: "List active employees by establishment." })
  @ApiQuery({ name: "name", required: false, type: String })
  @ApiOkResponse({ type: ListEmployeesResponseDto })
  @ApiBadRequestResponse({ description: "Invalid query params." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({ description: "Authenticated user is not establishment." })
  @ApiNotFoundResponse({ description: "Establishment profile not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected failure." })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listEmployeesQuerySchema))
    query: ListEmployeesQuerySchema,
  ) {
    const result = await this.listEmployees.execute({
      establishmentOwnerId: user.userId,
      ...(query.name !== undefined ? { name: query.name } : {}),
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new InternalServerErrorException(error.message);
      }
    }

    return {
      employees: result.value.employees.map((employee) =>
        EmployeePresenter.toHTTP(employee),
      ),
    };
  }
}
```

- [ ] **Step 5: Create update employee controller**

Create `src/infra/http/controllers/update-employee.controller.ts`:

```ts
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";
import { UpdateEmployeeUseCase } from "../../../modules/application/use-cases/employee/update-employee";
import { InvalidRegisterEmployeeInputError } from "../../../modules/employees/domain/errors/invalid-register-employee-input-error";
import { ALLOWED_EXTRA_EMPLOYEE_FEATURES } from "../../../modules/employees/domain/policies/employee-features-policy";
import { NotAllowedError } from "../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { EmployeeFeatures } from "../../auth/employee-features";
import { Roles } from "../../auth/roles";
import {
  EmployeeResponseDto,
  UpdateEmployeeBodyDto,
} from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { EmployeePresenter } from "../presenters/employee-presenter";

const updateEmployeeBodySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    birthDate: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .optional()
      .nullable(),
    extraFeatures: z.array(z.enum(ALLOWED_EXTRA_EMPLOYEE_FEATURES)).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field must be provided.",
  );

type UpdateEmployeeBodySchema = z.infer<typeof updateEmployeeBodySchema>;
const employeeIdParamSchema = z.uuid();

@ApiTags("employees")
@ApiBearerAuth("access-token")
@Controller("/employees/:employeeId")
@Roles(["ESTABLISHMENT", "EMPLOYEE"])
@EmployeeFeatures(["update:employees:self"])
export class UpdateEmployeeController {
  constructor(private readonly updateEmployee: UpdateEmployeeUseCase) {}

  @Patch()
  @ApiOperation({ summary: "Update employee data." })
  @ApiParam({ name: "employeeId", format: "uuid" })
  @ApiBody({ type: UpdateEmployeeBodyDto })
  @ApiOkResponse({ type: EmployeeResponseDto })
  @ApiBadRequestResponse({ description: "Invalid payload." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({ description: "Missing employee feature." })
  @ApiNotFoundResponse({ description: "Employee not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected failure." })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("employeeId", new ZodValidationPipe(employeeIdParamSchema))
    employeeId: string,
    @Body(new ZodValidationPipe(updateEmployeeBodySchema))
    body: UpdateEmployeeBodySchema,
  ) {
    const result = await this.updateEmployee.execute({
      actor: {
        userId: user.userId,
        role: user.role,
      },
      employeeId,
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.birthDate !== undefined ? { birthDate: body.birthDate } : {}),
      ...(body.extraFeatures !== undefined
        ? { extraFeatures: body.extraFeatures }
        : {}),
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case NotAllowedError:
          throw new ForbiddenException(error.message);
        case InvalidRegisterEmployeeInputError:
          throw new BadRequestException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new BadRequestException(error.message);
      }
    }

    return {
      employee: EmployeePresenter.toHTTP(result.value.employee),
    };
  }
}
```

- [ ] **Step 6: Create delete employee controller**

Create `src/infra/http/controllers/delete-employee.controller.ts`:

```ts
import {
  Controller,
  Delete,
  HttpCode,
  InternalServerErrorException,
  NotFoundException,
  Param,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";
import { DeleteEmployeeUseCase } from "../../../modules/application/use-cases/employee/delete-employee";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

const employeeIdParamSchema = z.uuid();

@ApiTags("employees")
@ApiBearerAuth("access-token")
@Controller("/employees/:employeeId")
@Roles(["ESTABLISHMENT"])
export class DeleteEmployeeController {
  constructor(private readonly deleteEmployee: DeleteEmployeeUseCase) {}

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: "Soft-delete an employee." })
  @ApiParam({ name: "employeeId", format: "uuid" })
  @ApiNoContentResponse({ description: "Employee deleted successfully." })
  @ApiBadRequestResponse({ description: "Invalid employee id." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token." })
  @ApiForbiddenResponse({ description: "Authenticated user is not establishment." })
  @ApiNotFoundResponse({ description: "Employee not found." })
  @ApiInternalServerErrorResponse({ description: "Unexpected failure." })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("employeeId", new ZodValidationPipe(employeeIdParamSchema))
    employeeId: string,
  ) {
    const result = await this.deleteEmployee.execute({
      establishmentOwnerId: user.userId,
      employeeId,
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
        case UnexpectedDomainError:
          throw new InternalServerErrorException(error.message);
        default:
          throw new InternalServerErrorException(error.message);
      }
    }
  }
}
```

- [ ] **Step 7: Register controllers and use cases in HTTP module**

Modify `src/infra/http/http.module.ts`:

Add imports:

```ts
import { DeleteEmployeeUseCase } from "../../modules/application/use-cases/employee/delete-employee";
import { GetEmployeeUseCase } from "../../modules/application/use-cases/employee/get-employee";
import { ListEmployeesUseCase } from "../../modules/application/use-cases/employee/list-employees";
import { UpdateEmployeeUseCase } from "../../modules/application/use-cases/employee/update-employee";
import { DeleteEmployeeController } from "./controllers/delete-employee.controller";
import { GetEmployeeController } from "./controllers/get-employee.controller";
import { ListEmployeesController } from "./controllers/list-employees.controller";
import { UpdateEmployeeController } from "./controllers/update-employee.controller";
```

Add controllers after `RegisterEmployeeController`:

```ts
    GetEmployeeController,
    ListEmployeesController,
    UpdateEmployeeController,
    DeleteEmployeeController,
```

Add providers after `RegisterEmployeeUseCase`:

```ts
    GetEmployeeUseCase,
    ListEmployeesUseCase,
    UpdateEmployeeUseCase,
    DeleteEmployeeUseCase,
```

- [ ] **Step 8: Typecheck HTTP wiring**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit HTTP wiring**

Run:

```bash
git add src/infra/http/presenters/employee-presenter.ts src/infra/http/docs/domain-swagger.dto.ts src/infra/http/controllers/get-employee.controller.ts src/infra/http/controllers/list-employees.controller.ts src/infra/http/controllers/update-employee.controller.ts src/infra/http/controllers/delete-employee.controller.ts src/infra/http/http.module.ts
git commit -m "feat: expose employee management endpoints"
```

Expected: commit created.

## Task 7: E2E Coverage And Register Endpoint Updates

**Files:**

- Modify: `src/infra/http/controllers/register-employee.controller.e2e-spec.ts`
- Create: `src/infra/http/controllers/manage-employees.controller.e2e-spec.ts`
- Test: `src/infra/http/controllers/register-employee.controller.e2e-spec.ts`
- Test: `src/infra/http/controllers/manage-employees.controller.e2e-spec.ts`

- [ ] **Step 1: Update register employee e2e default features**

In `src/infra/http/controllers/register-employee.controller.e2e-spec.ts`, extend `employeeFeatureSchema` with:

```ts
  "read:employees:self",
  "create:sessions:self",
  "read:sessions:self",
  "update:employees:self",
```

Update required-field default expectations to:

```ts
expect(body.employee.features).toEqual([
  "read:appointments",
  "read:services",
  "read:customers",
  "read:employees:self",
  "create:sessions:self",
  "read:sessions:self",
]);
```

Update optional-field expectations with extras to:

```ts
expect(body.employee.features).toEqual([
  "read:appointments",
  "read:services",
  "read:customers",
  "read:employees:self",
  "create:sessions:self",
  "read:sessions:self",
  "create:appointments",
  "update:customers",
]);
```

Add `deletedAt: z.string().nullable()` to the employee response schema and assert `body.employee.deletedAt` is `null` in creation tests.

- [ ] **Step 2: Add manage employees e2e tests**

Create `src/infra/http/controllers/manage-employees.controller.e2e-spec.ts`:

```ts
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";
import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  getHttpServer,
  loginUser,
  makeCustomerAccessToken,
  makeEstablishmentAccessToken,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

const employeeFeatureSchema = z.enum([
  "read:appointments",
  "read:services",
  "read:customers",
  "read:employees:self",
  "create:sessions:self",
  "read:sessions:self",
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
]);

const employeeSchema = z.object({
  id: z.uuid(),
  establishmentId: z.uuid(),
  userId: z.uuid(),
  profileImageUrl: z.string().nullable(),
  name: z.string(),
  cpf: z.string().nullable(),
  birthDate: z.string().nullable(),
  features: z.array(employeeFeatureSchema),
  deletedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

const employeeResponseSchema = z.object({
  employee: employeeSchema,
});

const listEmployeesResponseSchema = z.object({
  employees: z.array(employeeSchema),
});

function employeePayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Ana Silva",
    email: `employee-${randomUUID()}@example.com`,
    password: "strong-password",
    birthDate: "1995-01-01T00:00:00.000Z",
    extraFeatures: ["update:employees:self"],
    ...overrides,
  };
}

async function createEmployee(accessToken: string, app: INestApplication) {
  const response = await request(getHttpServer(app))
    .post("/employees")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(employeePayload());

  expect(response.status).toBe(201);
  return employeeResponseSchema.parse(response.body).employee;
}

describe("Manage employees controller (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userFactory: UserFactory;
  let establishmentFactory: EstablishmentFactory;
  let envService: EnvService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get(PrismaService);
    userFactory = new UserFactory(prisma, moduleRef.get(HashGenerator));
    establishmentFactory = new EstablishmentFactory(prisma);
    envService = moduleRef.get(EnvService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should get, list, update, and soft-delete employees as establishment", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const ana = await createEmployee(accessToken, app);
    const biaResponse = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        employeePayload({
          name: "Beatriz Souza",
          email: `beatriz-${randomUUID()}@example.com`,
          extraFeatures: [],
        }),
      );
    const bia = employeeResponseSchema.parse(biaResponse.body).employee;

    const getResponse = await request(getHttpServer(app))
      .get(`/employees/${ana.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const listResponse = await request(getHttpServer(app))
      .get("/employees")
      .query({ name: "bia" })
      .set("Authorization", `Bearer ${accessToken}`);
    const updateResponse = await request(getHttpServer(app))
      .patch(`/employees/${ana.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Ana Updated",
        birthDate: null,
        extraFeatures: ["create:appointments"],
      });
    const deleteResponse = await request(getHttpServer(app))
      .delete(`/employees/${ana.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const afterDeleteGetResponse = await request(getHttpServer(app))
      .get(`/employees/${ana.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const deletedEmployee = await prisma.employee.findUnique({
      where: { id: ana.id },
    });

    expect(getResponse.status).toBe(200);
    expect(employeeResponseSchema.parse(getResponse.body).employee.id).toBe(
      ana.id,
    );
    expect(listResponse.status).toBe(200);
    expect(listEmployeesResponseSchema.parse(listResponse.body).employees).toEqual([
      expect.objectContaining({ id: bia.id, name: "Beatriz Souza" }),
    ]);
    expect(updateResponse.status).toBe(200);
    expect(employeeResponseSchema.parse(updateResponse.body).employee).toEqual(
      expect.objectContaining({
        id: ana.id,
        name: "Ana Updated",
        birthDate: null,
      }),
    );
    expect(deleteResponse.status).toBe(204);
    expect(deletedEmployee?.deletedAt).toBeInstanceOf(Date);
    expect(deletedEmployee?.features).not.toContain("create:sessions:self");
    expect(deletedEmployee?.features).not.toContain("read:sessions:self");
    expect(afterDeleteGetResponse.status).toBe(404);
  });

  it("should allow employee self get and self update without feature updates", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const employee = await createEmployee(accessToken, app);
    const employeeUser = await prisma.user.findUniqueOrThrow({
      where: { id: employee.userId },
    });
    const login = await loginUser({
      app,
      prisma,
      userId: employee.userId,
      email: employeeUser.email,
      password: "strong-password",
    });

    const getResponse = await request(getHttpServer(app))
      .get(`/employees/${employee.id}`)
      .set("Authorization", `Bearer ${login.loginBody.accessToken}`);
    const updateResponse = await request(getHttpServer(app))
      .patch(`/employees/${employee.id}`)
      .set("Authorization", `Bearer ${login.loginBody.accessToken}`)
      .send({ name: "Self Updated" });
    const featureUpdateResponse = await request(getHttpServer(app))
      .patch(`/employees/${employee.id}`)
      .set("Authorization", `Bearer ${login.loginBody.accessToken}`)
      .send({ extraFeatures: ["delete:customers"] });

    expect(getResponse.status).toBe(200);
    expect(updateResponse.status).toBe(200);
    expect(employeeResponseSchema.parse(updateResponse.body).employee.name).toBe(
      "Self Updated",
    );
    expect(featureUpdateResponse.status).toBe(403);
  });

  it("should block employee requests after delete", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const employee = await createEmployee(accessToken, app);
    const employeeUser = await prisma.user.findUniqueOrThrow({
      where: { id: employee.userId },
    });
    const login = await loginUser({
      app,
      prisma,
      userId: employee.userId,
      email: employeeUser.email,
      password: "strong-password",
    });

    const deleteResponse = await request(getHttpServer(app))
      .delete(`/employees/${employee.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const blockedGetResponse = await request(getHttpServer(app))
      .get(`/employees/${employee.id}`)
      .set("Authorization", `Bearer ${login.loginBody.accessToken}`);
    const blockedLoginResponse = await request(getHttpServer(app))
      .post("/auth/login")
      .send({ email: employeeUser.email, password: "strong-password" });

    expect(deleteResponse.status).toBe(204);
    expect(blockedGetResponse.status).toBe(401);
    expect(blockedLoginResponse.status).toBe(400);
  });

  it("should enforce roles and establishment ownership", async () => {
    const firstOwner = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const secondOwner = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const customer = await makeCustomerAccessToken({
      app,
      prisma,
      userFactory,
    });
    const employee = await createEmployee(firstOwner.accessToken, app);

    const customerListResponse = await request(getHttpServer(app))
      .get("/employees")
      .set("Authorization", `Bearer ${customer.accessToken}`);
    const crossGetResponse = await request(getHttpServer(app))
      .get(`/employees/${employee.id}`)
      .set("Authorization", `Bearer ${secondOwner.accessToken}`);
    const invalidUuidResponse = await request(getHttpServer(app))
      .get("/employees/not-a-uuid")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`);

    expect(customerListResponse.status).toBe(403);
    expect(crossGetResponse.status).toBe(404);
    expect(invalidUuidResponse.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run employee e2e tests**

Run:

```bash
npm run test:e2e -- src/infra/http/controllers/register-employee.controller.e2e-spec.ts src/infra/http/controllers/manage-employees.controller.e2e-spec.ts
```

Expected: PASS. The e2e global setup runs `npx prisma migrate reset --force` against the test database before the test suite, so the new migration should be applied automatically.

- [ ] **Step 4: Verify helper exports for e2e additions**

Run:

```bash
rg -n "export async function loginUser" tests/helpers/auth-session.e2e-helpers.ts
```

Expected: output contains `export async function loginUser`.

- [ ] **Step 5: Re-run e2e tests**

Run:

```bash
npm run test:e2e -- src/infra/http/controllers/register-employee.controller.e2e-spec.ts src/infra/http/controllers/manage-employees.controller.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit e2e coverage**

Run:

```bash
git add src/infra/http/controllers/register-employee.controller.e2e-spec.ts src/infra/http/controllers/manage-employees.controller.e2e-spec.ts tests/helpers/auth-session.e2e-helpers.ts
git commit -m "test: cover employee management endpoints"
```

Expected: commit created.

## Task 8: Final Verification

**Files:**

- Verify: all changed files

- [ ] **Step 1: Run unit tests for changed areas**

Run:

```bash
npm run test -- src/modules/employees/domain src/modules/application/use-cases/employee src/modules/application/use-cases/auth/login-with-credentials.spec.ts src/modules/application/use-cases/auth/refresh-session.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run e2e tests for employee endpoints**

Run:

```bash
npm run test:e2e -- src/infra/http/controllers/register-employee.controller.e2e-spec.ts src/infra/http/controllers/manage-employees.controller.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Run format check**

Run:

```bash
npm run format:check
```

Expected: PASS.

- [ ] **Step 6: Inspect final diff**

Run:

```bash
git status --short
git log --oneline -8
```

Expected: working tree contains only intentional changes if commits were skipped, or clean if every task commit was created.

## Self-Review Checklist

- Spec coverage: the plan covers `deletedAt`, soft delete, session feature removal, `@EmployeeFeatures`, login/refresh/access-session checks, update, delete, get, list, Prisma migration, DTOs, presenter, and tests.
- Placeholder scan: no task contains deferred-work wording or unresolved placeholders.
- Type consistency: the plan consistently uses `read:employees:self`, `update:employees:self`, `create:sessions:self`, `read:sessions:self`, `employeeId`, `extraFeatures`, `deletedAt`, and `EmployeeSessionAccessService`.
- Risk note: e2e migration handling depends on the repository's existing test database workflow. If `deleted_at` is missing during e2e, apply the project migration workflow and rerun the same test command.
