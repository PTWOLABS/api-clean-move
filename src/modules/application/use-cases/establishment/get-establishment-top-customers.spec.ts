import { describe, expect, it } from "vitest";

import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Money } from "../../../catalog/domain/value-objects/money";
import { makeAppointment } from "../../../../../tests/factories/appointment-factory";
import { makeServiceCategoryRef } from "../../../../../tests/helpers/service-category-ref";

const washCategory = makeServiceCategoryRef("Lavagem");
const detailingCategory = makeServiceCategoryRef("Detailing Automotivo");
const protectionCategory = makeServiceCategoryRef("Proteção");
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { InMemoryAppointmentsRepository } from "../../../../../tests/repositories/in-memory-appointments-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { ResolvedDashboardMetricsRange } from "../../services/dashboard-metrics-range-resolver";
import { GetEstablishmentTopCustomersUseCase } from "./get-establishment-top-customers";

function makeRange(): ResolvedDashboardMetricsRange {
  return {
    current: {
      startsAt: new Date("2026-04-01T00:00:00.000Z"),
      endsAt: new Date("2026-04-30T23:59:59.999Z"),
    },
    comparison: {
      startsAt: new Date("2026-03-01T00:00:00.000Z"),
      endsAt: new Date("2026-03-31T23:59:59.999Z"),
    },
  };
}

function makeSut() {
  const servicesRepository = new InMemoryServicesRepository();
  const establishmentsRepository = new InMemoryEstablishmentsRepository(
    servicesRepository,
  );
  const appointmentsRepository = new InMemoryAppointmentsRepository();
  const sut = new GetEstablishmentTopCustomersUseCase(
    establishmentsRepository,
    appointmentsRepository,
  );

  return {
    appointmentsRepository,
    establishmentsRepository,
    sut,
  };
}

describe("Get establishment top customers", () => {
  it("should rank customers by done visits and total spent with absolute positions", async () => {
    const { appointmentsRepository, establishmentsRepository, sut } = makeSut();
    const ownerId = new UniqueEntityId("owner-1");
    const establishment = makeEstablishment(
      { ownerId },
      new UniqueEntityId("est-1"),
    );
    const customerA = new UniqueEntityId("customer-a");
    const customerB = new UniqueEntityId("customer-b");
    const customerC = new UniqueEntityId("customer-c");

    await establishmentsRepository.create(establishment);
    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        customerId: customerA,
        customer: { fullName: "Ana" },
        status: "DONE",
        startsAt: new Date("2026-04-10T10:00:00.000Z"),
        endsAt: new Date("2026-04-10T11:00:00.000Z"),
        discountInCents: Money.create(1000),
        services: [
          {
            serviceId: new UniqueEntityId("service-a"),
            serviceName: "Lavagem",
            category: washCategory,
            durationInMinutes: 60,
            priceInCents: 10000,
          },
        ],
      }),
    );
    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        customerId: customerA,
        customer: { fullName: "Ana" },
        status: "DONE",
        startsAt: new Date("2026-04-11T10:00:00.000Z"),
        endsAt: new Date("2026-04-11T11:00:00.000Z"),
        services: [
          {
            serviceId: new UniqueEntityId("service-b"),
            serviceName: "Polimento",
            category: detailingCategory,
            durationInMinutes: 60,
            priceInCents: 5000,
          },
        ],
      }),
    );
    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        customerId: customerB,
        customer: { fullName: "Bruno" },
        status: "DONE",
        startsAt: new Date("2026-04-12T10:00:00.000Z"),
        endsAt: new Date("2026-04-12T11:00:00.000Z"),
        services: [
          {
            serviceId: new UniqueEntityId("service-c"),
            serviceName: "Cristalizacao",
            category: protectionCategory,
            durationInMinutes: 60,
            priceInCents: 20000,
          },
        ],
      }),
    );
    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        customerId: customerC,
        customer: { fullName: "Carla" },
        status: "SCHEDULED",
        startsAt: new Date("2026-04-12T10:00:00.000Z"),
        endsAt: new Date("2026-04-12T11:00:00.000Z"),
      }),
    );

    const result = await sut.execute({
      establishmentOwnerId: ownerId.toString(),
      range: makeRange(),
      pagination: {
        page: 1,
        size: 5,
      },
    });

    expect(result.isRight()).toBe(true);
    expect(result.value).toEqual({
      customers: [
        {
          position: 1,
          customerId: "customer-a",
          customerName: "Ana",
          completedAppointmentsCount: 2,
          totalSpentInCents: 14000,
        },
        {
          position: 2,
          customerId: "customer-b",
          customerName: "Bruno",
          completedAppointmentsCount: 1,
          totalSpentInCents: 20000,
        },
      ],
      totalCustomers: 2,
    });
  });

  it("should use absolute positions when paginating", async () => {
    const { appointmentsRepository, establishmentsRepository, sut } = makeSut();
    const ownerId = new UniqueEntityId("owner-1");
    const establishment = makeEstablishment(
      { ownerId },
      new UniqueEntityId("est-1"),
    );

    await establishmentsRepository.create(establishment);

    for (const customer of [
      ["customer-a", "Ana", 30000],
      ["customer-b", "Bruno", 20000],
      ["customer-c", "Carla", 10000],
    ] as const) {
      await appointmentsRepository.create(
        makeAppointment({
          establishmentId: establishment.id,
          customerId: new UniqueEntityId(customer[0]),
          customer: { fullName: customer[1] },
          status: "DONE",
          startsAt: new Date("2026-04-10T10:00:00.000Z"),
          endsAt: new Date("2026-04-10T11:00:00.000Z"),
          services: [
            {
              serviceId: new UniqueEntityId(`service-${customer[0]}`),
              serviceName: "Lavagem",
              category: washCategory,
              durationInMinutes: 60,
              priceInCents: customer[2],
            },
          ],
        }),
      );
    }

    const result = await sut.execute({
      establishmentOwnerId: ownerId.toString(),
      range: makeRange(),
      pagination: {
        page: 2,
        size: 2,
      },
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.customers).toEqual([
      {
        position: 3,
        customerId: "customer-c",
        customerName: "Carla",
        completedAppointmentsCount: 1,
        totalSpentInCents: 10000,
      },
    ]);
    expect(result.value.totalCustomers).toBe(3);
  });

  it("should return not found when owner has no establishment", async () => {
    const { sut } = makeSut();

    const result = await sut.execute({
      establishmentOwnerId: "missing-owner",
      range: makeRange(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
