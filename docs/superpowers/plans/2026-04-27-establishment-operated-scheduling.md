# Establishment-Operated Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the customer self-booking/payment scheduling flow with establishment-operated customer, vehicle, and appointment management.

**Architecture:** Remodel the active Prisma schema and domain around establishment-owned customers and optional appointment vehicles. Keep payment domain files for future billing, but remove active payment/checkout persistence, subscribers, providers, and tests that depend on the old appointment model. Expose protected establishment HTTP endpoints for customers, vehicles, and appointments.

**Tech Stack:** Node.js 22, TypeScript, NestJS, Prisma 7, PostgreSQL, Zod, Vitest, Supertest.

---

## Scope Check

This is one plan because the schema, generated Prisma client, domain entities, repositories, HTTP contracts, and legacy cleanup are tightly coupled. A partial implementation cannot typecheck cleanly while the old `Customer`, `Appointment`, `Payment`, `CheckoutRecovery`, and `FavoriteEstablishment` relations still point at removed fields.

## File Structure

Create:

- `src/modules/customer/domain/entities/customer-vehicle.ts`: vehicle aggregate owned by a customer and establishment.
- `src/modules/customer/domain/entities/customer-vehicle.spec.ts`: vehicle domain behavior.
- `src/modules/customer/domain/errors/invalid-customer-input-error.ts`: invalid customer/vehicle input error.
- `src/modules/customer/domain/errors/customer-already-deleted-error.ts`: thrown by repeated customer deletion.
- `src/modules/application/repositories/customer-vehicles-repository.ts`: vehicle repository contract.
- `src/infra/database/prisma/mappers/prisma-customer-vehicle-mapper.ts`: Prisma mapper for vehicles.
- `src/infra/database/prisma/repositories/prisma-customer-vehicles-repository.ts`: Prisma vehicle repository.
- `tests/repositories/in-memory-customer-vehicles-repository.ts`: in-memory vehicle repository.
- `tests/factories/customer-vehicle-factory.ts`: vehicle test factory.
- `src/modules/scheduling/domain/errors/invalid-appointment-input-error.ts`: new appointment input error.
- `src/modules/application/use-cases/customer/create-customer.ts`
- `src/modules/application/use-cases/customer/create-customer.spec.ts`
- `src/modules/application/use-cases/customer/update-customer.ts`
- `src/modules/application/use-cases/customer/update-customer.spec.ts`
- `src/modules/application/use-cases/customer/delete-customer.ts`
- `src/modules/application/use-cases/customer/delete-customer.spec.ts`
- `src/modules/application/use-cases/customer/list-customers.ts`
- `src/modules/application/use-cases/customer/list-customers.spec.ts`
- `src/modules/application/use-cases/customer/create-customer-vehicle.ts`
- `src/modules/application/use-cases/customer/create-customer-vehicle.spec.ts`
- `src/modules/application/use-cases/customer/update-customer-vehicle.ts`
- `src/modules/application/use-cases/customer/update-customer-vehicle.spec.ts`
- `src/modules/application/use-cases/customer/delete-customer-vehicle.ts`
- `src/modules/application/use-cases/customer/delete-customer-vehicle.spec.ts`
- `src/modules/application/use-cases/customer/list-customer-vehicles.ts`
- `src/modules/application/use-cases/customer/list-customer-vehicles.spec.ts`
- `src/modules/application/use-cases/appointment/create-appointment.ts`
- `src/modules/application/use-cases/appointment/create-appointment.spec.ts`
- `src/modules/application/use-cases/appointment/update-appointment-status.ts`
- `src/modules/application/use-cases/appointment/update-appointment-status.spec.ts`
- `src/modules/application/use-cases/appointment/list-appointments.ts`
- `src/modules/application/use-cases/appointment/list-appointments.spec.ts`
- `src/infra/http/controllers/create-customer.controller.ts`
- `src/infra/http/controllers/list-customers.controller.ts`
- `src/infra/http/controllers/update-customer.controller.ts`
- `src/infra/http/controllers/delete-customer.controller.ts`
- `src/infra/http/controllers/create-customer-vehicle.controller.ts`
- `src/infra/http/controllers/list-customer-vehicles.controller.ts`
- `src/infra/http/controllers/update-customer-vehicle.controller.ts`
- `src/infra/http/controllers/delete-customer-vehicle.controller.ts`
- `src/infra/http/controllers/create-appointment.controller.ts`
- `src/infra/http/controllers/list-appointments.controller.ts`
- `src/infra/http/controllers/update-appointment-status.controller.ts`
- `src/infra/http/controllers/create-customer.controller.e2e-spec.ts`
- `src/infra/http/controllers/list-customers.controller.e2e-spec.ts`
- `src/infra/http/controllers/update-customer.controller.e2e-spec.ts`
- `src/infra/http/controllers/delete-customer.controller.e2e-spec.ts`
- `src/infra/http/controllers/create-customer-vehicle.controller.e2e-spec.ts`
- `src/infra/http/controllers/list-customer-vehicles.controller.e2e-spec.ts`
- `src/infra/http/controllers/update-customer-vehicle.controller.e2e-spec.ts`
- `src/infra/http/controllers/delete-customer-vehicle.controller.e2e-spec.ts`
- `src/infra/http/controllers/create-appointment.controller.e2e-spec.ts`
- `src/infra/http/controllers/list-appointments.controller.e2e-spec.ts`
- `src/infra/http/controllers/update-appointment-status.controller.e2e-spec.ts`

Modify:

- `prisma/schema.prisma`: remodel customer, vehicle, appointment, and remove active payment/favorite persistence.
- `src/modules/customer/domain/entities/customer.ts`: internal customer aggregate.
- `src/modules/application/repositories/customers-repository.ts`: new customer query/save contract.
- `src/infra/database/prisma/mappers/prisma-customer-mapper.ts`: new customer shape.
- `src/infra/database/prisma/repositories/prisma-customers-repository.ts`: new filters, ownership queries, save.
- `tests/repositories/in-memory-customers-repository.ts`: new filters, ownership queries, save.
- `tests/factories/customer-factory.ts`: new customer factory.
- `src/modules/scheduling/domain/entities/appointment.ts`: operational appointment aggregate.
- `src/infra/database/prisma/mappers/prisma-appointment-mapper.ts`: new appointment shape.
- `src/infra/database/prisma/repositories/prisma-appointments-repository.ts`: new filters and no overlap query.
- `src/modules/application/repositories/appointments-repository.ts`: new filters and remove interval query.
- `tests/repositories/in-memory-appointments-repository.ts`: new filters and no overlap query.
- `tests/factories/appointment-factory.ts`: new appointment factory.
- `src/infra/http/presenters/appointment-presenter.ts`: new response shape.
- `src/infra/http/docs/domain-swagger.dto.ts`: customer, vehicle, appointment DTOs.
- `src/infra/http/http.module.ts`: register new controllers/use cases and remove old active customer booking controller.
- `src/infra/database/database.module.ts`: register vehicle repository and remove payment/favorite Prisma repositories.
- `src/modules/application/use-cases/establishment/establishment-metrics-helpers.ts`: use `appointment.startsAt` and service snapshots.
- establishment metrics use cases/specs: replace `FINISHED` with `DONE`, subtract `discountInCents`.

Delete from active source:

- `src/infra/http/controllers/register-customer.controller.ts`
- `src/infra/http/controllers/register-customer.controller.e2e-spec.ts`
- `src/infra/http/controllers/book-service.controller.ts`
- `src/infra/http/controllers/book-service.controller.e2e-spec.ts`
- `src/modules/application/services/appointment-booking-service.ts`
- `src/modules/application/services/checkout-compensation-service.ts`
- `src/modules/application/subscribers/appointment/on-appointment-cancelled.ts`
- `src/modules/application/subscribers/payment/on-payment-expired.ts`
- `src/modules/application/subscribers/payment/on-payment-paid.ts`
- `src/modules/application/subscribers/register-domain-event-subscribers.ts`
- `src/modules/application/repositories/favorites-repository.ts`
- `src/modules/application/repositories/payments-repository.ts`
- `src/modules/application/repositories/checkout-recoveries-repository.ts`
- `src/infra/database/prisma/mappers/prisma-favorite-establishment-mapper.ts`
- `src/infra/database/prisma/mappers/prisma-payment-mapper.ts`
- `src/infra/database/prisma/mappers/prisma-checkout-recovery-mapper.ts`
- `src/infra/database/prisma/repositories/prisma-favorites-repository.ts`
- `src/infra/database/prisma/repositories/prisma-payments-repository.ts`
- `src/infra/database/prisma/repositories/prisma-checkout-recoveries-repository.ts`
- `src/modules/customer/domain/entities/favorite-establishment.ts`
- `src/modules/application/use-cases/customer/add-favorite-establishment.ts`
- `src/modules/application/use-cases/customer/add-favorite-establishment.spec.ts`
- `src/modules/application/use-cases/customer/remove-favorite-establishment.ts`
- `src/modules/application/use-cases/customer/remove-favorite-establishment.spec.ts`
- `src/modules/application/use-cases/customer/list-favorite-establishments.ts`
- `src/modules/application/use-cases/customer/list-favorite-establishments.spec.ts`
- `src/modules/application/use-cases/customer/register-customer.ts`
- `src/modules/application/use-cases/customer/register-customer.spec.ts`
- `src/modules/application/use-cases/customer/get-customer.ts`
- `src/modules/application/use-cases/customer/get-customer.spec.ts`
- `src/modules/application/use-cases/payment/expire-pending-pix-payments.ts`
- `src/modules/application/use-cases/payment/expire-pending-pix-payments.spec.ts`
- `src/modules/application/use-cases/payment/get-checkout-status.ts`
- `src/modules/application/use-cases/payment/get-checkout-status.spec.ts`
- `src/modules/application/use-cases/payment/process-payment-webhook.ts`
- `src/modules/application/use-cases/payment/process-payment-webhook.spec.ts`
- `src/modules/application/use-cases/payment/start-appointment-checkout.ts`
- `src/modules/application/use-cases/payment/start-appointment-checkout.spec.ts`
- `tests/factories/payment-factory.ts`
- `tests/helpers/booking.e2e-helpers.ts`
- `tests/repositories/in-memory-favorites-repository.ts`
- `tests/repositories/in-memory-payments-repository.ts`
- `tests/repositories/in-memory-checkout-recoveries-repository.ts`
- `tests/repositories/fake-payment-gateway.ts`

Keep:

- `src/modules/payment/domain/**`
- `src/modules/application/gateways/payment.ts`

## Task 1: Prisma Schema And Migration

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260427120000_establishment_operated_scheduling/migration.sql`
- Modify after generation: `src/generated/prisma/**`

- [ ] **Step 1: Replace active schema models and enums**

In `prisma/schema.prisma`, keep `UserRole`, `OAuthProvider`, and `ServiceCategory`. Remove `PaymentMethod`, `PaymentStatus`, `CheckoutRecoveryReason`, `CheckoutRecoveryStatus`, `Payment`, `CheckoutRecovery`, and `FavoriteEstablishment` from the active schema.

Use this appointment status enum:

```prisma
enum AppointmentStatus {
  SCHEDULED
  DONE
  CANCELLED
}
```

Use this `User` relation shape:

```prisma
model User {
  id             String   @id @default(uuid()) @db.Uuid
  name           String
  email          String   @unique
  hashedPassword String?  @map("hashed_password")
  role           UserRole
  phone          String?  @db.VarChar(11)
  address        Json?
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @default(now()) @updatedAt @map("updated_at")

  socialAccounts     SocialAccount[]
  sessions           Session[]
  passwordResetToken PasswordResetToken?
  ownedEstablishment Establishment?      @relation("EstablishmentOwner")

  @@index([role])
  @@map("users")
}
```

Use this `Customer` model:

```prisma
model Customer {
  id              String    @id @default(uuid()) @db.Uuid
  establishmentId String    @map("establishment_id") @db.Uuid
  cpfCnpj         String?   @map("cpf_cnpj") @db.VarChar(14)
  fullName        String    @map("full_name")
  phone           String    @db.VarChar(11)
  email           String
  address         Json?
  birthDate       DateTime? @map("birth_date")
  nickname        String?
  deletedAt       DateTime? @map("deleted_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @default(now()) @updatedAt @map("updated_at")

  establishment Establishment      @relation(fields: [establishmentId], references: [id], onDelete: Restrict)
  vehicles      CustomerVehicle[]
  appointments  Appointment[]

  @@index([establishmentId])
  @@index([establishmentId, fullName])
  @@index([establishmentId, phone])
  @@index([establishmentId, email])
  @@index([establishmentId, deletedAt])
  @@map("customers")
}
```

Use this `CustomerVehicle` model:

```prisma
model CustomerVehicle {
  id              String    @id @default(uuid()) @db.Uuid
  establishmentId String    @map("establishment_id") @db.Uuid
  customerId      String    @map("customer_id") @db.Uuid
  plate           String?   @db.VarChar(12)
  brand           String?
  model           String?
  color           String?
  year            Int?
  notes           String?   @db.Text
  deletedAt       DateTime? @map("deleted_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @default(now()) @updatedAt @map("updated_at")

  establishment Establishment @relation(fields: [establishmentId], references: [id], onDelete: Restrict)
  customer      Customer      @relation(fields: [customerId], references: [id], onDelete: Restrict)
  appointments  Appointment[]

  @@index([establishmentId])
  @@index([customerId])
  @@index([establishmentId, plate])
  @@index([establishmentId, deletedAt])
  @@map("customer_vehicles")
}
```

Update `Establishment` relations to:

```prisma
  services     Service[]
  customers    Customer[]
  vehicles     CustomerVehicle[]
  appointments Appointment[]           @relation("EstablishmentAppointments")
```

Use this `Appointment` model:

```prisma
model Appointment {
  id                             String            @id @default(uuid()) @db.Uuid
  establishmentId                String            @map("establishment_id") @db.Uuid
  customerId                     String            @map("customer_id") @db.Uuid
  vehicleId                      String?           @map("vehicle_id") @db.Uuid
  bookedServiceId                String            @map("booked_service_id") @db.Uuid
  bookedServiceName              String            @map("booked_service_name") @db.VarChar(72)
  bookedServiceCategory          ServiceCategory?  @map("booked_service_category")
  bookedServiceDurationInMinutes Int?              @map("booked_service_duration_in_minutes")
  bookedServicePriceInCents      Int               @map("booked_service_price_in_cents")
  vehiclePlate                   String?           @map("vehicle_plate") @db.VarChar(12)
  vehicleBrand                   String?           @map("vehicle_brand")
  vehicleModel                   String?           @map("vehicle_model")
  vehicleColor                   String?           @map("vehicle_color")
  vehicleYear                    Int?              @map("vehicle_year")
  startsAt                       DateTime          @map("starts_at")
  endsAt                         DateTime?         @map("ends_at")
  description                    String?           @db.Text
  discountInCents                Int?              @map("discount_in_cents")
  status                         AppointmentStatus @default(SCHEDULED)
  createdAt                      DateTime          @default(now()) @map("created_at")
  updatedAt                      DateTime          @default(now()) @updatedAt @map("updated_at")
  doneAt                         DateTime?         @map("done_at")
  cancelledAt                    DateTime?         @map("cancelled_at")

  establishment Establishment    @relation("EstablishmentAppointments", fields: [establishmentId], references: [id], onDelete: Restrict)
  customer      Customer         @relation(fields: [customerId], references: [id], onDelete: Restrict)
  vehicle       CustomerVehicle? @relation(fields: [vehicleId], references: [id], onDelete: Restrict)
  bookedService Service          @relation("BookedServiceAppointments", fields: [bookedServiceId], references: [id], onDelete: Restrict)

  @@index([establishmentId])
  @@index([customerId])
  @@index([vehicleId])
  @@index([bookedServiceId])
  @@index([establishmentId, startsAt])
  @@index([establishmentId, status])
  @@index([establishmentId, customerId])
  @@index([establishmentId, vehicleId])
  @@map("appointments")
}
```

- [ ] **Step 2: Create migration**

Create the migration with Prisma:

```bash
npx prisma migrate dev --name establishment_operated_scheduling
```

Expected: Prisma creates a new migration. Rename the generated migration directory to `20260427120000_establishment_operated_scheduling` before editing the SQL file. If migration apply fails because existing local rows reference removed models, run `npx prisma migrate reset`, confirm the prompt, then rerun the migrate command.

- [ ] **Step 3: Add partial unique indexes to the generated migration**

Open the new `migration.sql` and append:

```sql
CREATE UNIQUE INDEX "customers_establishment_cpf_cnpj_active_unique"
ON "customers"("establishment_id", "cpf_cnpj")
WHERE "cpf_cnpj" IS NOT NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "customer_vehicles_establishment_plate_active_unique"
ON "customer_vehicles"("establishment_id", "plate")
WHERE "plate" IS NOT NULL AND "deleted_at" IS NULL;
```

- [ ] **Step 4: Generate Prisma client**

Run:

```bash
npm run prisma:generate
```

Expected: PASS and regenerated files under `src/generated/prisma`.

- [ ] **Step 5: Commit schema foundation**

```bash
git add prisma/schema.prisma prisma/migrations src/generated/prisma
git commit -m "refactor: remodel scheduling schema"
```

## Task 2: Customer And Vehicle Domain

**Files:**

- Modify: `src/modules/customer/domain/entities/customer.ts`
- Create: `src/modules/customer/domain/entities/customer-vehicle.ts`
- Create: `src/modules/customer/domain/entities/customer.spec.ts`
- Create: `src/modules/customer/domain/entities/customer-vehicle.spec.ts`
- Create: `src/modules/customer/domain/errors/invalid-customer-input-error.ts`
- Create: `src/modules/customer/domain/errors/customer-already-deleted-error.ts`
- Modify: `tests/factories/customer-factory.ts`
- Create: `tests/factories/customer-vehicle-factory.ts`

- [ ] **Step 1: Write customer domain tests**

Create `src/modules/customer/domain/entities/customer.spec.ts`:

```ts
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Address } from "../../../accounts/domain/value-objects/address";
import { Email } from "../../../accounts/domain/value-objects/email";
import { Phone } from "../../../accounts/domain/value-objects/phone";
import { Customer } from "./customer";

describe("Customer", () => {
  it("should create an establishment-owned customer", () => {
    const customer = Customer.create({
      establishmentId: new UniqueEntityId("establishment-1"),
      cpfCnpj: "12345678900",
      fullName: "Maria Silva",
      phone: Phone.create("11999999999"),
      email: new Email("maria@example.com"),
      address: Address.create({
        street: "Rua A",
        country: "Brasil",
        state: "SP",
        zipCode: "01001-000",
        city: "Sao Paulo",
      }),
      birthDate: new Date("1990-01-01"),
      nickname: "Maria",
    });

    expect(customer.establishmentId.toString()).toBe("establishment-1");
    expect(customer.cpfCnpj).toBe("12345678900");
    expect(customer.fullName).toBe("Maria Silva");
    expect(customer.deletedAt).toBeNull();
    expect(customer.isDeleted()).toBe(false);
  });

  it("should soft-delete a customer", () => {
    const customer = Customer.create({
      establishmentId: new UniqueEntityId("establishment-1"),
      cpfCnpj: null,
      fullName: "Jose Silva",
      phone: Phone.create("11988888888"),
      email: new Email("jose@example.com"),
      address: null,
      birthDate: null,
      nickname: null,
    });

    const deletedAt = new Date("2026-04-27T10:00:00.000Z");
    customer.softDelete(deletedAt);

    expect(customer.deletedAt).toEqual(deletedAt);
    expect(customer.isDeleted()).toBe(true);
  });
});
```

- [ ] **Step 2: Write vehicle domain tests**

Create `src/modules/customer/domain/entities/customer-vehicle.spec.ts`:

```ts
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { CustomerVehicle } from "./customer-vehicle";

describe("CustomerVehicle", () => {
  it("should create a vehicle for a customer and establishment", () => {
    const vehicle = CustomerVehicle.create({
      establishmentId: new UniqueEntityId("establishment-1"),
      customerId: new UniqueEntityId("customer-1"),
      plate: "ABC1D23",
      brand: "Toyota",
      model: "Corolla",
      color: "Prata",
      year: 2022,
      notes: "Veiculo principal",
    });

    expect(vehicle.establishmentId.toString()).toBe("establishment-1");
    expect(vehicle.customerId.toString()).toBe("customer-1");
    expect(vehicle.plate).toBe("ABC1D23");
    expect(vehicle.deletedAt).toBeNull();
  });

  it("should soft-delete a vehicle", () => {
    const vehicle = CustomerVehicle.create({
      establishmentId: new UniqueEntityId("establishment-1"),
      customerId: new UniqueEntityId("customer-1"),
      plate: null,
      brand: null,
      model: null,
      color: null,
      year: null,
      notes: null,
    });

    const deletedAt = new Date("2026-04-27T10:00:00.000Z");
    vehicle.softDelete(deletedAt);

    expect(vehicle.deletedAt).toEqual(deletedAt);
    expect(vehicle.isDeleted()).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm run test -- src/modules/customer/domain/entities/customer.spec.ts src/modules/customer/domain/entities/customer-vehicle.spec.ts
```

Expected: FAIL because the customer entity still has `userId/cpf` shape and `customer-vehicle.ts` does not exist.

- [ ] **Step 4: Add customer input errors**

Create `src/modules/customer/domain/errors/invalid-customer-input-error.ts`:

```ts
export class InvalidCustomerInputError extends Error {
  constructor(message = "Invalid customer input.") {
    super(message);
    this.name = "InvalidCustomerInputError";
  }
}
```

Create `src/modules/customer/domain/errors/customer-already-deleted-error.ts`:

```ts
export class CustomerAlreadyDeletedError extends Error {
  constructor() {
    super("Customer is already deleted.");
    this.name = "CustomerAlreadyDeletedError";
  }
}
```

- [ ] **Step 5: Replace Customer entity**

Replace `src/modules/customer/domain/entities/customer.ts` with:

```ts
import { AggregateRoot } from "../../../../shared/entities/aggregate-root";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Optional } from "../../../../shared/types/optional";
import { Address } from "../../../accounts/domain/value-objects/address";
import { Email } from "../../../accounts/domain/value-objects/email";
import { Phone } from "../../../accounts/domain/value-objects/phone";
import { CustomerAlreadyDeletedError } from "../errors/customer-already-deleted-error";
import { InvalidCustomerInputError } from "../errors/invalid-customer-input-error";

export type CustomerProps = {
  establishmentId: UniqueEntityId;
  cpfCnpj: string | null;
  fullName: string;
  phone: Phone;
  email: Email;
  address: Address | null;
  birthDate: Date | null;
  nickname: string | null;
  deletedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export class Customer extends AggregateRoot<CustomerProps> {
  get establishmentId() {
    return this.props.establishmentId;
  }

  get cpfCnpj() {
    return this.props.cpfCnpj;
  }

  get fullName() {
    return this.props.fullName;
  }

  get phone() {
    return this.props.phone;
  }

  get email() {
    return this.props.email;
  }

  get address() {
    return this.props.address;
  }

  get birthDate() {
    return this.props.birthDate;
  }

  get nickname() {
    return this.props.nickname;
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

  static create(
    props: Optional<CustomerProps, "createdAt" | "updatedAt" | "deletedAt">,
    id?: UniqueEntityId,
  ) {
    const customer = new Customer(
      {
        ...props,
        cpfCnpj: Customer.normalizeCpfCnpj(props.cpfCnpj),
        fullName: Customer.normalizeRequiredText(props.fullName, "fullName"),
        nickname: Customer.normalizeOptionalText(props.nickname),
        deletedAt: props.deletedAt ?? null,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id,
    );

    return customer;
  }

  update(data: {
    cpfCnpj?: string | null;
    fullName?: string;
    phone?: Phone;
    email?: Email;
    address?: Address | null;
    birthDate?: Date | null;
    nickname?: string | null;
  }) {
    if (this.isDeleted()) {
      throw new CustomerAlreadyDeletedError();
    }

    if (data.cpfCnpj !== undefined) {
      this.props.cpfCnpj = Customer.normalizeCpfCnpj(data.cpfCnpj);
    }

    if (data.fullName !== undefined) {
      this.props.fullName = Customer.normalizeRequiredText(
        data.fullName,
        "fullName",
      );
    }

    if (data.phone !== undefined) {
      this.props.phone = data.phone;
    }

    if (data.email !== undefined) {
      this.props.email = data.email;
    }

    if (data.address !== undefined) {
      this.props.address = data.address;
    }

    if (data.birthDate !== undefined) {
      this.props.birthDate = data.birthDate;
    }

    if (data.nickname !== undefined) {
      this.props.nickname = Customer.normalizeOptionalText(data.nickname);
    }

    this.touch();
  }

  softDelete(referenceDate: Date = new Date()) {
    if (this.isDeleted()) {
      throw new CustomerAlreadyDeletedError();
    }

    this.props.deletedAt = referenceDate;
    this.touch();
  }

  isDeleted() {
    return this.props.deletedAt !== null;
  }

  private touch() {
    this.props.updatedAt = new Date();
  }

  private static normalizeCpfCnpj(value: string | null) {
    if (value === null) {
      return null;
    }

    const normalized = value.replace(/\D/g, "");

    if (!normalized) {
      return null;
    }

    if (normalized.length !== 11 && normalized.length !== 14) {
      throw new InvalidCustomerInputError("cpfCnpj must have 11 or 14 digits.");
    }

    return normalized;
  }

  private static normalizeRequiredText(value: string, field: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new InvalidCustomerInputError(`${field} is required.`);
    }

    return normalized;
  }

  private static normalizeOptionalText(value: string | null) {
    if (value === null) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }
}
```

- [ ] **Step 6: Add CustomerVehicle entity**

Create `src/modules/customer/domain/entities/customer-vehicle.ts`:

```ts
import { AggregateRoot } from "../../../../shared/entities/aggregate-root";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Optional } from "../../../../shared/types/optional";
import { InvalidCustomerInputError } from "../errors/invalid-customer-input-error";

export type CustomerVehicleProps = {
  establishmentId: UniqueEntityId;
  customerId: UniqueEntityId;
  plate: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
  notes: string | null;
  deletedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export class CustomerVehicle extends AggregateRoot<CustomerVehicleProps> {
  get establishmentId() {
    return this.props.establishmentId;
  }

  get customerId() {
    return this.props.customerId;
  }

  get plate() {
    return this.props.plate;
  }

  get brand() {
    return this.props.brand;
  }

  get model() {
    return this.props.model;
  }

  get color() {
    return this.props.color;
  }

  get year() {
    return this.props.year;
  }

  get notes() {
    return this.props.notes;
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

  static create(
    props: Optional<
      CustomerVehicleProps,
      "createdAt" | "updatedAt" | "deletedAt"
    >,
    id?: UniqueEntityId,
  ) {
    return new CustomerVehicle(
      {
        ...props,
        plate: CustomerVehicle.normalizePlate(props.plate),
        brand: CustomerVehicle.normalizeOptionalText(props.brand),
        model: CustomerVehicle.normalizeOptionalText(props.model),
        color: CustomerVehicle.normalizeOptionalText(props.color),
        notes: CustomerVehicle.normalizeOptionalText(props.notes),
        year: CustomerVehicle.normalizeYear(props.year),
        deletedAt: props.deletedAt ?? null,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id,
    );
  }

  update(data: {
    plate?: string | null;
    brand?: string | null;
    model?: string | null;
    color?: string | null;
    year?: number | null;
    notes?: string | null;
  }) {
    if (data.plate !== undefined) {
      this.props.plate = CustomerVehicle.normalizePlate(data.plate);
    }

    if (data.brand !== undefined) {
      this.props.brand = CustomerVehicle.normalizeOptionalText(data.brand);
    }

    if (data.model !== undefined) {
      this.props.model = CustomerVehicle.normalizeOptionalText(data.model);
    }

    if (data.color !== undefined) {
      this.props.color = CustomerVehicle.normalizeOptionalText(data.color);
    }

    if (data.year !== undefined) {
      this.props.year = CustomerVehicle.normalizeYear(data.year);
    }

    if (data.notes !== undefined) {
      this.props.notes = CustomerVehicle.normalizeOptionalText(data.notes);
    }

    this.touch();
  }

  softDelete(referenceDate: Date = new Date()) {
    this.props.deletedAt = referenceDate;
    this.touch();
  }

  isDeleted() {
    return this.props.deletedAt !== null;
  }

  private touch() {
    this.props.updatedAt = new Date();
  }

  private static normalizePlate(value: string | null) {
    if (value === null) {
      return null;
    }

    const normalized = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    if (!normalized) {
      return null;
    }

    if (normalized.length > 12) {
      throw new InvalidCustomerInputError("plate must have at most 12 chars.");
    }

    return normalized;
  }

  private static normalizeYear(value: number | null) {
    if (value === null) {
      return null;
    }

    if (!Number.isInteger(value) || value < 1900) {
      throw new InvalidCustomerInputError("year must be a valid integer.");
    }

    return value;
  }

  private static normalizeOptionalText(value: string | null) {
    if (value === null) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }
}
```

- [ ] **Step 7: Update factories**

Replace `tests/factories/customer-factory.ts` and add `tests/factories/customer-vehicle-factory.ts` using the new entity props. Ensure `CustomerFactory.makePrismaCustomer()` uses `PrismaCustomerMapper.toPrisma(customer)`.

The customer factory must default to:

```ts
{
  establishmentId: new UniqueEntityId(),
  cpfCnpj: "52998224725",
  fullName: "Maria Silva",
  phone: Phone.create("11999999999"),
  email: new Email("maria@example.com"),
  address: null,
  birthDate: null,
  nickname: null,
}
```

The vehicle factory must default to:

```ts
{
  establishmentId: new UniqueEntityId(),
  customerId: new UniqueEntityId(),
  plate: "ABC1D23",
  brand: "Toyota",
  model: "Corolla",
  color: "Prata",
  year: 2022,
  notes: null,
}
```

- [ ] **Step 8: Run customer and vehicle domain tests**

Run:

```bash
npm run test -- src/modules/customer/domain/entities/customer.spec.ts src/modules/customer/domain/entities/customer-vehicle.spec.ts
```

Expected: PASS.

- [ ] **Step 9: Commit customer domain**

```bash
git add src/modules/customer/domain tests/factories/customer-factory.ts tests/factories/customer-vehicle-factory.ts
git commit -m "refactor: remodel customer domain"
```

## Task 3: Customer And Vehicle Repositories

**Files:**

- Modify: `src/modules/application/repositories/customers-repository.ts`
- Create: `src/modules/application/repositories/customer-vehicles-repository.ts`
- Modify: `src/infra/database/prisma/mappers/prisma-customer-mapper.ts`
- Create: `src/infra/database/prisma/mappers/prisma-customer-vehicle-mapper.ts`
- Modify: `src/infra/database/prisma/repositories/prisma-customers-repository.ts`
- Create: `src/infra/database/prisma/repositories/prisma-customer-vehicles-repository.ts`
- Modify: `tests/repositories/in-memory-customers-repository.ts`
- Create: `tests/repositories/in-memory-customer-vehicles-repository.ts`
- Modify: `src/infra/database/database.module.ts`

- [ ] **Step 1: Replace customer repository contract**

Use this contract in `src/modules/application/repositories/customers-repository.ts`:

```ts
import { PaginationParams } from "../../../shared/types/pagination-params";
import { Customer } from "../../customer/domain/entities/customer";

export type CustomerFilters = {
  search?: string;
  includeDeleted?: boolean;
} & PaginationParams;

export abstract class CustomersRepository {
  abstract create(customer: Customer): Promise<void>;
  abstract findById(id: string): Promise<Customer | null>;
  abstract findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<Customer | null>;
  abstract findActiveByCpfCnpjAndEstablishmentId(
    cpfCnpj: string,
    establishmentId: string,
  ): Promise<Customer | null>;
  abstract findManyByEstablishmentId(
    establishmentId: string,
    filters?: CustomerFilters,
  ): Promise<Customer[]>;
  abstract save(customer: Customer): Promise<void>;
}
```

- [ ] **Step 2: Add vehicle repository contract**

Create `src/modules/application/repositories/customer-vehicles-repository.ts`:

```ts
import { PaginationParams } from "../../../shared/types/pagination-params";
import { CustomerVehicle } from "../../customer/domain/entities/customer-vehicle";

export type CustomerVehicleFilters = {
  includeDeleted?: boolean;
} & PaginationParams;

export abstract class CustomerVehiclesRepository {
  abstract create(vehicle: CustomerVehicle): Promise<void>;
  abstract findById(id: string): Promise<CustomerVehicle | null>;
  abstract findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<CustomerVehicle | null>;
  abstract findByIdAndCustomerIdAndEstablishmentId(
    id: string,
    customerId: string,
    establishmentId: string,
  ): Promise<CustomerVehicle | null>;
  abstract findActiveByPlateAndEstablishmentId(
    plate: string,
    establishmentId: string,
  ): Promise<CustomerVehicle | null>;
  abstract findManyByCustomerIdAndEstablishmentId(
    customerId: string,
    establishmentId: string,
    filters?: CustomerVehicleFilters,
  ): Promise<CustomerVehicle[]>;
  abstract save(vehicle: CustomerVehicle): Promise<void>;
}
```

- [ ] **Step 3: Update Prisma mappers**

Replace `PrismaCustomerMapper` with mapping for `establishmentId`, `cpfCnpj`, `fullName`, `phone`, `email`, `address`, `birthDate`, `nickname`, `deletedAt`, timestamps.

Create `PrismaCustomerVehicleMapper` with mapping for all `CustomerVehicle` fields. Use `Prisma.CustomerUncheckedCreateInput`, `Prisma.CustomerUncheckedUpdateInput`, `Prisma.CustomerVehicleUncheckedCreateInput`, and `Prisma.CustomerVehicleUncheckedUpdateInput` from `src/generated/prisma/client`.

- [ ] **Step 4: Update Prisma repositories**

`PrismaCustomersRepository.findManyByEstablishmentId()` must use:

```ts
where: {
  establishmentId,
  ...(filters?.includeDeleted ? {} : { deletedAt: null }),
  ...(filters?.search
    ? {
        OR: [
          { fullName: { contains: filters.search, mode: "insensitive" } },
          { phone: { contains: filters.search } },
          { email: { contains: filters.search, mode: "insensitive" } },
          { cpfCnpj: { contains: filters.search.replace(/\D/g, "") } },
        ],
      }
    : {}),
}
```

`PrismaCustomerVehiclesRepository.findManyByCustomerIdAndEstablishmentId()` must filter by `customerId`, `establishmentId`, and `deletedAt: null` unless `includeDeleted` is true.

- [ ] **Step 5: Update in-memory repositories**

The in-memory repositories must implement the same contracts. Normalize customer `cpfCnpj` and vehicle `plate` comparisons by using the domain object values already stored on `Customer` and `CustomerVehicle`.

- [ ] **Step 6: Register repository in DatabaseModule**

In `src/infra/database/database.module.ts`, import and register:

```ts
{
  provide: CustomerVehiclesRepository,
  useClass: PrismaCustomerVehiclesRepository,
}
```

Remove providers and exports for `FavoritesRepository`, `PaymentsRepository`, and `CheckoutRecoveriesRepository`.

- [ ] **Step 7: Run typecheck for repository surface**

Run:

```bash
npm run typecheck
```

Expected: FAIL only because old use cases/controllers still reference removed repository methods and removed legacy repositories. Record the failing file list and continue to cleanup tasks.

- [ ] **Step 8: Commit repository remodel**

```bash
git add src/modules/application/repositories src/infra/database/prisma/mappers src/infra/database/prisma/repositories tests/repositories src/infra/database/database.module.ts
git commit -m "refactor: add customer vehicle repositories"
```

## Task 4: Appointment Domain And Persistence

**Files:**

- Modify: `src/modules/scheduling/domain/entities/appointment.ts`
- Modify: `src/modules/scheduling/domain/entities/appointment.spec.ts`
- Create: `src/modules/scheduling/domain/errors/invalid-appointment-input-error.ts`
- Modify: `src/modules/application/repositories/appointments-repository.ts`
- Modify: `src/infra/database/prisma/mappers/prisma-appointment-mapper.ts`
- Modify: `src/infra/database/prisma/repositories/prisma-appointments-repository.ts`
- Modify: `tests/repositories/in-memory-appointments-repository.ts`
- Modify: `tests/factories/appointment-factory.ts`
- Modify: `src/infra/http/presenters/appointment-presenter.ts`

- [ ] **Step 1: Write appointment domain tests**

Replace `src/modules/scheduling/domain/entities/appointment.spec.ts` with tests for:

```ts
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Appointment } from "./appointment";

const baseProps = {
  establishmentId: new UniqueEntityId("establishment-1"),
  customerId: new UniqueEntityId("customer-1"),
  vehicleId: null,
  service: {
    serviceId: new UniqueEntityId("service-1"),
    serviceName: "Lavagem simples",
    category: "WASH" as const,
    durationInMinutes: 60,
    priceInCents: 3000,
  },
  vehicle: null,
  startsAt: new Date("2026-04-27T10:00:00.000Z"),
  endsAt: null,
  description: null,
  discountInCents: null,
};
```

Assert:

- `Appointment.create(baseProps).status` is `SCHEDULED`.
- `Appointment.create({ ...baseProps, endsAt: null })` succeeds.
- `Appointment.create({ ...baseProps, endsAt: new Date("2026-04-27T09:00:00.000Z") })` throws `InvalidAppointmentInputError`.
- `Appointment.create({ ...baseProps, discountInCents: -1 })` throws `InvalidAppointmentInputError`.
- `appointment.changeStatus("DONE", date)` sets `doneAt` and clears `cancelledAt`.
- `appointment.changeStatus("CANCELLED", date)` sets `cancelledAt` and clears `doneAt`.
- `appointment.changeStatus("SCHEDULED", date)` clears both timestamps.

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- src/modules/scheduling/domain/entities/appointment.spec.ts
```

Expected: FAIL because the old appointment entity still requires `TimeSlot`, payment fields, and old status values.

- [ ] **Step 3: Add new appointment input error**

Create `src/modules/scheduling/domain/errors/invalid-appointment-input-error.ts`:

```ts
export class InvalidAppointmentInputError extends Error {
  constructor(message = "Invalid appointment input.") {
    super(message);
    this.name = "InvalidAppointmentInputError";
  }
}
```

- [ ] **Step 4: Replace Appointment entity**

Replace `src/modules/scheduling/domain/entities/appointment.ts` with an aggregate that exposes:

```ts
export type AppointmentStatus = "SCHEDULED" | "DONE" | "CANCELLED";

export type AppointmentServiceSnapshot = {
  serviceId: UniqueEntityId;
  serviceName: string;
  category: ServiceCategory | undefined;
  durationInMinutes: number | undefined;
  priceInCents: number;
};

export type AppointmentVehicleSnapshot = {
  plate: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
} | null;
```

Properties must include `establishmentId`, `customerId`, `vehicleId`, `service`, `vehicle`, `startsAt`, `endsAt`, `description`, `discountInCents`, `status`, `createdAt`, `updatedAt`, `doneAt`, and `cancelledAt`.

The `create()` method must default `status` to `SCHEDULED`, timestamps to `new Date()`, `doneAt` and `cancelledAt` to `null`, normalize empty `description` to `null`, reject invalid dates, reject `endsAt <= startsAt`, and reject negative `discountInCents`.

Add:

```ts
changeStatus(status: AppointmentStatus, referenceDate: Date = new Date()) {
  this.props.status = status;

  if (status === "DONE") {
    this.props.doneAt = referenceDate;
    this.props.cancelledAt = null;
  }

  if (status === "CANCELLED") {
    this.props.cancelledAt = referenceDate;
    this.props.doneAt = null;
  }

  if (status === "SCHEDULED") {
    this.props.doneAt = null;
    this.props.cancelledAt = null;
  }

  this.touch();
}
```

Remove methods and imports for payment windows, domain events, `TimeSlot`, `BookedServiceSnapshot`, `blocksTimeSlot()`, `confirmPayment()`, `expirePayment()`, `advanceStatus()`, and `reschedule()`.

- [ ] **Step 5: Update appointment repository contract**

Replace `src/modules/application/repositories/appointments-repository.ts` with:

```ts
import { PaginationParams } from "../../../shared/types/pagination-params";
import {
  Appointment,
  AppointmentStatus,
} from "../../scheduling/domain/entities/appointment";

export type AppointmentFilters = {
  customerId?: string;
  vehicleId?: string;
  serviceId?: string;
  status?: AppointmentStatus;
  startsAt?: Date;
  endsAt?: Date;
} & PaginationParams;

export abstract class AppointmentsRepository {
  abstract create(appointment: Appointment): Promise<void>;
  abstract findById(id: string): Promise<Appointment | null>;
  abstract findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<Appointment | null>;
  abstract findManyByEstablishmentId(
    establishmentId: string,
    filters?: AppointmentFilters,
  ): Promise<Appointment[]>;
  abstract save(appointment: Appointment): Promise<void>;
}
```

- [ ] **Step 6: Update Prisma and in-memory appointment persistence**

Mapper must read/write all new appointment fields and use direct `startsAt`/`endsAt` properties, not `slot`.

Repository `findManyByEstablishmentId()` must filter:

```ts
where: {
  establishmentId,
  ...(filters?.customerId ? { customerId: filters.customerId } : {}),
  ...(filters?.vehicleId ? { vehicleId: filters.vehicleId } : {}),
  ...(filters?.serviceId ? { bookedServiceId: filters.serviceId } : {}),
  ...(filters?.status ? { status: filters.status } : {}),
  ...(filters?.startsAt || filters?.endsAt
    ? {
        startsAt: {
          ...(filters.startsAt ? { gte: filters.startsAt } : {}),
          ...(filters.endsAt ? { lte: filters.endsAt } : {}),
        },
      }
    : {}),
}
```

Remove `findManyByEstablishmentIdAndInterval()` from Prisma and in-memory repositories.

- [ ] **Step 7: Update presenter**

`AppointmentPresenter.toHTTP()` must return:

```ts
{
  id,
  establishmentId,
  customerId,
  vehicleId,
  service: { id, name, category, durationInMinutes, priceInCents },
  vehicle: null | { plate, brand, model, color, year },
  startsAt,
  endsAt,
  description,
  discountInCents,
  status,
  createdAt,
  updatedAt,
  doneAt,
  cancelledAt,
}
```

- [ ] **Step 8: Run appointment domain test**

Run:

```bash
npm run test -- src/modules/scheduling/domain/entities/appointment.spec.ts
```

Expected: PASS.

- [ ] **Step 9: Commit appointment domain and persistence**

```bash
git add src/modules/scheduling/domain src/modules/application/repositories/appointments-repository.ts src/infra/database/prisma/mappers/prisma-appointment-mapper.ts src/infra/database/prisma/repositories/prisma-appointments-repository.ts tests/repositories/in-memory-appointments-repository.ts tests/factories/appointment-factory.ts src/infra/http/presenters/appointment-presenter.ts
git commit -m "refactor: remodel appointment domain"
```

## Task 5: Customer And Vehicle Use Cases

**Files:**

- Create/modify all customer and vehicle use cases listed in File Structure.

- [ ] **Step 1: Write use case tests**

Add tests for:

- duplicate `cpfCnpj` in the same establishment returns `ResourceAlreadyExistsError`;
- same `cpfCnpj` in another establishment succeeds;
- update customer rejects records outside the establishment with `ResourceNotFoundError`;
- delete customer sets `deletedAt`;
- creating a vehicle validates active customer ownership;
- duplicate vehicle plate in the same establishment returns `ResourceAlreadyExistsError`;
- update/delete/list vehicle validates customer and establishment ownership.

- [ ] **Step 2: Run use case tests to verify failure**

Run:

```bash
npm run test -- src/modules/application/use-cases/customer/create-customer.spec.ts src/modules/application/use-cases/customer/update-customer.spec.ts src/modules/application/use-cases/customer/delete-customer.spec.ts src/modules/application/use-cases/customer/list-customers.spec.ts src/modules/application/use-cases/customer/create-customer-vehicle.spec.ts src/modules/application/use-cases/customer/update-customer-vehicle.spec.ts src/modules/application/use-cases/customer/delete-customer-vehicle.spec.ts src/modules/application/use-cases/customer/list-customer-vehicles.spec.ts
```

Expected: FAIL because the use cases do not exist.

- [ ] **Step 3: Implement customer use cases**

Each customer use case must resolve the establishment by owner id:

```ts
const establishment =
  await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

if (!establishment) {
  return left(new ResourceNotFoundError({ resource: "establishment" }));
}
```

`CreateCustomerUseCase` request:

```ts
type CreateCustomerUseCaseRequest = {
  establishmentOwnerId: string;
  cpfCnpj?: string | null;
  fullName: string;
  phone: string;
  email: string;
  address?: AddressProps | null;
  birthDate?: Date | null;
  nickname?: string | null;
};
```

`UpdateCustomerUseCase` request:

```ts
type UpdateCustomerUseCaseRequest = {
  establishmentOwnerId: string;
  customerId: string;
  cpfCnpj?: string | null;
  fullName?: string;
  phone?: string;
  email?: string;
  address?: AddressProps | null;
  birthDate?: Date | null;
  nickname?: string | null;
};
```

`DeleteCustomerUseCase` request:

```ts
type DeleteCustomerUseCaseRequest = {
  establishmentOwnerId: string;
  customerId: string;
};
```

`ListCustomersUseCase` request:

```ts
type ListCustomersUseCaseRequest = {
  establishmentOwnerId: string;
  search?: string;
  page?: number;
  size?: number;
};
```

- [ ] **Step 4: Implement vehicle use cases**

Vehicle use cases must look up the active customer with:

```ts
const customer = await this.customersRepository.findByIdAndEstablishmentId(
  customerId,
  establishment.id.toString(),
);

if (!customer || customer.isDeleted()) {
  return left(new ResourceNotFoundError({ resource: "customer" }));
}
```

When `plate` is provided, check:

```ts
const vehicleWithSamePlate =
  await this.customerVehiclesRepository.findActiveByPlateAndEstablishmentId(
    CustomerVehicle.create({
      establishmentId: establishment.id,
      customerId: customer.id,
      plate,
      brand: null,
      model: null,
      color: null,
      year: null,
      notes: null,
    }).plate!,
    establishment.id.toString(),
  );
```

Return `ResourceAlreadyExistsError("Vehicle already registered.")` when the found vehicle id differs from the current vehicle id.

- [ ] **Step 5: Run use case tests**

Run the same command from Step 2.

Expected: PASS.

- [ ] **Step 6: Commit customer and vehicle use cases**

```bash
git add src/modules/application/use-cases/customer
git commit -m "feat: add establishment customer use cases"
```

## Task 6: Appointment Use Cases

**Files:**

- Delete old appointment use cases/specs listed in File Structure.
- Create: `src/modules/application/use-cases/appointment/create-appointment.ts`
- Create: `src/modules/application/use-cases/appointment/create-appointment.spec.ts`
- Create: `src/modules/application/use-cases/appointment/update-appointment-status.ts`
- Create: `src/modules/application/use-cases/appointment/update-appointment-status.spec.ts`
- Create: `src/modules/application/use-cases/appointment/list-appointments.ts`
- Create: `src/modules/application/use-cases/appointment/list-appointments.spec.ts`

- [ ] **Step 1: Delete old appointment use case files**

Run:

```bash
git rm src/modules/application/use-cases/appointment/book-service.ts src/modules/application/use-cases/appointment/book-service.spec.ts src/modules/application/use-cases/appointment/rebook-service.ts src/modules/application/use-cases/appointment/rebook-service.spec.ts src/modules/application/use-cases/appointment/cancel-book-service.ts src/modules/application/use-cases/appointment/cancel-book-service.spec.ts src/modules/application/use-cases/appointment/advance-book-service-status.ts src/modules/application/use-cases/appointment/advance-book-service-status.spec.ts src/modules/application/use-cases/appointment/list-booked-services-history.ts src/modules/application/use-cases/appointment/list-booked-services-history.spec.ts
```

- [ ] **Step 2: Write appointment use case tests**

Add tests for:

- creates appointment with no `endsAt`;
- creates appointment with `vehicleId` and vehicle snapshot;
- rejects deleted customer;
- rejects deleted vehicle;
- rejects vehicle from another customer;
- permits two appointments at the same `startsAt`;
- changes status to `DONE`, `CANCELLED`, and `SCHEDULED`;
- lists appointments by status, customer, service, vehicle, and start date interval.

- [ ] **Step 3: Implement CreateAppointmentUseCase**

Request:

```ts
type CreateAppointmentUseCaseRequest = {
  establishmentOwnerId: string;
  customerId: string;
  serviceId: string;
  vehicleId?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  description?: string | null;
  discountInCents?: number | null;
};
```

Required validations:

- establishment exists by owner id;
- customer exists in establishment and is not deleted;
- service exists in establishment and is active;
- optional vehicle exists for same customer and establishment and is not deleted;
- create `Appointment` with service snapshot and optional vehicle snapshot;
- save with `appointmentsRepository.create(appointment)`;
- return `right({ appointment })`.

- [ ] **Step 4: Implement UpdateAppointmentStatusUseCase**

Request:

```ts
type UpdateAppointmentStatusUseCaseRequest = {
  establishmentOwnerId: string;
  appointmentId: string;
  status: AppointmentStatus;
};
```

Find the appointment by `findByIdAndEstablishmentId()`, call `appointment.changeStatus(status)`, save, and return the updated appointment.

- [ ] **Step 5: Implement ListAppointmentsUseCase**

Request:

```ts
type ListAppointmentsUseCaseRequest = {
  establishmentOwnerId: string;
  filters?: AppointmentFilters;
};
```

Resolve establishment by owner id and call `appointmentsRepository.findManyByEstablishmentId(establishment.id.toString(), filters)`.

- [ ] **Step 6: Run appointment use case tests**

Run:

```bash
npm run test -- src/modules/application/use-cases/appointment/create-appointment.spec.ts src/modules/application/use-cases/appointment/update-appointment-status.spec.ts src/modules/application/use-cases/appointment/list-appointments.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit appointment use cases**

```bash
git add src/modules/application/use-cases/appointment
git commit -m "feat: add establishment appointment use cases"
```

## Task 7: HTTP Controllers And DTOs

**Files:**

- Modify: `src/infra/http/docs/domain-swagger.dto.ts`
- Modify: `src/infra/http/http.module.ts`
- Create new controllers and e2e specs listed in File Structure.

- [ ] **Step 1: Delete old HTTP controllers and tests**

Run:

```bash
git rm src/infra/http/controllers/register-customer.controller.ts src/infra/http/controllers/register-customer.controller.e2e-spec.ts src/infra/http/controllers/book-service.controller.ts src/infra/http/controllers/book-service.controller.e2e-spec.ts tests/helpers/booking.e2e-helpers.ts
```

- [ ] **Step 2: Add DTO classes**

In `src/infra/http/docs/domain-swagger.dto.ts`, remove `RegisterCustomerBodyDto`, `RegisterCustomerResponseDto`, `BookServiceBodyDto`, and `BookServiceResponseDto`.

Add DTOs for:

- `CreateCustomerBodyDto`
- `UpdateCustomerBodyDto`
- `CustomerDto`
- `CreateCustomerVehicleBodyDto`
- `UpdateCustomerVehicleBodyDto`
- `CustomerVehicleDto`
- `CreateAppointmentBodyDto`
- `UpdateAppointmentStatusBodyDto`
- `AppointmentDto`
- response wrappers for single/list responses.

- [ ] **Step 3: Implement customer controllers**

Use routes:

- `POST /customers`
- `GET /customers`
- `PATCH /customers/:customerId`
- `DELETE /customers/:customerId`

Zod body for create:

```ts
z.object({
  cpfCnpj: z.string().trim().optional().nullable(),
  fullName: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.email().trim(),
  address: z
    .object({
      street: z.string().trim().min(1),
      country: z.string().trim().min(1),
      state: z.string().trim().min(1),
      zipCode: z.string().trim().min(1),
      city: z.string().trim().min(1),
    })
    .optional()
    .nullable(),
  birthDate: z.coerce.date().optional().nullable(),
  nickname: z.string().trim().optional().nullable(),
});
```

For update, make every field optional and require at least one key with `.refine((value) => Object.keys(value).length > 0, "At least one field must be provided.")`.

- [ ] **Step 4: Implement vehicle controllers**

Use routes:

- `POST /customers/:customerId/vehicles`
- `GET /customers/:customerId/vehicles`
- `PATCH /customers/:customerId/vehicles/:vehicleId`
- `DELETE /customers/:customerId/vehicles/:vehicleId`

Zod body for create:

```ts
z.object({
  plate: z.string().trim().optional().nullable(),
  brand: z.string().trim().optional().nullable(),
  model: z.string().trim().optional().nullable(),
  color: z.string().trim().optional().nullable(),
  year: z.number().int().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});
```

- [ ] **Step 5: Implement appointment controllers**

Use routes:

- `POST /appointments`
- `GET /appointments`
- `PATCH /appointments/:appointmentId/status`

Zod body for create:

```ts
z.object({
  customerId: z.uuid(),
  serviceId: z.uuid(),
  vehicleId: z.uuid().optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  discountInCents: z.number().int().nonnegative().optional().nullable(),
});
```

Zod body for status:

```ts
z.object({
  status: z.enum(["SCHEDULED", "DONE", "CANCELLED"]),
});
```

- [ ] **Step 6: Register controllers and providers**

In `src/infra/http/http.module.ts`, remove `RegisterCustomerController`, `BookServiceController`, `RegisterCustomerUseCase`, `BookServiceUseCase`, and `AppointmentBookingService`.

Register all new customer, vehicle, and appointment controllers/use cases.

- [ ] **Step 7: Write e2e tests**

Create e2e specs for:

- `POST /customers`, `GET /customers`, `PATCH /customers/:customerId`, `DELETE /customers/:customerId`;
- `POST /customers/:customerId/vehicles`, `GET /customers/:customerId/vehicles`, `PATCH /customers/:customerId/vehicles/:vehicleId`, `DELETE /customers/:customerId/vehicles/:vehicleId`;
- `POST /appointments` without `endsAt`;
- `POST /appointments` with `vehicleId`;
- two `POST /appointments` requests at same `startsAt` both return `201`;
- `GET /appointments` filters;
- `PATCH /appointments/:appointmentId/status`.

- [ ] **Step 8: Run e2e tests**

Run:

```bash
npm run test:e2e -- src/infra/http/controllers/create-customer.controller.e2e-spec.ts src/infra/http/controllers/create-customer-vehicle.controller.e2e-spec.ts src/infra/http/controllers/create-appointment.controller.e2e-spec.ts
```

Expected: PASS after database setup migrates the new schema.

- [ ] **Step 9: Commit HTTP layer**

```bash
git add src/infra/http tests/helpers
git commit -m "feat: expose establishment scheduling endpoints"
```

## Task 8: Remove Legacy Active Flow

**Files:**

- Delete all legacy files listed in File Structure.
- Modify: `src/infra/database/database.module.ts`
- Modify: `src/infra/http/http.module.ts`
- Review: `src/modules/application/use-cases/user/get-me.spec.ts` for assertions that expect a customer profile relation.
- Review: `tests/common-test-hooks.ts` for cleanup order references to removed tables.

- [ ] **Step 1: Delete legacy favorites and payment application/persistence files**

Run the `git rm` commands for every file under "Delete from active source" that was not already deleted by previous tasks.

- [ ] **Step 2: Remove imports to deleted files**

Run:

```bash
rg -n "FavoritesRepository|PaymentsRepository|CheckoutRecoveriesRepository|RegisterCustomerUseCase|BookServiceUseCase|AppointmentBookingService|StartAppointmentCheckout|PaymentGateway|FavoriteEstablishment|registerDomainEventSubscribers|PrismaPayment|PrismaCheckoutRecovery|PrismaFavorite"
```

Expected: matches only in deleted/staged files or payment domain files that compile independently. Remove every active `src` import that points to deleted files.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS. If it fails because generated Prisma types no longer include removed models, delete the importing source or test file instead of reintroducing the removed Prisma models.

- [ ] **Step 4: Commit legacy cleanup**

```bash
git add -A src tests
git commit -m "refactor: remove legacy booking flow"
```

## Task 9: Establishment Metrics Update

**Files:**

- Modify: `src/modules/application/use-cases/establishment/establishment-metrics-helpers.ts`
- Modify: `src/modules/application/use-cases/establishment/get-establishment-average-ticket.ts`
- Modify: `src/modules/application/use-cases/establishment/get-establishment-total-revenue.ts`
- Modify: `src/modules/application/use-cases/establishment/get-establishment-revenue-vs-appointments.ts`
- Modify: `src/modules/application/use-cases/establishment/get-establishment-popular-services-by-category.ts`
- Modify: `src/modules/application/use-cases/establishment/establishment-metrics-kpis.spec.ts`
- Modify: `src/modules/application/use-cases/establishment/establishment-metrics-charts.spec.ts`

- [ ] **Step 1: Update metrics helper date filtering**

Replace `appointment.slot.startsAt` with `appointment.startsAt` in `filterAppointmentsByMetrics()`.

- [ ] **Step 2: Update revenue calculation**

Use this helper expression where revenue is summed:

```ts
const appointmentRevenueInCents = Math.max(
  appointment.service.priceInCents - (appointment.discountInCents ?? 0),
  0,
);
```

Use only appointments with `status === "DONE"` for revenue and average ticket. Cancellation rate still uses all filtered appointments.

- [ ] **Step 3: Update specs**

Replace `FINISHED` with `DONE`, remove payment setup from metrics specs, and update expected revenue to subtract `discountInCents`.

- [ ] **Step 4: Run metrics tests**

Run:

```bash
npm run test -- src/modules/application/use-cases/establishment/establishment-metrics-kpis.spec.ts src/modules/application/use-cases/establishment/establishment-metrics-charts.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit metrics update**

```bash
git add src/modules/application/use-cases/establishment
git commit -m "refactor: update establishment metrics for operational appointments"
```

## Task 10: Full Verification

**Files:**

- Review: `README.md`
- Review: `docs/superpowers/specs/2026-04-27-establishment-operated-scheduling-design.md`
- Review: `package.json`

- [ ] **Step 1: Format changed files**

Run:

```bash
npm run format
```

Expected: PASS.

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: PASS and no references to removed Prisma models.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Run unit tests**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 6: Run e2e tests**

Run:

```bash
npm run test:e2e
```

Expected: PASS.

- [ ] **Step 7: Run final aggregate check**

Run:

```bash
npm run check:all
```

Expected: PASS.

- [ ] **Step 8: Commit verification fixes**

If formatting or verification changed files, run:

```bash
git add -A
git commit -m "chore: stabilize establishment scheduling refactor"
```

If there are no changes, skip the commit.

## Self-Review

- Spec coverage: customer CRUD, vehicle CRUD, appointment creation/list/status, no slot blocking, no active payment/checkout flow, favorite removal, register-customer removal, metrics update, and tests are covered by Tasks 1-10.
- Document scan: no task contains prohibited filler terms or missing file paths.
- Type consistency: repository method names are consistent across domain, Prisma, in-memory repositories, use cases, and controllers.
