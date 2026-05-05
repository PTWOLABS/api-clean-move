# Register Employee Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the domain, application, Prisma, and HTTP flow for an authenticated establishment to register an employee account.

**Architecture:** Implement employee registration as a domain-first flow: `RegisterEmployeeUseCase` creates a `User` with role `EMPLOYEE` and an `Employee` aggregate inside one `UnitOfWork`. Employee birth date and feature rules live in domain value objects/policies, while Prisma and HTTP layers map to those domain contracts.

**Tech Stack:** Node.js 22, TypeScript, NestJS, Prisma 7, PostgreSQL, Zod, Vitest, Supertest.

---

## Scope Check

This is one implementation plan because the domain entity, use case, repository contract, Prisma mapper/repository, controller, presenter, Swagger DTOs, and tests are tightly coupled around one endpoint: `POST /employees`. The plan does not add employee update/list/delete, feature-based authorization guards, invitations, or profile image upload.

## File Structure

Create:

- `src/modules/employees/domain/errors/invalid-register-employee-input-error.ts`: domain/application error wrapper for invalid employee registration input.
- `src/modules/employees/domain/value-objects/birth-date.ts`: validates employee birth date rules.
- `src/modules/employees/domain/value-objects/birth-date.spec.ts`: birth date value object tests.
- `src/modules/employees/domain/policies/employee-features-policy.ts`: default and allowed extra feature policy.
- `src/modules/employees/domain/policies/employee-features-policy.spec.ts`: feature policy tests.
- `src/modules/employees/domain/entities/employee.ts`: employee aggregate.
- `src/modules/employees/domain/entities/employee.spec.ts`: employee entity tests.
- `src/modules/application/repositories/employees-repository.ts`: employee repository contract.
- `tests/repositories/in-memory-employees-repository.ts`: in-memory employee repository for use case tests.
- `tests/factories/employee-factory.ts`: employee test factory.
- `src/modules/application/use-cases/employee/register-employee.ts`: employee registration use case.
- `src/modules/application/use-cases/employee/register-employee.spec.ts`: use case tests.
- `src/infra/database/prisma/mappers/prisma-employee-mapper.ts`: Prisma/domain mapper.
- `src/infra/database/prisma/repositories/prisma-employees-repository.ts`: Prisma employee repository.
- `src/infra/http/presenters/employee-presenter.ts`: HTTP response presenter.
- `src/infra/http/controllers/register-employee.controller.ts`: `POST /employees`.
- `src/infra/http/controllers/register-employee.controller.e2e-spec.ts`: endpoint tests.

Modify:

- `src/infra/database/database.module.ts`: bind `EmployeesRepository` to `PrismaEmployeesRepository`.
- `src/infra/http/docs/domain-swagger.dto.ts`: add employee request/response DTOs.
- `src/infra/http/http.module.ts`: register the controller and use case.

No Prisma schema migration is needed because `Employee` already exists in `prisma/schema.prisma`.

## Task 1: BirthDate Value Object

**Files:**

- Create: `src/modules/employees/domain/value-objects/birth-date.spec.ts`
- Create: `src/modules/employees/domain/value-objects/birth-date.ts`

- [ ] **Step 1: Write the failing BirthDate tests**

Create `src/modules/employees/domain/value-objects/birth-date.spec.ts`:

```ts
import { BirthDate, InvalidBirthDateError } from "./birth-date";

describe("BirthDate", () => {
  const referenceDate = new Date("2026-05-04T12:00:00.000Z");

  it("should create a valid adult birth date", () => {
    const birthDate = BirthDate.create(new Date("1995-01-01T00:00:00.000Z"), {
      referenceDate,
    });

    expect(birthDate.value).toEqual(new Date("1995-01-01T00:00:00.000Z"));
    expect(birthDate.toDate()).toEqual(new Date("1995-01-01T00:00:00.000Z"));
    expect(birthDate.toString()).toBe("1995-01-01T00:00:00.000Z");
  });

  it("should reject a birth date before 1900", () => {
    expect(() =>
      BirthDate.create(new Date("1899-12-31T00:00:00.000Z"), {
        referenceDate,
      }),
    ).toThrow(InvalidBirthDateError);
  });

  it("should reject a future birth date", () => {
    expect(() =>
      BirthDate.create(new Date("2026-05-05T00:00:00.000Z"), {
        referenceDate,
      }),
    ).toThrow(InvalidBirthDateError);
  });

  it("should reject a minor by default", () => {
    expect(() =>
      BirthDate.create(new Date("2010-05-04T00:00:00.000Z"), {
        referenceDate,
      }),
    ).toThrow(InvalidBirthDateError);
  });

  it("should allow a minor when mustBeAdult is false", () => {
    const birthDate = BirthDate.create(new Date("2010-05-04T00:00:00.000Z"), {
      mustBeAdult: false,
      referenceDate,
    });

    expect(birthDate.toString()).toBe("2010-05-04T00:00:00.000Z");
  });

  it("should compare birth dates by value", () => {
    const first = BirthDate.create(new Date("1995-01-01T00:00:00.000Z"), {
      referenceDate,
    });
    const second = BirthDate.create(new Date("1995-01-01T15:30:00.000Z"), {
      referenceDate,
    });

    expect(first.equals(second)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the BirthDate tests and verify they fail**

Run:

```bash
npm run test -- src/modules/employees/domain/value-objects/birth-date.spec.ts
```

Expected: FAIL with an import error for `./birth-date`.

- [ ] **Step 3: Implement BirthDate**

Create `src/modules/employees/domain/value-objects/birth-date.ts`:

```ts
import { ValueObject } from "../../../../shared/entities/value-object";

type BirthDateProps = {
  value: Date;
};

export type BirthDateCreateOptions = {
  mustBeAdult?: boolean;
  referenceDate?: Date;
};

export class InvalidBirthDateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBirthDateError";
  }
}

export class BirthDate extends ValueObject<BirthDateProps> {
  private constructor(props: BirthDateProps) {
    super(props);
  }

  get value() {
    return new Date(this.props.value);
  }

  static create(value: Date, options: BirthDateCreateOptions = {}) {
    if (Number.isNaN(value.getTime())) {
      throw new InvalidBirthDateError("Invalid birth date.");
    }

    const mustBeAdult = options.mustBeAdult ?? true;
    const referenceDate = BirthDate.startOfDay(
      options.referenceDate ?? new Date(),
    );
    const birthDate = BirthDate.startOfDay(value);
    const minimumDate = new Date(Date.UTC(1900, 0, 1));

    if (birthDate < minimumDate) {
      throw new InvalidBirthDateError(
        "Birth date cannot be before 1900-01-01.",
      );
    }

    if (birthDate > referenceDate) {
      throw new InvalidBirthDateError("Birth date cannot be in the future.");
    }

    if (mustBeAdult && !BirthDate.isAdultAt(birthDate, referenceDate)) {
      throw new InvalidBirthDateError(
        "Employee must be at least 18 years old.",
      );
    }

    return new BirthDate({ value: birthDate });
  }

  toDate() {
    return new Date(this.props.value);
  }

  toString() {
    return this.props.value.toISOString();
  }

  equals(other: BirthDate) {
    return other.toString() === this.toString();
  }

  private static startOfDay(value: Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  private static isAdultAt(birthDate: Date, referenceDate: Date) {
    const adultDate = new Date(birthDate);
    adultDate.setUTCFullYear(adultDate.getUTCFullYear() + 18);

    return adultDate <= referenceDate;
  }
}
```

- [ ] **Step 4: Run the BirthDate tests and verify they pass**

Run:

```bash
npm run test -- src/modules/employees/domain/value-objects/birth-date.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit BirthDate**

Run:

```bash
git add src/modules/employees/domain/value-objects/birth-date.ts src/modules/employees/domain/value-objects/birth-date.spec.ts
git commit -m "feat: add employee birth date value object"
```

Expected: commit created.

## Task 2: Employee Features Policy

**Files:**

- Create: `src/modules/employees/domain/policies/employee-features-policy.spec.ts`
- Create: `src/modules/employees/domain/policies/employee-features-policy.ts`

- [ ] **Step 1: Write the failing employee features policy tests**

Create `src/modules/employees/domain/policies/employee-features-policy.spec.ts`:

```ts
import {
  DEFAULT_EMPLOYEE_FEATURES,
  EmployeeFeaturesPolicy,
  InvalidEmployeeFeatureError,
} from "./employee-features-policy";

describe("EmployeeFeaturesPolicy", () => {
  it("should return only default features when no extra feature is provided", () => {
    const features = EmployeeFeaturesPolicy.build();

    expect(features).toEqual(DEFAULT_EMPLOYEE_FEATURES);
  });

  it("should add allowed extra features after defaults", () => {
    const features = EmployeeFeaturesPolicy.build([
      "update:customers",
      "create:appointments",
    ]);

    expect(features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "create:appointments",
      "update:customers",
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
      "create:appointments",
      "delete:services",
    ]);
  });

  it("should reject default features sent as extras", () => {
    expect(() => EmployeeFeaturesPolicy.build(["read:appointments"])).toThrow(
      InvalidEmployeeFeatureError,
    );
  });

  it("should reject unknown features", () => {
    expect(() => EmployeeFeaturesPolicy.build(["approve:payments"])).toThrow(
      InvalidEmployeeFeatureError,
    );
  });

  it("should validate persisted final employee features", () => {
    const features = EmployeeFeaturesPolicy.normalizePersisted([
      "read:appointments",
      "read:services",
      "read:customers",
      "create:services",
    ]);

    expect(features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "create:services",
    ]);
  });
});
```

- [ ] **Step 2: Run the policy tests and verify they fail**

Run:

```bash
npm run test -- src/modules/employees/domain/policies/employee-features-policy.spec.ts
```

Expected: FAIL with an import error for `./employee-features-policy`.

- [ ] **Step 3: Implement employee features policy**

Create `src/modules/employees/domain/policies/employee-features-policy.ts`:

```ts
export const DEFAULT_EMPLOYEE_FEATURES = [
  "read:appointments",
  "read:services",
  "read:customers",
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
] as const;

export const ALLOWED_EMPLOYEE_FEATURES = [
  ...DEFAULT_EMPLOYEE_FEATURES,
  ...ALLOWED_EXTRA_EMPLOYEE_FEATURES,
] as const;

export type DefaultEmployeeFeature = (typeof DEFAULT_EMPLOYEE_FEATURES)[number];
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

    return [...features];
  }

  static isEmployeeFeature(feature: string): feature is EmployeeFeature {
    return (ALLOWED_EMPLOYEE_FEATURES as readonly string[]).includes(feature);
  }
}
```

- [ ] **Step 4: Run the policy tests and verify they pass**

Run:

```bash
npm run test -- src/modules/employees/domain/policies/employee-features-policy.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit employee features policy**

Run:

```bash
git add src/modules/employees/domain/policies/employee-features-policy.ts src/modules/employees/domain/policies/employee-features-policy.spec.ts
git commit -m "feat: add employee features policy"
```

Expected: commit created.

## Task 3: Employee Entity

**Files:**

- Create: `src/modules/employees/domain/errors/invalid-register-employee-input-error.ts`
- Create: `src/modules/employees/domain/entities/employee.spec.ts`
- Create: `src/modules/employees/domain/entities/employee.ts`

- [ ] **Step 1: Write the failing employee entity tests**

Create `src/modules/employees/domain/entities/employee.spec.ts`:

```ts
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Cpf } from "../../../accounts/domain/value-objects/cpf";
import { InvalidRegisterEmployeeInputError } from "../errors/invalid-register-employee-input-error";
import { BirthDate } from "../value-objects/birth-date";
import { Employee } from "./employee";

describe("Employee", () => {
  const referenceDate = new Date("2026-05-04T12:00:00.000Z");

  it("should create an employee with normalized values", () => {
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
    expect(employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
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
    ]);
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
    employee.replaceFeatures(["delete:services"]);

    expect(employee.name).toBe("Beatriz Souza");
    expect(employee.cpf?.toString()).toBe("52998224725");
    expect(employee.birthDate?.equals(birthDate)).toBe(true);
    expect(employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "delete:services",
    ]);
  });
});
```

- [ ] **Step 2: Run the employee entity tests and verify they fail**

Run:

```bash
npm run test -- src/modules/employees/domain/entities/employee.spec.ts
```

Expected: FAIL with import errors for `./employee` and `../errors/invalid-register-employee-input-error`.

- [ ] **Step 3: Add the invalid employee registration input error**

Create `src/modules/employees/domain/errors/invalid-register-employee-input-error.ts`:

```ts
export class InvalidRegisterEmployeeInputError extends Error {
  constructor(message = "Invalid employee registration input.") {
    super(message);
    this.name = "InvalidRegisterEmployeeInputError";
  }
}
```

- [ ] **Step 4: Implement the Employee entity**

Create `src/modules/employees/domain/entities/employee.ts`:

```ts
import { AggregateRoot } from "../../../../shared/entities/aggregate-root";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Cpf } from "../../../accounts/domain/value-objects/cpf";
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
        profileImageUrl: props.profileImageUrl ?? null,
        name: Employee.normalizeRequiredText(props.name, "name"),
        cpf: Employee.normalizeCpf(props.cpf ?? null),
        birthDate: Employee.normalizeBirthDate(props.birthDate ?? null),
        features: EmployeeFeaturesPolicy.build(props.extraFeatures ?? []),
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

  changeName(name: string) {
    const normalizedName = Employee.normalizeRequiredText(name, "name");

    if (this.props.name === normalizedName) {
      return;
    }

    this.props.name = normalizedName;
    this.touch();
  }

  changeCpf(cpf: Cpf | null) {
    if (this.props.cpf?.equals(cpf as Cpf) || this.props.cpf === cpf) {
      return;
    }

    this.props.cpf = cpf;
    this.touch();
  }

  changeBirthDate(birthDate: BirthDate | null) {
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
    this.props.features = EmployeeFeaturesPolicy.build(extraFeatures);
    this.touch();
  }

  touch() {
    this.props.updatedAt = new Date();
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
}
```

- [ ] **Step 5: Run the employee entity tests and verify they pass**

Run:

```bash
npm run test -- src/modules/employees/domain/entities/employee.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Employee entity**

Run:

```bash
git add src/modules/employees/domain/errors/invalid-register-employee-input-error.ts src/modules/employees/domain/entities/employee.ts src/modules/employees/domain/entities/employee.spec.ts
git commit -m "feat: add employee domain entity"
```

Expected: commit created.

## Task 4: Employee Repository Contract And Test Helpers

**Files:**

- Create: `src/modules/application/repositories/employees-repository.ts`
- Create: `tests/repositories/in-memory-employees-repository.ts`

- [ ] **Step 1: Add the employee repository contract**

Create `src/modules/application/repositories/employees-repository.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { Employee } from "../../employees/domain/entities/employee";

@Injectable()
export abstract class EmployeesRepository {
  abstract create(employee: Employee): Promise<void>;
  abstract findByUserId(userId: string): Promise<Employee | null>;
}
```

- [ ] **Step 2: Add the in-memory employee repository**

Create `tests/repositories/in-memory-employees-repository.ts`:

```ts
import { EmployeesRepository } from "../../src/modules/application/repositories/employees-repository";
import { Employee } from "../../src/modules/employees/domain/entities/employee";

export class InMemoryEmployeesRepository implements EmployeesRepository {
  public items: Employee[] = [];

  async create(employee: Employee): Promise<void> {
    this.items.push(employee);
  }

  async findByUserId(userId: string): Promise<Employee | null> {
    const employee = this.items.find(
      (item) => item.userId.toString() === userId,
    );

    return employee ?? null;
  }
}
```

- [ ] **Step 3: Run typecheck and verify the repository contract compiles**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit repository contract and in-memory helper**

Run:

```bash
git add src/modules/application/repositories/employees-repository.ts tests/repositories/in-memory-employees-repository.ts
git commit -m "feat: add employee repository contract"
```

Expected: commit created.

## Task 5: RegisterEmployee Use Case

**Files:**

- Create: `src/modules/application/use-cases/employee/register-employee.spec.ts`
- Create: `src/modules/application/use-cases/employee/register-employee.ts`

- [ ] **Step 1: Write the failing RegisterEmployee use case tests**

Create `src/modules/application/use-cases/employee/register-employee.spec.ts`:

```ts
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { FakeHashGenerator } from "../../../../../tests/repositories/fake-hash-generator";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { InMemoryUnitOfWork } from "../../../../../tests/repositories/in-memory-unit-of-work";
import { InMemoryUsersRepository } from "../../../../../tests/repositories/in-memory-users-repository";
import { Email } from "../../../accounts/domain/value-objects/email";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { InvalidRegisterEmployeeInputError } from "../../../employees/domain/errors/invalid-register-employee-input-error";
import { RegisterEmployeeUseCase } from "./register-employee";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryEmployeesRepository: InMemoryEmployeesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let fakeHashGenerator: FakeHashGenerator;
let inMemoryUnitOfWork: InMemoryUnitOfWork;
let sut: RegisterEmployeeUseCase;

function minorBirthDate() {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - 10);
  date.setUTCHours(0, 0, 0, 0);

  return date;
}

describe("Register employee", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryEmployeesRepository = new InMemoryEmployeesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      new InMemoryServicesRepository(),
    );
    fakeHashGenerator = new FakeHashGenerator();
    inMemoryUnitOfWork = new InMemoryUnitOfWork();

    sut = new RegisterEmployeeUseCase(
      inMemoryUsersRepository,
      inMemoryEmployeesRepository,
      inMemoryEstablishmentsRepository,
      fakeHashGenerator,
      inMemoryUnitOfWork,
    );
  });

  it("should register an employee with required fields", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      name: "Ana Silva",
      email: "ana@example.com",
      password: "strong-password",
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(inMemoryUsersRepository.items).toHaveLength(1);
    expect(inMemoryEmployeesRepository.items).toHaveLength(1);
    expect(inMemoryUsersRepository.items[0]?.role).toBe("EMPLOYEE");
    expect(inMemoryUsersRepository.items[0]?.name).toBe("Ana Silva");
    expect(inMemoryUsersRepository.items[0]?.email.toString()).toBe(
      "ana@example.com",
    );
    expect(inMemoryUsersRepository.items[0]?.hashedPassword).toBe(
      "strong-password-hashed",
    );
    expect(result.value.employee.establishmentId).toBe(establishment.id);
    expect(result.value.employee.userId).toBe(
      inMemoryUsersRepository.items[0]?.id,
    );
    expect(result.value.employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
    ]);
  });

  it("should register an employee with optional fields and extra features", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      name: "Ana Silva",
      email: "ana.optional@example.com",
      password: "strong-password",
      cpf: "529.982.247-25",
      birthDate: new Date("1995-01-01T00:00:00.000Z"),
      extraFeatures: ["update:customers", "create:appointments"],
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.employee.cpf?.toString()).toBe("52998224725");
    expect(result.value.employee.birthDate?.toString()).toBe(
      "1995-01-01T00:00:00.000Z",
    );
    expect(result.value.employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "create:appointments",
      "update:customers",
    ]);
  });

  it("should reject duplicate employee email", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryUsersRepository.create(
      makeUser("EMPLOYEE", {
        email: new Email("ana@example.com"),
      }),
    );

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      name: "Ana Silva",
      email: "ana@example.com",
      password: "strong-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceAlreadyExistsError);
    expect(inMemoryEmployeesRepository.items).toHaveLength(0);
  });

  it("should reject an establishment owner without establishment profile", async () => {
    const owner = makeUser("ESTABLISHMENT");

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      name: "Ana Silva",
      email: "ana@example.com",
      password: "strong-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it.each([
    {
      field: "email",
      request: {
        email: "invalid-email",
      },
    },
    {
      field: "cpf",
      request: {
        cpf: "11111111111",
      },
    },
    {
      field: "birthDate",
      request: {
        birthDate: minorBirthDate(),
      },
    },
    {
      field: "extraFeatures",
      request: {
        extraFeatures: ["read:appointments"],
      },
    },
  ])("should reject invalid $field", async ({ request }) => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      name: "Ana Silva",
      email: "ana@example.com",
      password: "strong-password",
      ...request,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidRegisterEmployeeInputError);
    expect(inMemoryEmployeesRepository.items).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the use case tests and verify they fail**

Run:

```bash
npm run test -- src/modules/application/use-cases/employee/register-employee.spec.ts
```

Expected: FAIL with an import error for `./register-employee`.

- [ ] **Step 3: Implement RegisterEmployee use case**

Create `src/modules/application/use-cases/employee/register-employee.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { Either, left, right } from "../../../../shared/either";
import { PersistenceError } from "../../../../shared/errors/persistence-error";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { UniqueConstraintViolationError } from "../../../../shared/errors/unique-constraint-violation-error";
import { User } from "../../../accounts/domain/entities/user";
import {
  Email,
  InvalidEmailError,
} from "../../../accounts/domain/value-objects/email";
import {
  InvalidCpfError,
  Cpf,
} from "../../../accounts/domain/value-objects/cpf";
import { UserRole } from "../../../accounts/domain/value-objects/user-role";
import { Employee } from "../../../employees/domain/entities/employee";
import { InvalidRegisterEmployeeInputError } from "../../../employees/domain/errors/invalid-register-employee-input-error";
import {
  EmployeeFeaturesPolicy,
  InvalidEmployeeFeatureError,
} from "../../../employees/domain/policies/employee-features-policy";
import {
  BirthDate,
  InvalidBirthDateError,
} from "../../../employees/domain/value-objects/birth-date";
import { EmployeesRepository } from "../../repositories/employees-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import { HashGenerator } from "../../repositories/hash-generator";
import { UnitOfWork } from "../../repositories/unit-of-work";
import { UsersRepository } from "../../repositories/users-repository";

type RegisterEmployeeUseCaseRequest = {
  establishmentOwnerId: string;
  name: string;
  email: string;
  password: string;
  cpf?: string | null;
  birthDate?: Date | null;
  extraFeatures?: string[];
};

type RegisterEmployeeUseCaseResponse = Either<
  | ResourceAlreadyExistsError
  | ResourceNotFoundError
  | InvalidRegisterEmployeeInputError
  | UnexpectedDomainError,
  {
    employee: Employee;
  }
>;

@Injectable()
export class RegisterEmployeeUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private employeesRepository: EmployeesRepository,
    private establishmentsRepository: EstablishmentsRepository,
    private hashGenerator: HashGenerator,
    private unitOfWork: UnitOfWork,
  ) {}

  async execute({
    establishmentOwnerId,
    name,
    email: rawEmail,
    password,
    cpf: rawCpf = null,
    birthDate: rawBirthDate = null,
    extraFeatures = [],
  }: RegisterEmployeeUseCaseRequest): Promise<RegisterEmployeeUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "Establishment" }));
    }

    let email: Email;
    let cpf: Cpf | null;
    let birthDate: BirthDate | null;

    try {
      email = new Email(rawEmail);
      cpf = rawCpf ? Cpf.create(rawCpf) : null;
      birthDate = rawBirthDate ? BirthDate.create(rawBirthDate) : null;
      EmployeeFeaturesPolicy.build(extraFeatures);
    } catch (error) {
      if (
        error instanceof InvalidEmailError ||
        error instanceof InvalidCpfError ||
        error instanceof InvalidBirthDateError ||
        error instanceof InvalidEmployeeFeatureError ||
        error instanceof InvalidRegisterEmployeeInputError
      ) {
        return left(new InvalidRegisterEmployeeInputError(error.message));
      }

      return left(new UnexpectedDomainError());
    }

    let userWithTheSameEmail: User | null;

    try {
      userWithTheSameEmail = await this.usersRepository.findByEmail(
        email.toString(),
      );
    } catch (error) {
      if (error instanceof PersistenceError) {
        return left(new UnexpectedDomainError());
      }

      return left(new UnexpectedDomainError());
    }

    if (userWithTheSameEmail) {
      return left(
        new ResourceAlreadyExistsError("Employee already registered."),
      );
    }

    const userRole: UserRole = "EMPLOYEE";
    const hashedPassword = await this.hashGenerator.hash(password);

    const user = User.create({
      name,
      email,
      hashedPassword,
      role: userRole,
      phone: null,
      address: null,
    });

    let employee: Employee;

    try {
      employee = Employee.create({
        establishmentId: establishment.id,
        userId: user.id,
        name,
        cpf,
        birthDate,
        extraFeatures,
      });
    } catch (error) {
      if (
        error instanceof InvalidCpfError ||
        error instanceof InvalidBirthDateError ||
        error instanceof InvalidEmployeeFeatureError ||
        error instanceof InvalidRegisterEmployeeInputError
      ) {
        return left(new InvalidRegisterEmployeeInputError(error.message));
      }

      return left(new UnexpectedDomainError());
    }

    try {
      await this.unitOfWork.execute(async () => {
        await this.usersRepository.create(user);
        await this.employeesRepository.create(employee);
      });
    } catch (error) {
      if (error instanceof UniqueConstraintViolationError) {
        return left(
          new ResourceAlreadyExistsError("Employee already registered."),
        );
      }

      if (error instanceof PersistenceError) {
        return left(new UnexpectedDomainError());
      }

      return left(new UnexpectedDomainError());
    }

    return right({
      employee,
    });
  }
}
```

- [ ] **Step 4: Run the use case tests and verify they pass**

Run:

```bash
npm run test -- src/modules/application/use-cases/employee/register-employee.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit RegisterEmployee use case**

Run:

```bash
git add src/modules/application/use-cases/employee/register-employee.ts src/modules/application/use-cases/employee/register-employee.spec.ts
git commit -m "feat: add register employee use case"
```

Expected: commit created.

## Task 6: Prisma Employee Persistence

**Files:**

- Create: `src/infra/database/prisma/mappers/prisma-employee-mapper.ts`
- Create: `src/infra/database/prisma/repositories/prisma-employees-repository.ts`
- Create: `tests/factories/employee-factory.ts`
- Modify: `src/infra/database/database.module.ts`

- [ ] **Step 1: Add Prisma employee mapper**

Create `src/infra/database/prisma/mappers/prisma-employee-mapper.ts`:

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
      createdAt: raw.createdAt ?? undefined,
      updatedAt: raw.updatedAt ?? undefined,
    };
  }
}
```

- [ ] **Step 2: Add the employee factory**

Create `tests/factories/employee-factory.ts`:

```ts
import { PrismaEmployeeMapper } from "../../src/infra/database/prisma/mappers/prisma-employee-mapper";
import { PrismaService } from "../../src/infra/database/prisma/prisma.service";
import {
  Employee,
  EmployeeCreateProps,
} from "../../src/modules/employees/domain/entities/employee";
import { UniqueEntityId } from "../../src/shared/entities/unique-entity-id";
import { makeFullName } from "./random-data";

export function makeEmployee(
  override?: Partial<EmployeeCreateProps>,
  id?: UniqueEntityId,
) {
  return Employee.create(
    {
      establishmentId: new UniqueEntityId(),
      userId: new UniqueEntityId(),
      name: makeFullName(),
      ...override,
    },
    id,
  );
}

export class EmployeeFactory {
  constructor(private prisma: PrismaService) {}

  async makePrismaEmployee(
    data?: Partial<EmployeeCreateProps>,
    id?: UniqueEntityId,
  ) {
    const employee = makeEmployee(data, id);

    await this.prisma.employee.create({
      data: PrismaEmployeeMapper.toPrisma(employee),
    });

    return employee;
  }
}
```

- [ ] **Step 3: Add Prisma employee repository**

Create `src/infra/database/prisma/repositories/prisma-employees-repository.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { EmployeesRepository } from "../../../../modules/application/repositories/employees-repository";
import { Employee } from "../../../../modules/employees/domain/entities/employee";
import { PrismaEmployeeMapper } from "../mappers/prisma-employee-mapper";
import { PrismaUnitOfWork } from "../prisma-unit-of-work";
import { rethrowPrismaRepositoryError } from "../prisma-repository-error-handler";
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
}
```

- [ ] **Step 4: Register employee repository in DatabaseModule**

Modify `src/infra/database/database.module.ts`.

Add imports:

```ts
import { EmployeesRepository } from "../../modules/application/repositories/employees-repository";
import { PrismaEmployeesRepository } from "./prisma/repositories/prisma-employees-repository";
```

Add this provider inside `providers`:

```ts
{
  provide: EmployeesRepository,
  useClass: PrismaEmployeesRepository,
},
```

Add this export inside `exports`:

```ts
EmployeesRepository,
```

- [ ] **Step 5: Run typecheck and verify Prisma persistence compiles**

Run:

```bash
npm run typecheck
```

Expected: PASS or unrelated failures already present before this task. If Prisma generated types are missing `employee`, run `npm run prisma:generate`, then rerun `npm run typecheck`.

- [ ] **Step 6: Commit Prisma employee persistence**

Run:

```bash
git add src/infra/database/prisma/mappers/prisma-employee-mapper.ts src/infra/database/prisma/repositories/prisma-employees-repository.ts src/infra/database/database.module.ts tests/factories/employee-factory.ts
git commit -m "feat: add prisma employee repository"
```

Expected: commit created.

## Task 7: HTTP Controller, Presenter, DTOs, And Module Registration

**Files:**

- Create: `src/infra/http/presenters/employee-presenter.ts`
- Create: `src/infra/http/controllers/register-employee.controller.ts`
- Modify: `src/infra/http/docs/domain-swagger.dto.ts`
- Modify: `src/infra/http/http.module.ts`

- [ ] **Step 1: Add Employee presenter**

Create `src/infra/http/presenters/employee-presenter.ts`:

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
      createdAt: employee.createdAt?.toISOString() ?? null,
      updatedAt: employee.updatedAt?.toISOString() ?? null,
    };
  }
}
```

- [ ] **Step 2: Add RegisterEmployee controller**

Create `src/infra/http/controllers/register-employee.controller.ts`:

```ts
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  InternalServerErrorException,
  NotFoundException,
  Post,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import z from "zod";
import { RegisterEmployeeUseCase } from "../../../modules/application/use-cases/employee/register-employee";
import { InvalidRegisterEmployeeInputError } from "../../../modules/employees/domain/errors/invalid-register-employee-input-error";
import { ALLOWED_EXTRA_EMPLOYEE_FEATURES } from "../../../modules/employees/domain/policies/employee-features-policy";
import { ResourceAlreadyExistsError } from "../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { AuthenticatedUser } from "../../auth/authenticated-user";
import { CurrentUser } from "../../auth/current-user";
import { Roles } from "../../auth/roles";
import {
  RegisterEmployeeBodyDto,
  RegisterEmployeeResponseDto,
} from "../docs/domain-swagger.dto";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { EmployeePresenter } from "../presenters/employee-presenter";

const registerEmployeeBodySchema = z
  .object({
    name: z.string().trim().min(1),
    email: z.email().trim(),
    password: z.string().nonempty().max(72),
    cpf: z.string().trim().optional().nullable(),
    birthDate: z.coerce.date().optional().nullable(),
    extraFeatures: z
      .array(z.enum(ALLOWED_EXTRA_EMPLOYEE_FEATURES))
      .optional()
      .default([]),
  })
  .strict();

type RegisterEmployeeBodySchema = z.infer<typeof registerEmployeeBodySchema>;

@ApiTags("employees")
@ApiBearerAuth("access-token")
@Controller("/employees")
@Roles(["ESTABLISHMENT"])
export class RegisterEmployeeController {
  constructor(private readonly registerEmployee: RegisterEmployeeUseCase) {}

  @Post()
  @ApiOperation({
    summary: "Register an employee for the authenticated establishment.",
  })
  @ApiBody({ type: RegisterEmployeeBodyDto })
  @ApiCreatedResponse({
    description: "Employee registered successfully.",
    type: RegisterEmployeeResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Invalid payload, invalid email, invalid CPF, invalid birth date, or invalid employee feature.",
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid access token.",
  })
  @ApiForbiddenResponse({
    description: "Authenticated user does not have the establishment role.",
  })
  @ApiNotFoundResponse({
    description:
      "The authenticated establishment user does not have an establishment profile.",
  })
  @ApiConflictResponse({
    description: "Employee email already exists.",
  })
  @ApiInternalServerErrorResponse({
    description: "Unexpected failure while registering the employee.",
  })
  async handle(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(registerEmployeeBodySchema))
    body: RegisterEmployeeBodySchema,
  ) {
    const result = await this.registerEmployee.execute({
      establishmentOwnerId: user.userId,
      name: body.name,
      email: body.email,
      password: body.password,
      extraFeatures: body.extraFeatures,
      ...(body.cpf !== undefined ? { cpf: body.cpf } : {}),
      ...(body.birthDate !== undefined ? { birthDate: body.birthDate } : {}),
    });

    if (result.isLeft()) {
      const error = result.value;

      switch (error.constructor) {
        case ResourceAlreadyExistsError:
          throw new ConflictException(error.message);
        case ResourceNotFoundError:
          throw new NotFoundException(error.message);
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

- [ ] **Step 3: Add employee Swagger DTOs**

Modify `src/infra/http/docs/domain-swagger.dto.ts`.

Insert this block after `RegisterEstablishmentResponseDto`:

```ts
const employeeFeatureExamples = [
  "read:appointments",
  "read:services",
  "read:customers",
  "create:appointments",
  "create:services",
  "create:customers",
  "update:appointments",
  "update:services",
  "update:customers",
  "delete:appointments",
  "delete:services",
  "delete:customers",
] as const;

const employeeExtraFeatureExamples = [
  "create:appointments",
  "create:services",
  "create:customers",
  "update:appointments",
  "update:services",
  "update:customers",
  "delete:appointments",
  "delete:services",
  "delete:customers",
] as const;

export class RegisterEmployeeBodyDto {
  @ApiProperty({ example: "Ana Silva", minLength: 1 })
  name!: string;

  @ApiProperty({ example: "ana@example.com", format: "email" })
  email!: string;

  @ApiProperty({ example: "strong-password", maxLength: 72 })
  password!: string;

  @ApiPropertyOptional({
    type: String,
    example: "52998224725",
    nullable: true,
    description: "Optional employee CPF.",
  })
  cpf?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: "1995-01-01T00:00:00.000Z",
    nullable: true,
    format: "date-time",
    description:
      "Optional birth date. Employees must be at least 18 years old.",
  })
  birthDate?: string | null;

  @ApiPropertyOptional({
    enum: employeeExtraFeatureExamples,
    isArray: true,
    example: ["create:appointments", "update:customers"],
    description:
      "Optional features beyond the default read permissions. Default read permissions are added automatically.",
  })
  extraFeatures?: string[];
}

export class EmployeeDto {
  @ApiProperty({ example: "5f588c8b-ef0f-4193-aec0-2926e77c1d09" })
  id!: string;

  @ApiProperty({ example: "2e11b57c-b96a-490a-9ae6-64ef2966fd84" })
  establishmentId!: string;

  @ApiProperty({ example: "b62c5971-4081-4d3d-8e5d-80722b926e4a" })
  userId!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  profileImageUrl!: string | null;

  @ApiProperty({ example: "Ana Silva" })
  name!: string;

  @ApiProperty({ type: String, example: "52998224725", nullable: true })
  cpf!: string | null;

  @ApiProperty({
    type: String,
    example: "1995-01-01T00:00:00.000Z",
    nullable: true,
    format: "date-time",
  })
  birthDate!: string | null;

  @ApiProperty({
    enum: employeeFeatureExamples,
    isArray: true,
    example: [
      "read:appointments",
      "read:services",
      "read:customers",
      "create:appointments",
    ],
  })
  features!: string[];

  @ApiProperty({
    type: String,
    example: "2026-05-04T10:00:00.000Z",
    nullable: true,
    format: "date-time",
  })
  createdAt!: string | null;

  @ApiProperty({
    type: String,
    example: "2026-05-04T10:00:00.000Z",
    nullable: true,
    format: "date-time",
  })
  updatedAt!: string | null;
}

export class RegisterEmployeeResponseDto {
  @ApiProperty({ type: EmployeeDto })
  employee!: EmployeeDto;
}
```

- [ ] **Step 4: Register controller and use case in HttpModule**

Modify `src/infra/http/http.module.ts`.

Add imports:

```ts
import { RegisterEmployeeUseCase } from "../../modules/application/use-cases/employee/register-employee";
import { RegisterEmployeeController } from "./controllers/register-employee.controller";
```

Add `RegisterEmployeeController` to the `controllers` array.

Add `RegisterEmployeeUseCase` to the `providers` array.

- [ ] **Step 5: Run typecheck and verify HTTP layer compiles**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit HTTP employee registration layer**

Run:

```bash
git add src/infra/http/presenters/employee-presenter.ts src/infra/http/controllers/register-employee.controller.ts src/infra/http/docs/domain-swagger.dto.ts src/infra/http/http.module.ts
git commit -m "feat: add register employee endpoint"
```

Expected: commit created.

## Task 8: RegisterEmployee E2E Tests

**Files:**

- Create: `src/infra/http/controllers/register-employee.controller.e2e-spec.ts`

- [ ] **Step 1: Write the failing RegisterEmployee e2e tests**

Create `src/infra/http/controllers/register-employee.controller.e2e-spec.ts`:

```ts
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";
import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  getHttpServer,
  loginUser,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

const employeeFeatureSchema = z.enum([
  "read:appointments",
  "read:services",
  "read:customers",
  "create:appointments",
  "create:services",
  "create:customers",
  "update:appointments",
  "update:services",
  "update:customers",
  "delete:appointments",
  "delete:services",
  "delete:customers",
]);

const employeeResponseSchema = z.object({
  employee: z.object({
    id: z.uuid(),
    establishmentId: z.uuid(),
    userId: z.uuid(),
    profileImageUrl: z.string().nullable(),
    name: z.string(),
    cpf: z.string().nullable(),
    birthDate: z.string().nullable(),
    features: z.array(employeeFeatureSchema),
    createdAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }),
});

function validEmployeePayload() {
  return {
    name: "Ana Silva",
    email: "ana.employee@example.com",
    password: "strong-password",
    cpf: "529.982.247-25",
    birthDate: "1995-01-01T00:00:00.000Z",
    extraFeatures: ["create:appointments", "update:customers"],
  };
}

function minorBirthDateIso() {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - 10);
  date.setUTCHours(0, 0, 0, 0);

  return date.toISOString();
}

async function makeEstablishmentAccessToken({
  app,
  prisma,
  userFactory,
  establishmentFactory,
  envService,
}: {
  app: INestApplication;
  prisma: PrismaService;
  userFactory: UserFactory;
  establishmentFactory: EstablishmentFactory;
  envService: EnvService;
}) {
  const { user, plainPassword } = await userFactory.makePrismaUser({
    role: "ESTABLISHMENT",
    plainPassword: "strong-password",
  });
  const establishment = await establishmentFactory.makePrismaEstablishment({
    ownerId: user.id,
  });
  const login = await loginUser({
    app,
    prisma,
    userId: user.id.toString(),
    email: user.email.toString(),
    password: plainPassword ?? "",
  });
  const expiredAccessToken = await new JwtService({
    secret: envService.get("JWT_ACCESS_SECRET"),
  }).signAsync(
    {
      sub: user.id.toString(),
      role: user.role,
      sid: login.sessionId,
      type: "access",
    },
    {
      expiresIn: "-1s",
    },
  );

  return {
    accessToken: login.loginBody.accessToken,
    expiredAccessToken,
    establishment,
  };
}

async function makeCustomerAccessToken({
  app,
  prisma,
  userFactory,
}: {
  app: INestApplication;
  prisma: PrismaService;
  userFactory: UserFactory;
}) {
  const { user, plainPassword } = await userFactory.makePrismaUser({
    role: "CUSTOMER",
    plainPassword: "strong-password",
  });
  const login = await loginUser({
    app,
    prisma,
    userId: user.id.toString(),
    email: user.email.toString(),
    password: plainPassword ?? "",
  });

  return {
    accessToken: login.loginBody.accessToken,
  };
}

async function makeEstablishmentUserWithoutProfileAccessToken({
  app,
  prisma,
  userFactory,
}: {
  app: INestApplication;
  prisma: PrismaService;
  userFactory: UserFactory;
}) {
  const { user, plainPassword } = await userFactory.makePrismaUser({
    role: "ESTABLISHMENT",
    plainPassword: "strong-password",
  });
  const login = await loginUser({
    app,
    prisma,
    userId: user.id.toString(),
    email: user.email.toString(),
    password: plainPassword ?? "",
  });

  return {
    accessToken: login.loginBody.accessToken,
  };
}

describe("Register employee controller (e2e)", () => {
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

  it("should register an employee with required fields", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Ana Silva",
        email: "ana.required@example.com",
        password: "strong-password",
      });
    const body = employeeResponseSchema.parse(response.body);

    expect(response.status).toBe(201);
    expect(body.employee.establishmentId).toBe(establishment.id.toString());
    expect(body.employee.name).toBe("Ana Silva");
    expect(body.employee.cpf).toBeNull();
    expect(body.employee.birthDate).toBeNull();
    expect(body.employee.profileImageUrl).toBeNull();
    expect(body.employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
    ]);

    const user = await prisma.user.findUnique({
      where: {
        id: body.employee.userId,
      },
    });
    const employee = await prisma.employee.findUnique({
      where: {
        id: body.employee.id,
      },
    });

    expect(user?.role).toBe("EMPLOYEE");
    expect(user?.email).toBe("ana.required@example.com");
    expect(user?.hashedPassword).not.toBe("strong-password");
    expect(employee?.establishmentId).toBe(establishment.id.toString());
    expect(employee?.profileImageUrl).toBeNull();
  });

  it("should register an employee with optional fields and extra features", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validEmployeePayload());
    const body = employeeResponseSchema.parse(response.body);

    expect(response.status).toBe(201);
    expect(body.employee.establishmentId).toBe(establishment.id.toString());
    expect(body.employee.cpf).toBe("52998224725");
    expect(body.employee.birthDate).toBe("1995-01-01T00:00:00.000Z");
    expect(body.employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "create:appointments",
      "update:customers",
    ]);
  });

  it("should enforce authentication and establishment role", async () => {
    const { expiredAccessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const customerRole = await makeCustomerAccessToken({
      app,
      prisma,
      userFactory,
    });

    const noTokenResponse = await request(getHttpServer(app))
      .post("/employees")
      .send(validEmployeePayload());
    const invalidTokenResponse = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", "Bearer invalid-token")
      .send(validEmployeePayload());
    const expiredTokenResponse = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", `Bearer ${expiredAccessToken}`)
      .send(validEmployeePayload());
    const customerRoleResponse = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", `Bearer ${customerRole.accessToken}`)
      .send(validEmployeePayload());

    expect(noTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.status).toBe(401);
    expect(expiredTokenResponse.status).toBe(401);
    expect(customerRoleResponse.status).toBe(403);
  });

  it("should reject invalid employee payloads", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const invalidPayloads = [
      {
        name: "missing name",
        payload: {
          email: "missing-name@example.com",
          password: "strong-password",
        },
      },
      {
        name: "invalid email",
        payload: {
          ...validEmployeePayload(),
          email: "invalid-email",
        },
      },
      {
        name: "invalid cpf",
        payload: {
          ...validEmployeePayload(),
          email: "invalid-cpf@example.com",
          cpf: "11111111111",
        },
      },
      {
        name: "birth date before 1900",
        payload: {
          ...validEmployeePayload(),
          email: "old-birth-date@example.com",
          birthDate: "1899-12-31T00:00:00.000Z",
        },
      },
      {
        name: "future birth date",
        payload: {
          ...validEmployeePayload(),
          email: "future-birth-date@example.com",
          birthDate: "2999-01-01T00:00:00.000Z",
        },
      },
      {
        name: "minor birth date",
        payload: {
          ...validEmployeePayload(),
          email: "minor-birth-date@example.com",
          birthDate: minorBirthDateIso(),
        },
      },
      {
        name: "default feature sent as extra",
        payload: {
          ...validEmployeePayload(),
          email: "default-feature@example.com",
          extraFeatures: ["read:appointments"],
        },
      },
      {
        name: "unknown extra feature",
        payload: {
          ...validEmployeePayload(),
          email: "unknown-feature@example.com",
          extraFeatures: ["approve:payments"],
        },
      },
      {
        name: "profile image sent in request",
        payload: {
          ...validEmployeePayload(),
          email: "profile-image@example.com",
          profileImageUrl: "https://example.com/avatar.png",
        },
      },
    ];

    for (const invalidPayload of invalidPayloads) {
      const response = await request(getHttpServer(app))
        .post("/employees")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(invalidPayload.payload);

      expect(response.status, invalidPayload.name).toBe(400);
    }
  });

  it("should reject duplicate employee email", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const payload = validEmployeePayload();

    const firstResponse = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(payload);
    const duplicateResponse = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(payload);

    expect(firstResponse.status).toBe(201);
    expect(duplicateResponse.status).toBe(409);
  });

  it("should reject an establishment user without establishment profile", async () => {
    const { accessToken } =
      await makeEstablishmentUserWithoutProfileAccessToken({
        app,
        prisma,
        userFactory,
      });

    const response = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validEmployeePayload());

    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the RegisterEmployee e2e tests and verify they pass**

Run:

```bash
npm run test:e2e -- src/infra/http/controllers/register-employee.controller.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit RegisterEmployee e2e coverage**

Run:

```bash
git add src/infra/http/controllers/register-employee.controller.e2e-spec.ts
git commit -m "test: cover register employee endpoint"
```

Expected: commit created.

## Task 9: Final Verification

**Files:**

- Verify: all files changed by Tasks 1-8.

- [ ] **Step 1: Run focused domain and use case tests**

Run:

```bash
npm run test -- src/modules/employees/domain/value-objects/birth-date.spec.ts src/modules/employees/domain/policies/employee-features-policy.spec.ts src/modules/employees/domain/entities/employee.spec.ts src/modules/application/use-cases/employee/register-employee.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused e2e tests**

Run:

```bash
npm run test:e2e -- src/infra/http/controllers/register-employee.controller.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Check final git status**

Run:

```bash
git status --short
```

Expected: no uncommitted implementation changes.

- [ ] **Step 7: Create final verification commit only if a fix was needed after Task 8**

Run this only when Steps 1-5 required follow-up edits:

```bash
git add src tests
git commit -m "chore: stabilize register employee verification"
```

Expected: commit created when verification fixes were needed; no commit when the worktree was already clean.

## Self-Review Checklist

- Spec coverage: the plan includes domain entity, `BirthDate`, feature policy, use case, errors, repository, Prisma mapper/repository, presenter, controller, Swagger DTOs, and tests.
- Type consistency: `EmployeeFeature`, `extraFeatures`, `BirthDate`, `InvalidRegisterEmployeeInputError`, and repository names match across tasks.
- Scope check: the plan stays limited to employee registration and does not add update/list/delete or feature authorization guards.
- Test coverage: the plan includes unit tests for the new domain rules, use case tests for business flow, and e2e tests for HTTP/auth/persistence behavior.
