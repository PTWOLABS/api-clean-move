# Service Price Specification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fixed, starting-at, and range pricing to catalog services, while appointments store validated per-service charged prices.

**Architecture:** Catalog services own a `ServicePriceSpecification` value object. `services.price_in_cents` remains the legacy/default charge price and a new Prisma enum plus optional maximum column represent the pricing mode. Appointment create/update use cases normalize legacy `serviceIds` and new `services` inputs, resolve catalog services synchronously, validate charged prices, and persist booked service snapshots.

**Tech Stack:** NestJS, TypeScript, Prisma, PostgreSQL, Zod, Vitest, Supertest.

---

## File Structure

- Create `src/modules/catalog/domain/value-objects/service-price-specification.ts`: value object for fixed, starting-at, and range pricing.
- Create `src/modules/catalog/domain/value-objects/service-price-specification.spec.ts`: unit tests for pricing rules.
- Modify `src/modules/catalog/domain/entities/services.ts`: replace internal `price: Money` usage with `priceSpecification`, while keeping a derived `price` getter for compatibility.
- Modify `src/modules/application/use-cases/service/create-service.ts`: accept `priceSpecification` and legacy `price`.
- Modify `src/modules/application/use-cases/service/update-service.ts`: update service price specification and reject empty updates.
- Modify `tests/factories/service-factory.ts` and `tests/repositories/in-memory-services-repository.ts`: use derived default price.
- Modify `prisma/schema.prisma`: add `ServicePriceType` enum and `Service.priceSpecificationType` / `Service.priceRangeMaxInCents`.
- Create `prisma/migrations/20260616120000_service_price_specification/migration.sql`: add database enum and columns.
- Modify `src/infra/database/prisma/mappers/prisma-service-mapper.ts`: map Prisma pricing fields to/from domain.
- Modify service HTTP controllers, presenters, Swagger DTOs, and e2e tests.
- Modify appointment HTTP controllers and use cases to support `services` plus legacy `serviceIds`.
- Modify quote creation to snapshot the service default charge price.

---

### Task 1: Add Catalog Price Specification Value Object

**Files:**

- Create: `src/modules/catalog/domain/value-objects/service-price-specification.ts`
- Create: `src/modules/catalog/domain/value-objects/service-price-specification.spec.ts`

- [ ] **Step 1: Write failing unit tests**

Create `src/modules/catalog/domain/value-objects/service-price-specification.spec.ts`:

```ts
import {
  InvalidServicePriceSpecificationError,
  ServicePriceSpecification,
} from "./service-price-specification";

describe("ServicePriceSpecification", () => {
  it("should create a fixed price specification", () => {
    const price = ServicePriceSpecification.create({
      type: "FIXED",
      fixedPriceInCents: 8000,
    });

    expect(price.type).toBe("FIXED");
    expect(price.defaultChargePriceInCents).toBe(8000);
    expect(price.toValue()).toEqual({
      type: "FIXED",
      fixedPriceInCents: 8000,
    });
  });

  it("should create a starting-at price specification", () => {
    const price = ServicePriceSpecification.create({
      type: "STARTING_AT",
      minPriceInCents: 25000,
    });

    expect(price.type).toBe("STARTING_AT");
    expect(price.defaultChargePriceInCents).toBe(25000);
    expect(price.toValue()).toEqual({
      type: "STARTING_AT",
      minPriceInCents: 25000,
    });
  });

  it("should create a range price specification", () => {
    const price = ServicePriceSpecification.create({
      type: "RANGE",
      minPriceInCents: 30000,
      maxPriceInCents: 60000,
    });

    expect(price.type).toBe("RANGE");
    expect(price.defaultChargePriceInCents).toBe(30000);
    expect(price.toValue()).toEqual({
      type: "RANGE",
      minPriceInCents: 30000,
      maxPriceInCents: 60000,
    });
  });

  it("should reject missing required fields", () => {
    expect(() =>
      ServicePriceSpecification.create({ type: "FIXED" }),
    ).toThrow(InvalidServicePriceSpecificationError);

    expect(() =>
      ServicePriceSpecification.create({ type: "STARTING_AT" }),
    ).toThrow(InvalidServicePriceSpecificationError);

    expect(() =>
      ServicePriceSpecification.create({
        type: "RANGE",
        minPriceInCents: 30000,
      }),
    ).toThrow(InvalidServicePriceSpecificationError);
  });

  it("should reject negative and non-integer prices", () => {
    expect(() =>
      ServicePriceSpecification.create({
        type: "FIXED",
        fixedPriceInCents: -1,
      }),
    ).toThrow("fixedPriceInCents must be a non-negative integer.");

    expect(() =>
      ServicePriceSpecification.create({
        type: "STARTING_AT",
        minPriceInCents: 12.5,
      }),
    ).toThrow("minPriceInCents must be a non-negative integer.");
  });

  it("should reject a range max below min", () => {
    expect(() =>
      ServicePriceSpecification.create({
        type: "RANGE",
        minPriceInCents: 60000,
        maxPriceInCents: 30000,
      }),
    ).toThrow("maxPriceInCents must be greater than or equal to minPriceInCents.");
  });

  it("should validate charged prices", () => {
    const fixed = ServicePriceSpecification.create({
      type: "FIXED",
      fixedPriceInCents: 8000,
    });
    const startingAt = ServicePriceSpecification.create({
      type: "STARTING_AT",
      minPriceInCents: 25000,
    });
    const range = ServicePriceSpecification.create({
      type: "RANGE",
      minPriceInCents: 30000,
      maxPriceInCents: 60000,
    });

    expect(() => fixed.assertCanCharge(8000)).not.toThrow();
    expect(() => fixed.assertCanCharge(9000)).toThrow(
      "charged price must equal fixed service price.",
    );

    expect(() => startingAt.assertCanCharge(25000)).not.toThrow();
    expect(() => startingAt.assertCanCharge(24999)).toThrow(
      "charged price must be greater than or equal to service minimum price.",
    );

    expect(() => range.assertCanCharge(30000)).not.toThrow();
    expect(() => range.assertCanCharge(60000)).not.toThrow();
    expect(() => range.assertCanCharge(29999)).toThrow(
      "charged price must be within service price range.",
    );
    expect(() => range.assertCanCharge(60001)).toThrow(
      "charged price must be within service price range.",
    );
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm run test -- src/modules/catalog/domain/value-objects/service-price-specification.spec.ts
```

Expected: FAIL because `service-price-specification.ts` does not exist.

- [ ] **Step 3: Implement the value object**

Create `src/modules/catalog/domain/value-objects/service-price-specification.ts`:

```ts
import { ValueObject } from "../../../../shared/entities/value-object";

export type ServicePriceSpecificationType = "FIXED" | "STARTING_AT" | "RANGE";

export type ServicePriceSpecificationValue = {
  type: ServicePriceSpecificationType;
  fixedPriceInCents?: number;
  minPriceInCents?: number;
  maxPriceInCents?: number;
};

type ServicePriceSpecificationProps = {
  type: ServicePriceSpecificationType;
  defaultPriceInCents: number;
  maxPriceInCents?: number;
};

export class InvalidServicePriceSpecificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidServicePriceSpecificationError";
  }
}

export class ServicePriceSpecification extends ValueObject<ServicePriceSpecificationProps> {
  get type() {
    return this.props.type;
  }

  get defaultChargePriceInCents() {
    return this.props.defaultPriceInCents;
  }

  get maxPriceInCents() {
    return this.props.maxPriceInCents;
  }

  assertCanCharge(priceInCents: number) {
    ServicePriceSpecification.assertNonNegativeInteger(
      priceInCents,
      "priceInCents",
    );

    if (
      this.type === "FIXED" &&
      priceInCents !== this.defaultChargePriceInCents
    ) {
      throw new InvalidServicePriceSpecificationError(
        "charged price must equal fixed service price.",
      );
    }

    if (
      this.type === "STARTING_AT" &&
      priceInCents < this.defaultChargePriceInCents
    ) {
      throw new InvalidServicePriceSpecificationError(
        "charged price must be greater than or equal to service minimum price.",
      );
    }

    if (
      this.type === "RANGE" &&
      (priceInCents < this.defaultChargePriceInCents ||
        priceInCents > this.props.maxPriceInCents!)
    ) {
      throw new InvalidServicePriceSpecificationError(
        "charged price must be within service price range.",
      );
    }
  }

  toValue(): ServicePriceSpecificationValue {
    if (this.type === "FIXED") {
      return {
        type: "FIXED",
        fixedPriceInCents: this.defaultChargePriceInCents,
      };
    }

    if (this.type === "STARTING_AT") {
      return {
        type: "STARTING_AT",
        minPriceInCents: this.defaultChargePriceInCents,
      };
    }

    return {
      type: "RANGE",
      minPriceInCents: this.defaultChargePriceInCents,
      maxPriceInCents: this.props.maxPriceInCents,
    };
  }

  static create(value: ServicePriceSpecificationValue) {
    if (value.type === "FIXED") {
      ServicePriceSpecification.assertNonNegativeInteger(
        value.fixedPriceInCents,
        "fixedPriceInCents",
      );

      return new ServicePriceSpecification({
        type: "FIXED",
        defaultPriceInCents: value.fixedPriceInCents!,
      });
    }

    if (value.type === "STARTING_AT") {
      ServicePriceSpecification.assertNonNegativeInteger(
        value.minPriceInCents,
        "minPriceInCents",
      );

      return new ServicePriceSpecification({
        type: "STARTING_AT",
        defaultPriceInCents: value.minPriceInCents!,
      });
    }

    if (value.type === "RANGE") {
      ServicePriceSpecification.assertNonNegativeInteger(
        value.minPriceInCents,
        "minPriceInCents",
      );
      ServicePriceSpecification.assertNonNegativeInteger(
        value.maxPriceInCents,
        "maxPriceInCents",
      );

      if (value.maxPriceInCents! < value.minPriceInCents!) {
        throw new InvalidServicePriceSpecificationError(
          "maxPriceInCents must be greater than or equal to minPriceInCents.",
        );
      }

      return new ServicePriceSpecification({
        type: "RANGE",
        defaultPriceInCents: value.minPriceInCents!,
        maxPriceInCents: value.maxPriceInCents,
      });
    }

    throw new InvalidServicePriceSpecificationError(
      "Invalid service price specification type.",
    );
  }

  private static assertNonNegativeInteger(
    value: unknown,
    fieldName: string,
  ): asserts value is number {
    if (!Number.isInteger(value) || (value as number) < 0) {
      throw new InvalidServicePriceSpecificationError(
        `${fieldName} must be a non-negative integer.`,
      );
    }
  }
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```bash
npm run test -- src/modules/catalog/domain/value-objects/service-price-specification.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/modules/catalog/domain/value-objects/service-price-specification.ts src/modules/catalog/domain/value-objects/service-price-specification.spec.ts
git commit -m "feat: add service price specification value object"
```

---

### Task 2: Move Service Domain To Price Specification

**Files:**

- Modify: `src/modules/catalog/domain/entities/services.ts`
- Modify: `src/modules/application/use-cases/service/create-service.spec.ts`
- Modify: `src/modules/application/use-cases/service/update-service.spec.ts`
- Modify: `tests/factories/service-factory.ts`
- Modify: `tests/repositories/in-memory-services-repository.ts`

- [ ] **Step 1: Add failing service domain tests**

In `src/modules/application/use-cases/service/create-service.spec.ts`, add:

```ts
it("should create a service with a starting-at price specification", async () => {
  const result = await sut.execute({
    establishmentOwnerId: establishment.ownerId.toString(),
    serviceName: "Polimento",
    priceSpecification: {
      type: "STARTING_AT",
      minPriceInCents: 25000,
    },
  });

  expect(result.isRight()).toBe(true);
  if (result.isRight()) {
    expect(result.value.service.priceSpecification.toValue()).toEqual({
      type: "STARTING_AT",
      minPriceInCents: 25000,
    });
    expect(result.value.service.price.amountInCents).toBe(25000);
  }
});
```

In `src/modules/application/use-cases/service/update-service.spec.ts`, add:

```ts
it("should update the service price specification", async () => {
  const service = makeService({
    establishmentId: establishment.id,
  });
  await servicesRepository.create(service);

  const result = await sut.execute({
    establishmentOwnerId: establishment.ownerId.toString(),
    serviceId: service.id.toString(),
    data: {
      priceSpecification: {
        type: "RANGE",
        minPriceInCents: 30000,
        maxPriceInCents: 60000,
      },
    },
  });

  expect(result.isRight()).toBe(true);
  if (result.isRight()) {
    expect(result.value.service.priceSpecification.toValue()).toEqual({
      type: "RANGE",
      minPriceInCents: 30000,
      maxPriceInCents: 60000,
    });
    expect(result.value.service.price.amountInCents).toBe(30000);
  }
});
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run:

```bash
npm run test -- src/modules/application/use-cases/service/create-service.spec.ts src/modules/application/use-cases/service/update-service.spec.ts
```

Expected: FAIL because service use case request types and entity do not expose `priceSpecification`.

- [ ] **Step 3: Modify `Service` entity**

In `src/modules/catalog/domain/entities/services.ts`, update imports:

```ts
import { Money } from "../value-objects/money";
import {
  ServicePriceSpecification,
  ServicePriceSpecificationValue,
} from "../value-objects/service-price-specification";
```

Change `ServiceProps` price field:

```ts
  priceSpecification: ServicePriceSpecification;
```

Replace the existing `price` getter with:

```ts
  get priceSpecification() {
    return this.props.priceSpecification;
  }

  get price() {
    return Money.create(this.props.priceSpecification.defaultChargePriceInCents);
  }
```

Change `update` input:

```ts
    price?: number;
    priceSpecification?: ServicePriceSpecificationValue;
```

Replace the `newPrice` block in `update` with:

```ts
    const newPriceSpecification =
      data.priceSpecification !== undefined
        ? ServicePriceSpecification.create(data.priceSpecification)
        : data.price !== undefined
          ? ServicePriceSpecification.create({
              type: "FIXED",
              fixedPriceInCents: data.price,
            })
          : undefined;
```

Replace `if (newPrice) { this.changePrice(newPrice); }` with:

```ts
    if (newPriceSpecification) {
      this.changePriceSpecification(newPriceSpecification);
    }
```

Replace `changePrice` with:

```ts
  changePriceSpecification(priceSpecification: ServicePriceSpecification) {
    if (this.priceSpecification.equals(priceSpecification)) return;

    this.props.priceSpecification = priceSpecification;
    this.touch();
  }
```

- [ ] **Step 4: Update service factory defaults**

In `tests/factories/service-factory.ts`, replace the `Money` import with:

```ts
import { ServicePriceSpecification } from "../../src/modules/catalog/domain/value-objects/service-price-specification";
```

Replace the factory default `price` property:

```ts
      priceSpecification: ServicePriceSpecification.create({
        type: "FIXED",
        fixedPriceInCents: 30000,
      }),
```

- [ ] **Step 5: Update in-memory repository filters**

In `tests/repositories/in-memory-services-repository.ts`, keep filter behavior but rely on the compatibility getter:

```ts
      if (
        filters?.minPrice !== undefined &&
        item.price.amountInCents < filters.minPrice
      ) {
        return false;
      }

      if (
        filters?.maxPrice !== undefined &&
        item.price.amountInCents > filters.maxPrice
      ) {
        return false;
      }
```

No code change is needed if the compatibility getter exists. Run tests after the entity update.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm run test -- src/modules/catalog/domain/entities/service.spec.ts src/modules/application/use-cases/service/create-service.spec.ts src/modules/application/use-cases/service/update-service.spec.ts
```

If `src/modules/catalog/domain/entities/service.spec.ts` does not exist, run:

```bash
npm run test -- src/modules/application/use-cases/service/create-service.spec.ts src/modules/application/use-cases/service/update-service.spec.ts
```

Expected: service use case tests still fail until Task 3 updates use cases.

- [ ] **Step 7: Commit domain entity changes**

Run:

```bash
git add src/modules/catalog/domain/entities/services.ts tests/factories/service-factory.ts tests/repositories/in-memory-services-repository.ts src/modules/application/use-cases/service/create-service.spec.ts src/modules/application/use-cases/service/update-service.spec.ts
git commit -m "refactor: model service pricing as specification"
```

---

### Task 3: Update Service Create And Update Use Cases

**Files:**

- Modify: `src/modules/application/use-cases/service/create-service.ts`
- Modify: `src/modules/application/use-cases/service/update-service.ts`
- Modify: `src/modules/application/use-cases/service/create-service.spec.ts`
- Modify: `src/modules/application/use-cases/service/update-service.spec.ts`

- [ ] **Step 1: Add failing validation tests**

In `src/modules/application/use-cases/service/create-service.spec.ts`, add:

```ts
it("should reject a service with invalid price specification", async () => {
  const result = await sut.execute({
    establishmentOwnerId: establishment.ownerId.toString(),
    serviceName: "Higienizacao",
    priceSpecification: {
      type: "RANGE",
      minPriceInCents: 60000,
      maxPriceInCents: 30000,
    },
  });

  expect(result.isLeft()).toBe(true);
  expect(result.value).toBeInstanceOf(InvalidServiceUpdateInputError);
});

it("should keep legacy price as fixed pricing", async () => {
  const result = await sut.execute({
    establishmentOwnerId: establishment.ownerId.toString(),
    serviceName: "Lavagem",
    price: 8000,
  });

  expect(result.isRight()).toBe(true);
  if (result.isRight()) {
    expect(result.value.service.priceSpecification.toValue()).toEqual({
      type: "FIXED",
      fixedPriceInCents: 8000,
    });
  }
});
```

In `src/modules/application/use-cases/service/update-service.spec.ts`, add:

```ts
it("should reject update with invalid price specification", async () => {
  const service = makeService({ establishmentId: establishment.id });
  await servicesRepository.create(service);

  const result = await sut.execute({
    establishmentOwnerId: establishment.ownerId.toString(),
    serviceId: service.id.toString(),
    data: {
      priceSpecification: {
        type: "RANGE",
        minPriceInCents: 60000,
        maxPriceInCents: 30000,
      },
    },
  });

  expect(result.isLeft()).toBe(true);
  expect(result.value).toBeInstanceOf(InvalidServiceUpdateInputError);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test -- src/modules/application/use-cases/service/create-service.spec.ts src/modules/application/use-cases/service/update-service.spec.ts
```

Expected: FAIL because use case request types do not accept `priceSpecification`.

- [ ] **Step 3: Update create service use case**

In `src/modules/application/use-cases/service/create-service.ts`, import:

```ts
import {
  InvalidServicePriceSpecificationError,
  ServicePriceSpecification,
  ServicePriceSpecificationValue,
} from "../../../catalog/domain/value-objects/service-price-specification";
```

Change request type:

```ts
  price?: number;
  priceSpecification?: ServicePriceSpecificationValue;
```

Before creating the service, build the specification:

```ts
    let resolvedPriceSpecification: ServicePriceSpecification;

    try {
      resolvedPriceSpecification = priceSpecification
        ? ServicePriceSpecification.create(priceSpecification)
        : ServicePriceSpecification.create({
            type: "FIXED",
            fixedPriceInCents: price,
          });
    } catch (error) {
      if (error instanceof InvalidServicePriceSpecificationError) {
        return left(new InvalidServiceUpdateInputError(error.message));
      }

      return left(new UnexpectedDomainError());
    }
```

In `Service.create`, replace:

```ts
        price: Money.create(price),
```

with:

```ts
        priceSpecification: resolvedPriceSpecification,
```

Remove `InvalidMoneyError` and `Money` imports if unused. Add `InvalidServicePriceSpecificationError` to the domain-error catch:

```ts
        error instanceof InvalidServicePriceSpecificationError
```

- [ ] **Step 4: Update update service use case**

In `src/modules/application/use-cases/service/update-service.ts`, import:

```ts
import {
  InvalidServicePriceSpecificationError,
  ServicePriceSpecificationValue,
} from "../../../catalog/domain/value-objects/service-price-specification";
```

Change update request data:

```ts
    price?: number;
    priceSpecification?: ServicePriceSpecificationValue;
```

Add the payload mapping:

```ts
      ...(data.priceSpecification !== undefined
        ? { priceSpecification: data.priceSpecification }
        : data.price !== undefined
          ? { price: data.price }
          : {}),
```

Add `InvalidServicePriceSpecificationError` to the catch mapping:

```ts
        error instanceof InvalidServicePriceSpecificationError
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm run test -- src/modules/application/use-cases/service/create-service.spec.ts src/modules/application/use-cases/service/update-service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/modules/application/use-cases/service/create-service.ts src/modules/application/use-cases/service/update-service.ts src/modules/application/use-cases/service/create-service.spec.ts src/modules/application/use-cases/service/update-service.spec.ts
git commit -m "feat: support service price specifications in use cases"
```

---

### Task 4: Add Prisma Persistence For Price Specification

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260616120000_service_price_specification/migration.sql`
- Modify: `src/infra/database/prisma/mappers/prisma-service-mapper.ts`
- Modify: `tests/factories/service-factory.ts`

- [ ] **Step 1: Add mapper test or extend existing service mapper coverage**

If there is no mapper spec, create `src/infra/database/prisma/mappers/prisma-service-mapper.spec.ts`:

```ts
import { Service } from "../../../../modules/catalog/domain/entities/services";
import { ServicePriceSpecification } from "../../../../modules/catalog/domain/value-objects/service-price-specification";
import { ServiceName } from "../../../../modules/catalog/domain/value-objects/service-name";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { PrismaServiceMapper } from "./prisma-service-mapper";

describe("PrismaServiceMapper", () => {
  it("should map a range price specification to prisma", () => {
    const service = Service.create({
      establishmentId: new UniqueEntityId(),
      serviceName: ServiceName.create("Higienizacao interna"),
      priceSpecification: ServicePriceSpecification.create({
        type: "RANGE",
        minPriceInCents: 30000,
        maxPriceInCents: 60000,
      }),
    });

    expect(PrismaServiceMapper.toPrisma(service)).toEqual(
      expect.objectContaining({
        priceInCents: 30000,
        priceSpecificationType: "RANGE",
        priceRangeMaxInCents: 60000,
      }),
    );
  });
});
```

- [ ] **Step 2: Run mapper test to verify it fails**

Run:

```bash
npm run test -- src/infra/database/prisma/mappers/prisma-service-mapper.spec.ts
```

Expected: FAIL because Prisma mapper does not expose the new fields.

- [ ] **Step 3: Update Prisma schema**

In `prisma/schema.prisma`, add after existing enums:

```prisma
enum ServicePriceType {
  FIXED
  STARTING_AT
  RANGE
}
```

In `model Service`, add:

```prisma
  priceSpecificationType         ServicePriceType @default(FIXED) @map("price_specification_type")
  priceRangeMaxInCents           Int?             @map("price_range_max_in_cents")
```

Keep existing:

```prisma
  priceInCents                  Int       @map("price_in_cents")
```

- [ ] **Step 4: Add migration SQL**

Create `prisma/migrations/20260616120000_service_price_specification/migration.sql`:

```sql
CREATE TYPE "ServicePriceType" AS ENUM ('FIXED', 'STARTING_AT', 'RANGE');

ALTER TABLE "services"
  ADD COLUMN "price_specification_type" "ServicePriceType" NOT NULL DEFAULT 'FIXED',
  ADD COLUMN "price_range_max_in_cents" INTEGER;

ALTER TABLE "services"
  ADD CONSTRAINT "services_price_range_max_in_cents_non_negative"
  CHECK ("price_range_max_in_cents" IS NULL OR "price_range_max_in_cents" >= 0);

ALTER TABLE "services"
  ADD CONSTRAINT "services_price_range_max_requires_range"
  CHECK (
    ("price_specification_type" = 'RANGE' AND "price_range_max_in_cents" IS NOT NULL AND "price_range_max_in_cents" >= "price_in_cents")
    OR ("price_specification_type" <> 'RANGE' AND "price_range_max_in_cents" IS NULL)
  );
```

- [ ] **Step 5: Update Prisma service mapper**

In `src/infra/database/prisma/mappers/prisma-service-mapper.ts`, import:

```ts
import { ServicePriceSpecification } from "../../../../modules/catalog/domain/value-objects/service-price-specification";
```

In `toDomain`, replace `price: Money.create(raw.priceInCents),` with:

```ts
        priceSpecification: ServicePriceSpecification.create(
          raw.priceSpecificationType === "FIXED"
            ? {
                type: "FIXED",
                fixedPriceInCents: raw.priceInCents,
              }
            : raw.priceSpecificationType === "STARTING_AT"
              ? {
                  type: "STARTING_AT",
                  minPriceInCents: raw.priceInCents,
                }
              : {
                  type: "RANGE",
                  minPriceInCents: raw.priceInCents,
                  maxPriceInCents: raw.priceRangeMaxInCents ?? undefined,
                },
        ),
```

In `toPrisma` and `toPrismaUpdate`, replace price fields with:

```ts
      priceInCents: raw.priceSpecification.defaultChargePriceInCents,
      priceSpecificationType: raw.priceSpecification.type,
      priceRangeMaxInCents: raw.priceSpecification.maxPriceInCents ?? null,
```

Remove the unused `Money` import.

- [ ] **Step 6: Regenerate Prisma client and run mapper test**

Run:

```bash
npm run prisma:generate
npm run test -- src/infra/database/prisma/mappers/prisma-service-mapper.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add prisma/schema.prisma prisma/migrations/20260616120000_service_price_specification/migration.sql src/infra/database/prisma/mappers/prisma-service-mapper.ts src/infra/database/prisma/mappers/prisma-service-mapper.spec.ts
git commit -m "feat: persist service price specifications"
```

---

### Task 5: Update Service HTTP Contract And Presenters

**Files:**

- Modify: `src/infra/http/controllers/create-service.controller.ts`
- Modify: `src/infra/http/controllers/update-service.controller.ts`
- Modify: `src/infra/http/presenters/service-presenter.ts`
- Modify: `src/infra/http/docs/domain-swagger.dto.ts`
- Modify: `src/infra/http/controllers/create-service.controller.e2e-spec.ts`
- Modify: `src/infra/http/controllers/update-service.controller.e2e-spec.ts`

- [ ] **Step 1: Add failing e2e tests for new service pricing**

In `src/infra/http/controllers/create-service.controller.e2e-spec.ts`, add:

```ts
it("should create a service with range price specification", async () => {
  const { accessToken } = await authHelper.makeAuthenticatedEstablishment();

  const response = await request(app.getHttpServer())
    .post("/services")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      serviceName: "Higienizacao interna",
      priceSpecification: {
        type: "RANGE",
        minPriceInCents: 30000,
        maxPriceInCents: 60000,
      },
    });

  expect(response.statusCode).toBe(201);
  expect(response.body.service).toEqual(
    expect.objectContaining({
      name: "Higienizacao interna",
      priceInCents: 30000,
      priceSpecification: {
        type: "RANGE",
        minPriceInCents: 30000,
        maxPriceInCents: 60000,
      },
    }),
  );
});

it("should reject a service request with both legacy price and priceSpecification", async () => {
  const { accessToken } = await authHelper.makeAuthenticatedEstablishment();

  const response = await request(app.getHttpServer())
    .post("/services")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      serviceName: "Polimento",
      price: 25000,
      priceSpecification: {
        type: "STARTING_AT",
        minPriceInCents: 25000,
      },
    });

  expect(response.statusCode).toBe(400);
});
```

Adapt helper names to the existing setup in the file if they differ. Keep the assertions and payloads unchanged.

- [ ] **Step 2: Run service e2e tests to verify they fail**

Run:

```bash
npm run test:e2e -- src/infra/http/controllers/create-service.controller.e2e-spec.ts src/infra/http/controllers/update-service.controller.e2e-spec.ts
```

Expected: FAIL because controllers do not accept `priceSpecification`.

- [ ] **Step 3: Update create service controller schema**

In `src/infra/http/controllers/create-service.controller.ts`, add a reusable schema near the top:

```ts
const priceSpecificationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("FIXED"),
      fixedPriceInCents: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal("STARTING_AT"),
      minPriceInCents: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal("RANGE"),
      minPriceInCents: z.number().int().nonnegative(),
      maxPriceInCents: z.number().int().nonnegative(),
    })
    .strict()
    .refine(
      (value) => value.maxPriceInCents >= value.minPriceInCents,
      "maxPriceInCents must be greater than or equal to minPriceInCents.",
    ),
]);
```

Change `createServiceBodySchema` price fields:

```ts
  price: z.number().int().nonnegative().optional(),
  priceSpecification: priceSpecificationSchema.optional(),
```

Add refine:

```ts
  .refine(
    (value) =>
      (value.price !== undefined || value.priceSpecification !== undefined) &&
      !(value.price !== undefined && value.priceSpecification !== undefined),
    "Provide either price or priceSpecification.",
  );
```

Pass the field to the use case:

```ts
      ...(price !== undefined ? { price } : {}),
      ...(body.priceSpecification !== undefined
        ? { priceSpecification: body.priceSpecification }
        : {}),
```

- [ ] **Step 4: Update update service controller schema**

In `src/infra/http/controllers/update-service.controller.ts`, add the same `priceSpecificationSchema`.

Change schema fields:

```ts
    price: z.number().int().nonnegative().optional(),
    priceSpecification: priceSpecificationSchema.optional(),
```

Add a refine before the existing non-empty refine:

```ts
  .refine(
    (value) =>
      !(value.price !== undefined && value.priceSpecification !== undefined),
    "Provide either price or priceSpecification.",
  )
```

Pass the field:

```ts
        ...(body.priceSpecification !== undefined
          ? { priceSpecification: body.priceSpecification }
          : {}),
```

- [ ] **Step 5: Update presenter**

In `src/infra/http/presenters/service-presenter.ts`, add:

```ts
      priceSpecification: service.priceSpecification.toValue(),
```

Keep:

```ts
      priceInCents: service.price.amountInCents,
```

- [ ] **Step 6: Update Swagger DTOs**

In `src/infra/http/docs/domain-swagger.dto.ts`, add DTOs:

```ts
export class ServicePriceSpecificationDto {
  @ApiProperty({ enum: ["FIXED", "STARTING_AT", "RANGE"] })
  type!: "FIXED" | "STARTING_AT" | "RANGE";

  @ApiProperty({ type: Number, required: false, minimum: 0 })
  fixedPriceInCents?: number;

  @ApiProperty({ type: Number, required: false, minimum: 0 })
  minPriceInCents?: number;

  @ApiProperty({ type: Number, required: false, minimum: 0 })
  maxPriceInCents?: number;
}
```

Add `priceSpecification` to service create/update/response DTOs:

```ts
  @ApiProperty({ type: ServicePriceSpecificationDto })
  priceSpecification!: ServicePriceSpecificationDto;
```

For request DTOs, mark as optional where legacy `price` is still documented:

```ts
  @ApiProperty({ type: ServicePriceSpecificationDto, required: false })
  priceSpecification?: ServicePriceSpecificationDto;
```

- [ ] **Step 7: Run e2e tests**

Run:

```bash
npm run test:e2e -- src/infra/http/controllers/create-service.controller.e2e-spec.ts src/infra/http/controllers/update-service.controller.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/infra/http/controllers/create-service.controller.ts src/infra/http/controllers/update-service.controller.ts src/infra/http/presenters/service-presenter.ts src/infra/http/docs/domain-swagger.dto.ts src/infra/http/controllers/create-service.controller.e2e-spec.ts src/infra/http/controllers/update-service.controller.e2e-spec.ts
git commit -m "feat: expose service price specifications over http"
```

---

### Task 6: Support Appointment Service Items With Prices

**Files:**

- Modify: `src/modules/application/use-cases/appointment/create-appointment.ts`
- Modify: `src/modules/application/use-cases/appointment/update-appointment.ts`
- Modify: `src/modules/application/use-cases/appointment/create-appointment.spec.ts`
- Modify: `src/modules/application/use-cases/appointment/update-appointment.spec.ts`

- [ ] **Step 1: Add failing appointment use case tests**

In `src/modules/application/use-cases/appointment/create-appointment.spec.ts`, add:

```ts
it("should create an appointment with explicit service charged price", async () => {
  const service = makeService({
    establishmentId: establishment.id,
    priceSpecification: ServicePriceSpecification.create({
      type: "STARTING_AT",
      minPriceInCents: 25000,
    }),
  });
  await servicesRepository.create(service);

  const result = await sut.execute({
    actor: {
      userId: establishment.ownerId.toString(),
      role: "ESTABLISHMENT",
    },
    customerId: customer.id.toString(),
    services: [
      {
        serviceId: service.id.toString(),
        priceInCents: 35000,
      },
    ],
    startsAt: new Date("2026-06-16T12:00:00.000Z"),
  });

  expect(result.isRight()).toBe(true);
  if (result.isRight()) {
    expect(result.value.appointment.services[0]?.priceInCents).toBe(35000);
  }
});

it("should reject an appointment service price outside the catalog policy", async () => {
  const service = makeService({
    establishmentId: establishment.id,
    priceSpecification: ServicePriceSpecification.create({
      type: "RANGE",
      minPriceInCents: 30000,
      maxPriceInCents: 60000,
    }),
  });
  await servicesRepository.create(service);

  const result = await sut.execute({
    actor: {
      userId: establishment.ownerId.toString(),
      role: "ESTABLISHMENT",
    },
    customerId: customer.id.toString(),
    services: [
      {
        serviceId: service.id.toString(),
        priceInCents: 60001,
      },
    ],
    startsAt: new Date("2026-06-16T12:00:00.000Z"),
  });

  expect(result.isLeft()).toBe(true);
  expect(result.value).toBeInstanceOf(InvalidAppointmentInputError);
});
```

Add imports:

```ts
import { ServicePriceSpecification } from "../../../catalog/domain/value-objects/service-price-specification";
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run:

```bash
npm run test -- src/modules/application/use-cases/appointment/create-appointment.spec.ts src/modules/application/use-cases/appointment/update-appointment.spec.ts
```

Expected: FAIL because request types do not accept `services`.

- [ ] **Step 3: Update create appointment request and resolver**

In `src/modules/application/use-cases/appointment/create-appointment.ts`, add:

```ts
type AppointmentServiceItemInput = {
  serviceId: string;
  priceInCents?: number;
};
```

Change request:

```ts
  serviceIds?: string[];
  services?: AppointmentServiceItemInput[];
```

At the start of `execute`, replace duplicate validation with:

```ts
    const serviceItemsResult = this.normalizeServiceItems(serviceIds, services);

    if (serviceItemsResult.isLeft()) {
      return left(serviceItemsResult.value);
    }
```

Add private method:

```ts
  private normalizeServiceItems(
    serviceIds?: string[],
    services?: AppointmentServiceItemInput[],
  ): Either<InvalidAppointmentInputError, AppointmentServiceItemInput[]> {
    if (serviceIds !== undefined && services !== undefined) {
      return left(
        new InvalidAppointmentInputError(
          "Provide either serviceIds or services, not both.",
        ),
      );
    }

    const items =
      services ??
      serviceIds?.map((serviceId) => ({
        serviceId,
      }));

    if (!items || items.length === 0) {
      return left(
        new InvalidAppointmentInputError("At least one service is required."),
      );
    }

    const ids = items.map((item) => item.serviceId);

    if (new Set(ids).size !== ids.length) {
      return left(
        new InvalidAppointmentInputError(
          "Duplicate services are not allowed in the same appointment.",
        ),
      );
    }

    return right(items);
  }
```

Replace the service loop:

```ts
    for (const item of serviceItemsResult.value) {
      const service =
        await this.servicesRepository.findByServiceIdAndEstablishmentId(
          item.serviceId,
          establishment.id.toString(),
        );

      if (!service || service.isDeleted()) {
        return left(new ResourceNotFoundError({ resource: "service" }));
      }

      if (!service.isActive) {
        return left(new InactiveServiceError(service.serviceName.value));
      }

      const priceInCents =
        item.priceInCents ?? service.priceSpecification.defaultChargePriceInCents;

      try {
        service.priceSpecification.assertCanCharge(priceInCents);
      } catch (error) {
        return left(
          new InvalidAppointmentInputError(
            error instanceof Error ? error.message : "Invalid service price.",
          ),
        );
      }

      services.push({
        serviceId: service.id,
        serviceName: service.serviceName.value,
        category: service.category,
        durationInMinutes: service.estimatedDuration?.upperBoundInMinutes,
        priceInCents,
      });
    }
```

- [ ] **Step 4: Update update appointment request and resolver**

Apply the same `AppointmentServiceItemInput`, `serviceIds?: string[]`, `services?: AppointmentServiceItemInput[]`, `normalizeServiceItems`, and price validation logic to `src/modules/application/use-cases/appointment/update-appointment.ts`.

Change the resolver branch:

```ts
    const servicesResult: ResolveServicesResponse =
      serviceIds !== undefined || services !== undefined
        ? await this.resolveServices(serviceIds, services, establishmentId)
        : right({ services: appointment.services });
```

Change `resolveServices` signature:

```ts
  private async resolveServices(
    serviceIds: string[] | undefined,
    serviceItems: AppointmentServiceItemInput[] | undefined,
    establishmentId: string,
  ): Promise<ResolveServicesResponse> {
```

At the top of `resolveServices`, call:

```ts
    const normalizedResult = this.normalizeServiceItems(serviceIds, serviceItems);

    if (normalizedResult.isLeft()) {
      return left(normalizedResult.value);
    }
```

Then loop through `normalizedResult.value` with the same validation from create.

- [ ] **Step 5: Run focused appointment tests**

Run:

```bash
npm run test -- src/modules/application/use-cases/appointment/create-appointment.spec.ts src/modules/application/use-cases/appointment/update-appointment.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/modules/application/use-cases/appointment/create-appointment.ts src/modules/application/use-cases/appointment/update-appointment.ts src/modules/application/use-cases/appointment/create-appointment.spec.ts src/modules/application/use-cases/appointment/update-appointment.spec.ts
git commit -m "feat: validate appointment service charged prices"
```

---

### Task 7: Update Appointment HTTP Contract

**Files:**

- Modify: `src/infra/http/controllers/create-appointment.controller.ts`
- Modify: `src/infra/http/controllers/update-appointment.controller.ts`
- Modify: `src/infra/http/docs/domain-swagger.dto.ts`
- Modify: `src/infra/http/controllers/create-appointment.controller.e2e-spec.ts`
- Modify: `src/infra/http/controllers/update-appointment.controller.e2e-spec.ts`

- [ ] **Step 1: Add failing appointment e2e tests**

In `src/infra/http/controllers/create-appointment.controller.e2e-spec.ts`, add:

```ts
it("should create an appointment using service items with explicit price", async () => {
  const { accessToken, establishment } =
    await authHelper.makeAuthenticatedEstablishment();
  const customer = await customerFactory.makePrismaCustomer({
    establishmentId: establishment.id,
  });
  const service = await serviceFactory.makePrismaService({
    establishmentId: establishment.id,
    priceSpecification: ServicePriceSpecification.create({
      type: "STARTING_AT",
      minPriceInCents: 25000,
    }),
  });

  const response = await request(app.getHttpServer())
    .post("/appointments")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      customerId: customer.id.toString(),
      services: [
        {
          serviceId: service.id.toString(),
          priceInCents: 35000,
        },
      ],
      startsAt: "2026-06-16T12:00:00.000Z",
    });

  expect(response.statusCode).toBe(201);
  expect(response.body.appointment.services[0]).toEqual(
    expect.objectContaining({
      id: service.id.toString(),
      priceInCents: 35000,
    }),
  );
});

it("should reject appointment payload with both serviceIds and services", async () => {
  const { accessToken, establishment } =
    await authHelper.makeAuthenticatedEstablishment();
  const customer = await customerFactory.makePrismaCustomer({
    establishmentId: establishment.id,
  });
  const service = await serviceFactory.makePrismaService({
    establishmentId: establishment.id,
  });

  const response = await request(app.getHttpServer())
    .post("/appointments")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      customerId: customer.id.toString(),
      serviceIds: [service.id.toString()],
      services: [{ serviceId: service.id.toString() }],
      startsAt: "2026-06-16T12:00:00.000Z",
    });

  expect(response.statusCode).toBe(400);
});
```

Add import:

```ts
import { ServicePriceSpecification } from "../../../modules/catalog/domain/value-objects/service-price-specification";
```

- [ ] **Step 2: Run appointment e2e tests to verify they fail**

Run:

```bash
npm run test:e2e -- src/infra/http/controllers/create-appointment.controller.e2e-spec.ts src/infra/http/controllers/update-appointment.controller.e2e-spec.ts
```

Expected: FAIL because HTTP schemas do not accept `services`.

- [ ] **Step 3: Update create appointment controller schema**

In `src/infra/http/controllers/create-appointment.controller.ts`, add:

```ts
const appointmentServiceItemSchema = z.object({
  serviceId: z.uuid(),
  priceInCents: z.number().int().nonnegative().optional(),
});
```

Change schema fields:

```ts
  serviceIds: z.array(z.uuid()).min(1).optional(),
  services: z.array(appointmentServiceItemSchema).min(1).optional(),
```

Add refine:

```ts
  .refine(
    (value) =>
      (value.serviceIds !== undefined || value.services !== undefined) &&
      !(value.serviceIds !== undefined && value.services !== undefined),
    "Provide either serviceIds or services.",
  );
```

Pass both optional fields:

```ts
      ...(body.serviceIds !== undefined ? { serviceIds: body.serviceIds } : {}),
      ...(body.services !== undefined ? { services: body.services } : {}),
```

- [ ] **Step 4: Update update appointment controller schema**

In `src/infra/http/controllers/update-appointment.controller.ts`, add the same `appointmentServiceItemSchema`.

Change schema:

```ts
    serviceIds: z.array(z.uuid()).min(1).optional(),
    services: z.array(appointmentServiceItemSchema).min(1).optional(),
```

Add refine:

```ts
  .refine(
    (value) =>
      !(value.serviceIds !== undefined && value.services !== undefined),
    "Provide either serviceIds or services.",
  )
```

Pass both optional fields:

```ts
      ...(body.serviceIds !== undefined ? { serviceIds: body.serviceIds } : {}),
      ...(body.services !== undefined ? { services: body.services } : {}),
```

- [ ] **Step 5: Update Swagger appointment DTOs**

In `src/infra/http/docs/domain-swagger.dto.ts`, add:

```ts
export class AppointmentServiceInputDto {
  @ApiProperty({ format: "uuid" })
  serviceId!: string;

  @ApiProperty({ type: Number, required: false, minimum: 0 })
  priceInCents?: number;
}
```

In create/update appointment body DTOs, add:

```ts
  @ApiProperty({ type: [AppointmentServiceInputDto], required: false })
  services?: AppointmentServiceInputDto[];
```

Keep `serviceIds` documented as legacy during transition and mention that callers must provide either `serviceIds` or `services`, not both.

- [ ] **Step 6: Run appointment e2e tests**

Run:

```bash
npm run test:e2e -- src/infra/http/controllers/create-appointment.controller.e2e-spec.ts src/infra/http/controllers/update-appointment.controller.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/infra/http/controllers/create-appointment.controller.ts src/infra/http/controllers/update-appointment.controller.ts src/infra/http/docs/domain-swagger.dto.ts src/infra/http/controllers/create-appointment.controller.e2e-spec.ts src/infra/http/controllers/update-appointment.controller.e2e-spec.ts
git commit -m "feat: accept appointment service item pricing over http"
```

---

### Task 8: Update Quote Snapshot Pricing

**Files:**

- Modify: `src/modules/application/use-cases/quote/create-quote.ts`
- Modify: `src/modules/application/use-cases/quote/create-quote.spec.ts`
- Modify: `src/modules/application/use-cases/quote/create-appointment-from-quote.spec.ts`

- [ ] **Step 1: Add failing quote tests**

In `src/modules/application/use-cases/quote/create-quote.spec.ts`, add:

```ts
it("should snapshot the service default charge price", async () => {
  const service = makeService({
    establishmentId: establishment.id,
    priceSpecification: ServicePriceSpecification.create({
      type: "RANGE",
      minPriceInCents: 30000,
      maxPriceInCents: 60000,
    }),
  });
  await servicesRepository.create(service);

  const result = await sut.execute({
    actor: {
      userId: establishment.ownerId.toString(),
      role: "ESTABLISHMENT",
    },
    customer: {
      name: "Cliente Orcamento",
    },
    serviceItems: [{ serviceId: service.id.toString() }],
    paymentOptions: [
      {
        method: "PIX",
        label: "Pix",
      },
    ],
  });

  expect(result.isRight()).toBe(true);
  if (result.isRight()) {
    expect(result.value.quote.services[0]?.priceInCents).toBe(30000);
  }
});
```

Add import:

```ts
import { ServicePriceSpecification } from "../../../catalog/domain/value-objects/service-price-specification";
```

- [ ] **Step 2: Run quote tests to verify current behavior**

Run:

```bash
npm run test -- src/modules/application/use-cases/quote/create-quote.spec.ts src/modules/application/use-cases/quote/create-appointment-from-quote.spec.ts
```

Expected: FAIL until `create-quote.ts` uses `priceSpecification.defaultChargePriceInCents`.

- [ ] **Step 3: Update quote service snapshot resolution**

In `src/modules/application/use-cases/quote/create-quote.ts`, replace:

```ts
        priceInCents: service.price.amountInCents,
```

with:

```ts
        priceInCents: service.priceSpecification.defaultChargePriceInCents,
```

Do not add manual quote item pricing in this task.

- [ ] **Step 4: Run quote tests**

Run:

```bash
npm run test -- src/modules/application/use-cases/quote/create-quote.spec.ts src/modules/application/use-cases/quote/create-appointment-from-quote.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/modules/application/use-cases/quote/create-quote.ts src/modules/application/use-cases/quote/create-quote.spec.ts src/modules/application/use-cases/quote/create-appointment-from-quote.spec.ts
git commit -m "feat: snapshot default service price in quotes"
```

---

### Task 9: Full Verification And Cleanup

**Files:**

- Modify only files needed to fix failures discovered by the commands below.

- [ ] **Step 1: Run unit test suite**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 2: Run e2e suite**

Run:

```bash
npm run test:e2e
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

- [ ] **Step 5: Run format check**

Run:

```bash
npm run format:check
```

Expected: PASS. If it fails, run:

```bash
npm run format
```

Then rerun:

```bash
npm run format:check
```

Expected: PASS.

- [ ] **Step 6: Inspect final diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: only intended implementation files are modified, with no generated or unrelated files staged accidentally.

- [ ] **Step 7: Commit verification fixes**

If Step 1-6 required fixes, commit them:

```bash
git add prisma/schema.prisma prisma/migrations/20260616120000_service_price_specification/migration.sql src tests
git commit -m "chore: finalize service price specification rollout"
```

If there were no fixes, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Pricing modes are covered in Tasks 1, 3, 4, and 5.
- Catalog display and persistence are covered in Tasks 4 and 5.
- Existing service migration as `FIXED` is covered in Task 4 migration.
- Appointment `serviceIds` and `services` transition contract is covered in Tasks 6 and 7.
- Appointment price validation rules are covered in Task 6.
- Quote default snapshot behavior is covered in Task 8.
- Error handling and e2e coverage are covered in Tasks 5, 6, 7, and 9.

Red-flag scan:

- No incomplete marker language remains.
- Each task lists exact files, commands, expected outcomes, and concrete code snippets for the core changes.

Type consistency:

- The value object consistently uses `ServicePriceSpecification`, `ServicePriceSpecificationValue`, `ServicePriceSpecificationType`, `defaultChargePriceInCents`, and `assertCanCharge`.
- HTTP contracts consistently use `priceSpecification`, `priceInCents`, `serviceIds`, and `services`.
- Prisma persistence consistently uses `priceSpecificationType`, `priceRangeMaxInCents`, and existing `priceInCents`.
