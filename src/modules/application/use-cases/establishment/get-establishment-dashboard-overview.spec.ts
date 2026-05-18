import { describe, expect, it, vi } from "vitest";

import { Money } from "../../../catalog/domain/value-objects/money";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeAppointment } from "../../../../../tests/factories/appointment-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { InMemoryAppointmentsRepository } from "../../../../../tests/repositories/in-memory-appointments-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { EstablishmentMetricsFilters } from "./establishment-metrics-helpers";
import { GetEstablishmentDashboardOverviewUseCase } from "./get-establishment-dashboard-overview";

function makeRepositories() {
  const servicesRepository = new InMemoryServicesRepository();
  const establishmentsRepository = new InMemoryEstablishmentsRepository(
    servicesRepository,
  );
  const appointmentsRepository = new InMemoryAppointmentsRepository();

  return {
    appointmentsRepository,
    establishmentsRepository,
  };
}

function makeSut({
  appointmentsRepository,
  establishmentsRepository,
}: ReturnType<typeof makeRepositories>) {
  return new GetEstablishmentDashboardOverviewUseCase(
    establishmentsRepository,
    appointmentsRepository,
  );
}

function makeRange(
  currentStartsAt: string,
  currentEndsAt: string,
  comparisonStartsAt: string,
  comparisonEndsAt: string,
) {
  return {
    current: {
      startsAt: new Date(currentStartsAt),
      endsAt: new Date(currentEndsAt),
    },
    comparison: {
      startsAt: new Date(comparisonStartsAt),
      endsAt: new Date(comparisonEndsAt),
    },
  };
}

describe("Get establishment dashboard overview", () => {
  it("should calculate overview metrics with daily points, empty buckets, and comparison trends", async () => {
    const repositories = makeRepositories();
    const { appointmentsRepository, establishmentsRepository } = repositories;
    const ownerId = new UniqueEntityId("owner-1");
    const establishment = makeEstablishment(
      { ownerId },
      new UniqueEntityId("est-1"),
    );

    await establishmentsRepository.create(establishment);

    const washService = makeService(
      {
        establishmentId: establishment.id,
        category: "WASH",
      },
      new UniqueEntityId("service-1"),
    );

    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "DONE",
        service: {
          serviceId: washService.id,
          serviceName: washService.serviceName.value,
          category: washService.category,
          durationInMinutes: 60,
          priceInCents: 10000,
        },
        startsAt: new Date("2026-04-01T10:00:00Z"),
        endsAt: new Date("2026-04-01T11:00:00Z"),
      }),
    );
    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "CANCELLED",
        service: {
          serviceId: washService.id,
          serviceName: washService.serviceName.value,
          category: washService.category,
          durationInMinutes: 60,
          priceInCents: 15000,
        },
        discountInCents: Money.create(5000),
        startsAt: new Date("2026-04-03T10:00:00Z"),
        endsAt: new Date("2026-04-03T11:00:00Z"),
      }),
    );
    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "DONE",
        service: {
          serviceId: washService.id,
          serviceName: washService.serviceName.value,
          category: washService.category,
          durationInMinutes: 60,
          priceInCents: 10000,
        },
        startsAt: new Date("2026-03-29T10:00:00Z"),
        endsAt: new Date("2026-03-29T11:00:00Z"),
      }),
    );
    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "DONE",
        service: {
          serviceId: washService.id,
          serviceName: washService.serviceName.value,
          category: washService.category,
          durationInMinutes: 60,
          priceInCents: 10000,
        },
        discountInCents: Money.create(5000),
        startsAt: new Date("2026-03-31T10:00:00Z"),
        endsAt: new Date("2026-03-31T11:00:00Z"),
      }),
    );

    const sut = makeSut(repositories);
    const result = await sut.execute({
      establishmentOwnerId: ownerId.toString(),
      range: makeRange(
        "2026-04-01T00:00:00.000Z",
        "2026-04-03T23:59:59.999Z",
        "2026-03-29T00:00:00.000Z",
        "2026-03-31T23:59:59.999Z",
      ),
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw new Error(
        "Expected overview metrics to be calculated successfully",
      );
    }

    expect(result.value).toEqual({
      appointments: {
        value: 2,
        variationPercentage: 0,
        points: [
          {
            date: "2026-04-01",
            label: "01/04",
            value: 1,
          },
          {
            date: "2026-04-02",
            label: "02/04",
            value: 0,
          },
          {
            date: "2026-04-03",
            label: "03/04",
            value: 1,
          },
        ],
      },
      averageTicket: {
        valueInCents: 10000,
        variationPercentage: 33,
        points: [
          {
            date: "2026-04-01",
            label: "01/04",
            valueInCents: 10000,
          },
          {
            date: "2026-04-02",
            label: "02/04",
            valueInCents: 0,
          },
          {
            date: "2026-04-03",
            label: "03/04",
            valueInCents: 10000,
          },
        ],
      },
      cancellationRate: {
        value: 50,
        variationInPercentagePoints: 50,
        points: [
          {
            date: "2026-04-01",
            label: "01/04",
            value: 0,
          },
          {
            date: "2026-04-02",
            label: "02/04",
            value: 0,
          },
          {
            date: "2026-04-03",
            label: "03/04",
            value: 100,
          },
        ],
      },
      totalRevenue: {
        valueInCents: 20000,
        variationPercentage: 33,
        points: [
          {
            date: "2026-04-01",
            label: "01/04",
            valueInCents: 10000,
          },
          {
            date: "2026-04-02",
            label: "02/04",
            valueInCents: 0,
          },
          {
            date: "2026-04-03",
            label: "03/04",
            valueInCents: 10000,
          },
        ],
      },
    });
  });

  it("should return weekly overview points limited to seven buckets", async () => {
    const repositories = makeRepositories();
    const { appointmentsRepository, establishmentsRepository } = repositories;
    const ownerId = new UniqueEntityId("owner-1");
    const establishment = makeEstablishment(
      { ownerId },
      new UniqueEntityId("est-1"),
    );

    await establishmentsRepository.create(establishment);

    const washService = makeService(
      {
        establishmentId: establishment.id,
        category: "WASH",
      },
      new UniqueEntityId("service-1"),
    );

    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "DONE",
        service: {
          serviceId: washService.id,
          serviceName: washService.serviceName.value,
          category: washService.category,
          durationInMinutes: 60,
          priceInCents: 10000,
        },
        startsAt: new Date("2026-01-03T10:00:00Z"),
        endsAt: new Date("2026-01-03T11:00:00Z"),
      }),
    );
    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "DONE",
        service: {
          serviceId: washService.id,
          serviceName: washService.serviceName.value,
          category: washService.category,
          durationInMinutes: 60,
          priceInCents: 25000,
        },
        startsAt: new Date("2026-02-17T10:00:00Z"),
        endsAt: new Date("2026-02-17T11:00:00Z"),
      }),
    );

    const sut = makeSut(repositories);
    const result = await sut.execute({
      establishmentOwnerId: ownerId.toString(),
      range: makeRange(
        "2026-01-01T00:00:00.000Z",
        "2026-02-18T23:59:59.999Z",
        "2025-11-13T00:00:00.000Z",
        "2025-12-31T23:59:59.999Z",
      ),
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw new Error(
        "Expected overview metrics to be calculated successfully",
      );
    }

    expect(result.value.appointments.points).toHaveLength(7);
    expect(result.value.appointments.points[0]).toEqual({
      date: "2025-12-29",
      label: "29/12",
      value: 1,
    });
    expect(result.value.appointments.points[6]).toEqual({
      date: "2026-02-16",
      label: "16/02",
      value: 1,
    });
    expect(result.value.totalRevenue.points[1]).toEqual({
      date: "2026-01-12",
      label: "12/01",
      valueInCents: 0,
    });
  });

  it("should return monthly overview points and null variations when the comparison base is zero", async () => {
    const repositories = makeRepositories();
    const { appointmentsRepository, establishmentsRepository } = repositories;
    const ownerId = new UniqueEntityId("owner-1");
    const establishment = makeEstablishment(
      { ownerId },
      new UniqueEntityId("est-1"),
    );

    await establishmentsRepository.create(establishment);

    const washService = makeService(
      {
        establishmentId: establishment.id,
        category: "WASH",
      },
      new UniqueEntityId("service-1"),
    );

    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "DONE",
        service: {
          serviceId: washService.id,
          serviceName: washService.serviceName.value,
          category: washService.category,
          durationInMinutes: 60,
          priceInCents: 10000,
        },
        startsAt: new Date("2026-01-15T10:00:00Z"),
        endsAt: new Date("2026-01-15T11:00:00Z"),
      }),
    );
    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "CANCELLED",
        service: {
          serviceId: washService.id,
          serviceName: washService.serviceName.value,
          category: washService.category,
          durationInMinutes: 60,
          priceInCents: 20000,
        },
        startsAt: new Date("2026-03-10T10:00:00Z"),
        endsAt: new Date("2026-03-10T11:00:00Z"),
      }),
    );

    const filters: EstablishmentMetricsFilters = {
      categories: ["WASH"],
      status: ["DONE", "CANCELLED"],
    };

    const sut = makeSut(repositories);
    const result = await sut.execute({
      establishmentOwnerId: ownerId.toString(),
      range: makeRange(
        "2026-01-01T00:00:00.000Z",
        "2026-03-31T23:59:59.999Z",
        "2025-10-01T00:00:00.000Z",
        "2025-12-31T23:59:59.999Z",
      ),
      filters,
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw new Error(
        "Expected overview metrics to be calculated successfully",
      );
    }

    expect(result.value.averageTicket.variationPercentage).toBeNull();
    expect(result.value.totalRevenue.variationPercentage).toBeNull();
    expect(result.value.appointments.variationPercentage).toBeNull();
    expect(
      result.value.cancellationRate.variationInPercentagePoints,
    ).toBeNull();
    expect(result.value.averageTicket.points).toEqual([
      {
        date: "2026-01",
        label: "Jan",
        valueInCents: 10000,
      },
      {
        date: "2026-02",
        label: "Fev",
        valueInCents: 0,
      },
      {
        date: "2026-03",
        label: "Mar",
        valueInCents: 20000,
      },
    ]);
  });

  it("should return ResourceNotFoundError when owner has no establishment", async () => {
    const repositories = makeRepositories();
    const { appointmentsRepository } = repositories;
    const findManyByEstablishmentIdSpy = vi.spyOn(
      appointmentsRepository,
      "findManyByEstablishmentId",
    );
    const sut = makeSut(repositories);

    const result = await sut.execute({
      establishmentOwnerId: "missing-owner",
      range: makeRange(
        "2026-04-01T00:00:00.000Z",
        "2026-04-03T23:59:59.999Z",
        "2026-03-29T00:00:00.000Z",
        "2026-03-31T23:59:59.999Z",
      ),
    });

    expect(result.isLeft()).toBe(true);

    if (result.isRight()) {
      throw new Error(
        "Expected overview metrics to fail with ResourceNotFoundError",
      );
    }

    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
    expect(findManyByEstablishmentIdSpy).not.toHaveBeenCalled();
  });
});
