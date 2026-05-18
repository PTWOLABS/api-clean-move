import { Money } from "../../../catalog/domain/value-objects/money";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeAppointment } from "../../../../../tests/factories/appointment-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { InMemoryAppointmentsRepository } from "../../../../../tests/repositories/in-memory-appointments-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { ResolvedDashboardMetricsRange } from "../../services/dashboard-metrics-range-resolver";
import { GetEstablishmentPopularServicesUseCase } from "./get-establishment-popular-services";
import { GetEstablishmentRevenueVsAppointmentsUseCase } from "./get-establishment-revenue-vs-appointments";

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

function makeChartUseCases({
  appointmentsRepository,
  establishmentsRepository,
}: ReturnType<typeof makeRepositories>) {
  const popularServicesUseCase = new GetEstablishmentPopularServicesUseCase(
    establishmentsRepository,
    appointmentsRepository,
  );

  const revenueVsAppointmentsUseCase =
    new GetEstablishmentRevenueVsAppointmentsUseCase(
      establishmentsRepository,
      appointmentsRepository,
    );

  return {
    popularServicesUseCase,
    revenueVsAppointmentsUseCase,
  };
}

function makeRange(
  startsAt = "2026-04-01T00:00:00.000Z",
  endsAt = "2026-04-03T23:59:59.999Z",
  comparisonStartsAt = "2026-03-29T00:00:00.000Z",
  comparisonEndsAt = "2026-03-31T23:59:59.999Z",
): ResolvedDashboardMetricsRange {
  return {
    current: {
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
    },
    comparison: {
      startsAt: new Date(comparisonStartsAt),
      endsAt: new Date(comparisonEndsAt),
    },
  };
}

describe("Establishment metrics charts", () => {
  it("should return repository-paginated popular service usage metrics and revenue vs appointments using snapshots and filters", async () => {
    const repositories = makeRepositories();
    const { appointmentsRepository, establishmentsRepository } = repositories;

    const ownerId = new UniqueEntityId("owner-1");
    const establishment = makeEstablishment(
      { ownerId },
      new UniqueEntityId("est-1"),
    );
    const otherEstablishment = makeEstablishment(
      { ownerId: new UniqueEntityId("owner-2") },
      new UniqueEntityId("est-2"),
    );

    await establishmentsRepository.create(establishment);
    await establishmentsRepository.create(otherEstablishment);

    const washService = makeService(
      {
        establishmentId: establishment.id,
        category: "WASH",
      },
      new UniqueEntityId("service-1"),
    );
    const detailsService = makeService(
      {
        establishmentId: establishment.id,
        category: "AUTOMATIVE_DETAILING",
      },
      new UniqueEntityId("service-2"),
    );
    const cancelledService = makeService(
      {
        establishmentId: establishment.id,
        category: "WASH",
      },
      new UniqueEntityId("service-3"),
    );
    const otherWashService = makeService(
      {
        establishmentId: otherEstablishment.id,
        category: "WASH",
      },
      new UniqueEntityId("service-4"),
    );

    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "SCHEDULED",
        service: {
          serviceId: washService.id,
          serviceName: washService.serviceName.value,
          category: washService.category,
          durationInMinutes: 60,
          priceInCents: 10000,
        },
        discountInCents: Money.create(1000),
        startsAt: new Date("2026-04-01T10:00:00Z"),
        endsAt: new Date("2026-04-01T11:00:00Z"),
      }),
    );

    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "SCHEDULED",
        service: {
          serviceId: washService.id,
          serviceName: washService.serviceName.value,
          category: washService.category,
          durationInMinutes: 60,
          priceInCents: 12000,
        },
        startsAt: new Date("2026-04-01T14:00:00Z"),
        endsAt: new Date("2026-04-01T15:00:00Z"),
      }),
    );

    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "SCHEDULED",
        service: {
          serviceId: detailsService.id,
          serviceName: detailsService.serviceName.value,
          category: detailsService.category,
          durationInMinutes: 60,
          priceInCents: 30000,
        },
        discountInCents: Money.create(5000),
        startsAt: new Date("2026-04-02T14:00:00Z"),
        endsAt: new Date("2026-04-02T15:00:00Z"),
      }),
    );

    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "CANCELLED",
        service: {
          serviceId: cancelledService.id,
          serviceName: cancelledService.serviceName.value,
          category: cancelledService.category,
          durationInMinutes: 60,
          priceInCents: 99999,
        },
        startsAt: new Date("2026-04-03T10:00:00Z"),
        endsAt: new Date("2026-04-03T11:00:00Z"),
      }),
    );

    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: otherEstablishment.id,
        status: "SCHEDULED",
        service: {
          serviceId: otherWashService.id,
          serviceName: otherWashService.serviceName.value,
          category: otherWashService.category,
          durationInMinutes: 60,
          priceInCents: 999999,
        },
        startsAt: new Date("2026-04-01T16:00:00Z"),
        endsAt: new Date("2026-04-01T17:00:00Z"),
      }),
    );

    const { popularServicesUseCase, revenueVsAppointmentsUseCase } =
      makeChartUseCases(repositories);
    const findPopularServiceUsagesByEstablishmentIdSpy = vi.spyOn(
      appointmentsRepository,
      "findPopularServiceUsagesByEstablishmentId",
    );

    const popularServicesResult = await popularServicesUseCase.execute({
      establishmentOwnerId: ownerId.toString(),
      range: makeRange(
        "2026-04-01T00:00:00.000Z",
        "2026-04-02T23:59:59.999Z",
        "2026-03-30T00:00:00.000Z",
        "2026-03-31T23:59:59.999Z",
      ),
      pagination: {
        page: 1,
        size: 2,
      },
      filters: {
        categories: ["WASH", "AUTOMATIVE_DETAILING"],
        status: ["SCHEDULED"],
      },
    });
    const secondPopularServicesPageResult =
      await popularServicesUseCase.execute({
        establishmentOwnerId: ownerId.toString(),
        range: makeRange(
          "2026-04-01T00:00:00.000Z",
          "2026-04-02T23:59:59.999Z",
          "2026-03-30T00:00:00.000Z",
          "2026-03-31T23:59:59.999Z",
        ),
        pagination: {
          page: 2,
          size: 2,
        },
        filters: {
          categories: ["WASH", "AUTOMATIVE_DETAILING"],
          status: ["SCHEDULED"],
        },
      });

    expect(
      findPopularServiceUsagesByEstablishmentIdSpy,
    ).toHaveBeenNthCalledWith(1, establishment.id.toString(), {
      startsAt: new Date("2026-04-01T00:00:00.000Z"),
      endsAt: new Date("2026-04-02T23:59:59.999Z"),
      categories: ["WASH", "AUTOMATIVE_DETAILING"],
      status: ["SCHEDULED"],
      page: 1,
      size: 2,
    });
    expect(
      findPopularServiceUsagesByEstablishmentIdSpy,
    ).toHaveBeenNthCalledWith(2, establishment.id.toString(), {
      startsAt: new Date("2026-04-01T00:00:00.000Z"),
      endsAt: new Date("2026-04-02T23:59:59.999Z"),
      categories: ["WASH", "AUTOMATIVE_DETAILING"],
      status: ["SCHEDULED"],
      page: 2,
      size: 2,
    });

    const revenueVsAppointmentsResult =
      await revenueVsAppointmentsUseCase.execute({
        establishmentOwnerId: ownerId.toString(),
        range: makeRange(
          "2026-04-01T00:00:00.000Z",
          "2026-04-02T23:59:59.999Z",
          "2026-03-30T00:00:00.000Z",
          "2026-03-31T23:59:59.999Z",
        ),
        granularity: "daily",
        filters: {
          status: ["SCHEDULED"],
        },
      });

    expect(popularServicesResult.isRight()).toBe(true);
    expect(secondPopularServicesPageResult.isRight()).toBe(true);
    expect(revenueVsAppointmentsResult.isRight()).toBe(true);

    if (
      popularServicesResult.isLeft() ||
      secondPopularServicesPageResult.isLeft() ||
      revenueVsAppointmentsResult.isLeft()
    ) {
      throw new Error("Expected chart metrics to be calculated successfully");
    }

    expect(popularServicesResult.value.popularServices).toEqual([
      {
        id: washService.id.toString(),
        name: washService.serviceName.value,
        completedCount: 2,
        percent: 67,
      },
      {
        id: detailsService.id.toString(),
        name: detailsService.serviceName.value,
        completedCount: 1,
        percent: 33,
      },
    ]);
    expect(popularServicesResult.value.totalServices).toBe(3);
    expect(secondPopularServicesPageResult.value.popularServices).toEqual([]);
    expect(secondPopularServicesPageResult.value.totalServices).toBe(3);

    expect(revenueVsAppointmentsResult.value.points).toEqual([
      {
        date: "2026-04-01",
        label: "01/04",
        appointments: 2,
        revenueInCents: 21000,
      },
      {
        date: "2026-04-02",
        label: "02/04",
        appointments: 1,
        revenueInCents: 25000,
      },
    ]);
    expect(revenueVsAppointmentsResult.value.summary).toEqual({
      revenueInCents: 46000,
      appointments: 3,
      revenueTrendPercent: null,
      appointmentsTrendPercent: null,
    });
  });

  it("should return empty popular services and empty revenue buckets when no appointments match", async () => {
    const repositories = makeRepositories();
    const { establishmentsRepository } = repositories;

    const ownerId = new UniqueEntityId("owner-1");
    const establishment = makeEstablishment(
      { ownerId },
      new UniqueEntityId("est-1"),
    );

    await establishmentsRepository.create(establishment);

    const { popularServicesUseCase, revenueVsAppointmentsUseCase } =
      makeChartUseCases(repositories);

    const popularServicesResult = await popularServicesUseCase.execute({
      establishmentOwnerId: ownerId.toString(),
      range: makeRange(
        "2026-04-01T00:00:00.000Z",
        "2026-04-01T23:59:59.999Z",
        "2026-03-31T00:00:00.000Z",
        "2026-03-31T23:59:59.999Z",
      ),
      pagination: {
        page: 1,
        size: 5,
      },
      filters: {
        categories: ["WASH"],
      },
    });

    const revenueVsAppointmentsResult =
      await revenueVsAppointmentsUseCase.execute({
        establishmentOwnerId: ownerId.toString(),
        range: makeRange(
          "2026-04-01T00:00:00.000Z",
          "2026-04-01T23:59:59.999Z",
          "2026-03-31T00:00:00.000Z",
          "2026-03-31T23:59:59.999Z",
        ),
        granularity: "daily",
        filters: {
          status: ["DONE"],
        },
      });

    expect(popularServicesResult.isRight()).toBe(true);
    expect(revenueVsAppointmentsResult.isRight()).toBe(true);

    if (
      popularServicesResult.isLeft() ||
      revenueVsAppointmentsResult.isLeft()
    ) {
      throw new Error("Expected chart metrics to be calculated successfully");
    }

    expect(popularServicesResult.value.popularServices).toEqual([]);
    expect(popularServicesResult.value.totalServices).toBe(0);
    expect(revenueVsAppointmentsResult.value.points).toEqual([
      {
        date: "2026-04-01",
        label: "01/04",
        appointments: 0,
        revenueInCents: 0,
      },
    ]);
    expect(revenueVsAppointmentsResult.value.summary).toEqual({
      revenueInCents: 0,
      appointments: 0,
      revenueTrendPercent: null,
      appointmentsTrendPercent: null,
    });
  });

  it("should calculate popular service totals and percentages within all matching usages", async () => {
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
    const protectionService = makeService(
      {
        establishmentId: establishment.id,
        category: "PROTECTION",
      },
      new UniqueEntityId("service-2"),
    );

    for (const startsAt of [
      "2026-04-01T10:00:00.000Z",
      "2026-04-02T10:00:00.000Z",
    ]) {
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
          startsAt: new Date(startsAt),
          endsAt: new Date(new Date(startsAt).getTime() + 60 * 60 * 1000),
        }),
      );
    }

    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "DONE",
        service: {
          serviceId: protectionService.id,
          serviceName: protectionService.serviceName.value,
          category: protectionService.category,
          durationInMinutes: 60,
          priceInCents: 20000,
        },
        startsAt: new Date("2026-04-03T10:00:00.000Z"),
        endsAt: new Date("2026-04-03T11:00:00.000Z"),
      }),
    );

    const { popularServicesUseCase } = makeChartUseCases(repositories);
    const result = await popularServicesUseCase.execute({
      establishmentOwnerId: ownerId.toString(),
      range: makeRange(
        "2026-04-01T00:00:00.000Z",
        "2026-04-03T23:59:59.999Z",
        "2026-03-29T00:00:00.000Z",
        "2026-03-31T23:59:59.999Z",
      ),
      pagination: {
        page: 1,
        size: 5,
      },
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw new Error("Expected popular services to be calculated");
    }

    expect(result.value).toEqual({
      popularServices: [
        {
          id: washService.id.toString(),
          name: washService.serviceName.value,
          completedCount: 2,
          percent: 67,
        },
        {
          id: protectionService.id.toString(),
          name: protectionService.serviceName.value,
          completedCount: 1,
          percent: 33,
        },
      ],
      totalServices: 3,
    });
  });

  it("should use scheduled and done by default and exclude cancelled appointments", async () => {
    const repositories = makeRepositories();
    const { appointmentsRepository, establishmentsRepository } = repositories;

    const ownerId = new UniqueEntityId("owner-1");
    const establishment = makeEstablishment(
      { ownerId },
      new UniqueEntityId("est-1"),
    );

    await establishmentsRepository.create(establishment);

    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "DONE",
        service: {
          serviceId: new UniqueEntityId("service-1"),
          serviceName: "Lavagem simples",
          category: "WASH",
          durationInMinutes: 60,
          priceInCents: 10000,
        },
        startsAt: new Date("2026-04-01T10:00:00.000Z"),
        endsAt: new Date("2026-04-01T11:00:00.000Z"),
      }),
    );
    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "SCHEDULED",
        service: {
          serviceId: new UniqueEntityId("service-2"),
          serviceName: "Lavagem simples",
          category: "WASH",
          durationInMinutes: 60,
          priceInCents: 20000,
        },
        startsAt: new Date("2026-04-01T12:00:00.000Z"),
        endsAt: new Date("2026-04-01T13:00:00.000Z"),
      }),
    );
    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "CANCELLED",
        service: {
          serviceId: new UniqueEntityId("service-3"),
          serviceName: "Lavagem simples",
          category: "WASH",
          durationInMinutes: 60,
          priceInCents: 30000,
        },
        startsAt: new Date("2026-04-01T14:00:00.000Z"),
        endsAt: new Date("2026-04-01T15:00:00.000Z"),
      }),
    );
    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "DONE",
        service: {
          serviceId: new UniqueEntityId("service-4"),
          serviceName: "Lavagem simples",
          category: "WASH",
          durationInMinutes: 60,
          priceInCents: 5000,
        },
        startsAt: new Date("2026-03-31T10:00:00.000Z"),
        endsAt: new Date("2026-03-31T11:00:00.000Z"),
      }),
    );

    const { popularServicesUseCase, revenueVsAppointmentsUseCase } =
      makeChartUseCases(repositories);
    const findPopularServiceUsagesByEstablishmentIdSpy = vi.spyOn(
      appointmentsRepository,
      "findPopularServiceUsagesByEstablishmentId",
    );
    const popularServicesResult = await popularServicesUseCase.execute({
      establishmentOwnerId: ownerId.toString(),
      range: makeRange(
        "2026-04-01T00:00:00.000Z",
        "2026-04-01T23:59:59.999Z",
        "2026-03-31T00:00:00.000Z",
        "2026-03-31T23:59:59.999Z",
      ),
    });

    expect(findPopularServiceUsagesByEstablishmentIdSpy).toHaveBeenCalledWith(
      establishment.id.toString(),
      {
        startsAt: new Date("2026-04-01T00:00:00.000Z"),
        endsAt: new Date("2026-04-01T23:59:59.999Z"),
        status: ["SCHEDULED", "DONE"],
        page: 1,
        size: 5,
      },
    );

    const result = await revenueVsAppointmentsUseCase.execute({
      establishmentOwnerId: ownerId.toString(),
      range: makeRange(
        "2026-04-01T00:00:00.000Z",
        "2026-04-01T23:59:59.999Z",
        "2026-03-31T00:00:00.000Z",
        "2026-03-31T23:59:59.999Z",
      ),
      granularity: "daily",
    });

    expect(popularServicesResult.isRight()).toBe(true);
    expect(result.isRight()).toBe(true);

    if (popularServicesResult.isLeft() || result.isLeft()) {
      throw new Error("Expected revenue metrics to be calculated successfully");
    }

    expect(popularServicesResult.value).toEqual({
      popularServices: [
        {
          id: "service-1",
          name: "Lavagem simples",
          completedCount: 1,
          percent: 50,
        },
        {
          id: "service-2",
          name: "Lavagem simples",
          completedCount: 1,
          percent: 50,
        },
      ],
      totalServices: 2,
    });
    expect(result.value.points).toEqual([
      {
        date: "2026-04-01",
        label: "01/04",
        appointments: 1,
        revenueInCents: 10000,
      },
    ]);
    expect(result.value.summary).toEqual({
      revenueInCents: 10000,
      appointments: 1,
      revenueTrendPercent: 100,
      appointmentsTrendPercent: 0,
    });
  });

  it("should respect explicit status filters", async () => {
    const repositories = makeRepositories();
    const { appointmentsRepository, establishmentsRepository } = repositories;

    const ownerId = new UniqueEntityId("owner-1");
    const establishment = makeEstablishment(
      { ownerId },
      new UniqueEntityId("est-1"),
    );

    await establishmentsRepository.create(establishment);

    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "SCHEDULED",
        service: {
          serviceId: new UniqueEntityId("service-1"),
          serviceName: "Lavagem simples",
          category: "WASH",
          durationInMinutes: 60,
          priceInCents: 12000,
        },
        startsAt: new Date("2026-04-01T10:00:00.000Z"),
        endsAt: new Date("2026-04-01T11:00:00.000Z"),
      }),
    );
    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "DONE",
        service: {
          serviceId: new UniqueEntityId("service-2"),
          serviceName: "Lavagem simples",
          category: "WASH",
          durationInMinutes: 60,
          priceInCents: 50000,
        },
        startsAt: new Date("2026-04-01T12:00:00.000Z"),
        endsAt: new Date("2026-04-01T13:00:00.000Z"),
      }),
    );
    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "SCHEDULED",
        service: {
          serviceId: new UniqueEntityId("service-3"),
          serviceName: "Lavagem simples",
          category: "WASH",
          durationInMinutes: 60,
          priceInCents: 6000,
        },
        startsAt: new Date("2026-03-31T10:00:00.000Z"),
        endsAt: new Date("2026-03-31T11:00:00.000Z"),
      }),
    );

    const { revenueVsAppointmentsUseCase } = makeChartUseCases(repositories);
    const result = await revenueVsAppointmentsUseCase.execute({
      establishmentOwnerId: ownerId.toString(),
      range: makeRange(
        "2026-04-01T00:00:00.000Z",
        "2026-04-01T23:59:59.999Z",
        "2026-03-31T00:00:00.000Z",
        "2026-03-31T23:59:59.999Z",
      ),
      granularity: "daily",
      filters: {
        status: ["SCHEDULED"],
      },
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw new Error("Expected revenue metrics to be calculated successfully");
    }

    expect(result.value.summary).toEqual({
      revenueInCents: 12000,
      appointments: 1,
      revenueTrendPercent: 100,
      appointmentsTrendPercent: 0,
    });
  });

  it("should include empty daily buckets and calculate integer trends", async () => {
    const repositories = makeRepositories();
    const { appointmentsRepository, establishmentsRepository } = repositories;

    const ownerId = new UniqueEntityId("owner-1");
    const establishment = makeEstablishment(
      { ownerId },
      new UniqueEntityId("est-1"),
    );

    await establishmentsRepository.create(establishment);

    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "DONE",
        service: {
          serviceId: new UniqueEntityId("service-1"),
          serviceName: "Lavagem simples",
          category: "WASH",
          durationInMinutes: 60,
          priceInCents: 10000,
        },
        startsAt: new Date("2026-04-01T10:00:00.000Z"),
        endsAt: new Date("2026-04-01T11:00:00.000Z"),
      }),
    );
    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "DONE",
        service: {
          serviceId: new UniqueEntityId("service-2"),
          serviceName: "Lavagem completa",
          category: "WASH",
          durationInMinutes: 60,
          priceInCents: 20000,
        },
        startsAt: new Date("2026-04-03T10:00:00.000Z"),
        endsAt: new Date("2026-04-03T11:00:00.000Z"),
      }),
    );
    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "DONE",
        service: {
          serviceId: new UniqueEntityId("service-3"),
          serviceName: "Lavagem simples",
          category: "WASH",
          durationInMinutes: 60,
          priceInCents: 20000,
        },
        startsAt: new Date("2026-03-31T10:00:00.000Z"),
        endsAt: new Date("2026-03-31T11:00:00.000Z"),
      }),
    );

    const { revenueVsAppointmentsUseCase } = makeChartUseCases(repositories);
    const result = await revenueVsAppointmentsUseCase.execute({
      establishmentOwnerId: ownerId.toString(),
      range: makeRange(
        "2026-04-01T00:00:00.000Z",
        "2026-04-03T23:59:59.999Z",
        "2026-03-29T00:00:00.000Z",
        "2026-03-31T23:59:59.999Z",
      ),
      granularity: "daily",
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw new Error("Expected revenue metrics to be calculated successfully");
    }

    expect(result.value.points).toEqual([
      {
        date: "2026-04-01",
        label: "01/04",
        appointments: 1,
        revenueInCents: 10000,
      },
      {
        date: "2026-04-02",
        label: "02/04",
        appointments: 0,
        revenueInCents: 0,
      },
      {
        date: "2026-04-03",
        label: "03/04",
        appointments: 1,
        revenueInCents: 20000,
      },
    ]);
    expect(result.value.summary).toEqual({
      revenueInCents: 30000,
      appointments: 2,
      revenueTrendPercent: 50,
      appointmentsTrendPercent: 100,
    });
  });

  it("should return weekly bucket output", async () => {
    const repositories = makeRepositories();
    const { appointmentsRepository, establishmentsRepository } = repositories;

    const ownerId = new UniqueEntityId("owner-1");
    const establishment = makeEstablishment(
      { ownerId },
      new UniqueEntityId("est-1"),
    );

    await establishmentsRepository.create(establishment);

    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "DONE",
        service: {
          serviceId: new UniqueEntityId("service-1"),
          serviceName: "Lavagem simples",
          category: "WASH",
          durationInMinutes: 60,
          priceInCents: 10000,
        },
        startsAt: new Date("2026-04-02T10:00:00.000Z"),
        endsAt: new Date("2026-04-02T11:00:00.000Z"),
      }),
    );
    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "DONE",
        service: {
          serviceId: new UniqueEntityId("service-2"),
          serviceName: "Lavagem completa",
          category: "WASH",
          durationInMinutes: 60,
          priceInCents: 20000,
        },
        startsAt: new Date("2026-04-08T10:00:00.000Z"),
        endsAt: new Date("2026-04-08T11:00:00.000Z"),
      }),
    );

    const { revenueVsAppointmentsUseCase } = makeChartUseCases(repositories);
    const result = await revenueVsAppointmentsUseCase.execute({
      establishmentOwnerId: ownerId.toString(),
      range: makeRange(
        "2026-04-01T00:00:00.000Z",
        "2026-04-14T23:59:59.999Z",
        "2026-03-18T00:00:00.000Z",
        "2026-03-31T23:59:59.999Z",
      ),
      granularity: "weekly",
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw new Error("Expected revenue metrics to be calculated successfully");
    }

    expect(result.value.points).toEqual([
      {
        date: "2026-03-30",
        label: "30/03",
        appointments: 1,
        revenueInCents: 10000,
      },
      {
        date: "2026-04-06",
        label: "06/04",
        appointments: 1,
        revenueInCents: 20000,
      },
      {
        date: "2026-04-13",
        label: "13/04",
        appointments: 0,
        revenueInCents: 0,
      },
    ]);
  });

  it("should return monthly bucket output", async () => {
    const repositories = makeRepositories();
    const { appointmentsRepository, establishmentsRepository } = repositories;

    const ownerId = new UniqueEntityId("owner-1");
    const establishment = makeEstablishment(
      { ownerId },
      new UniqueEntityId("est-1"),
    );

    await establishmentsRepository.create(establishment);

    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "DONE",
        service: {
          serviceId: new UniqueEntityId("service-1"),
          serviceName: "Lavagem simples",
          category: "WASH",
          durationInMinutes: 60,
          priceInCents: 10000,
        },
        startsAt: new Date("2026-01-15T10:00:00.000Z"),
        endsAt: new Date("2026-01-15T11:00:00.000Z"),
      }),
    );
    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "DONE",
        service: {
          serviceId: new UniqueEntityId("service-2"),
          serviceName: "Lavagem completa",
          category: "WASH",
          durationInMinutes: 60,
          priceInCents: 20000,
        },
        startsAt: new Date("2026-03-10T10:00:00.000Z"),
        endsAt: new Date("2026-03-10T11:00:00.000Z"),
      }),
    );

    const { revenueVsAppointmentsUseCase } = makeChartUseCases(repositories);
    const result = await revenueVsAppointmentsUseCase.execute({
      establishmentOwnerId: ownerId.toString(),
      range: makeRange(
        "2026-01-01T00:00:00.000Z",
        "2026-03-31T23:59:59.999Z",
        "2025-10-01T00:00:00.000Z",
        "2025-12-31T23:59:59.999Z",
      ),
      granularity: "monthly",
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw new Error("Expected revenue metrics to be calculated successfully");
    }

    expect(result.value.points).toEqual([
      {
        date: "2026-01",
        label: "Jan",
        appointments: 1,
        revenueInCents: 10000,
      },
      {
        date: "2026-02",
        label: "Fev",
        appointments: 0,
        revenueInCents: 0,
      },
      {
        date: "2026-03",
        label: "Mar",
        appointments: 1,
        revenueInCents: 20000,
      },
    ]);
    expect(result.value.summary).toEqual({
      revenueInCents: 30000,
      appointments: 2,
      revenueTrendPercent: null,
      appointmentsTrendPercent: null,
    });
  });

  it("should return null trends when previous comparison values are zero", async () => {
    const repositories = makeRepositories();
    const { appointmentsRepository, establishmentsRepository } = repositories;

    const ownerId = new UniqueEntityId("owner-1");
    const establishment = makeEstablishment(
      { ownerId },
      new UniqueEntityId("est-1"),
    );

    await establishmentsRepository.create(establishment);

    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "DONE",
        service: {
          serviceId: new UniqueEntityId("service-1"),
          serviceName: "Lavagem simples",
          category: "WASH",
          durationInMinutes: 60,
          priceInCents: 10000,
        },
        startsAt: new Date("2026-04-01T10:00:00.000Z"),
        endsAt: new Date("2026-04-01T11:00:00.000Z"),
      }),
    );

    const { revenueVsAppointmentsUseCase } = makeChartUseCases(repositories);
    const result = await revenueVsAppointmentsUseCase.execute({
      establishmentOwnerId: ownerId.toString(),
      range: makeRange(
        "2026-04-01T00:00:00.000Z",
        "2026-04-01T23:59:59.999Z",
        "2026-03-31T00:00:00.000Z",
        "2026-03-31T23:59:59.999Z",
      ),
      granularity: "daily",
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw new Error("Expected revenue metrics to be calculated successfully");
    }

    expect(result.value.summary).toEqual({
      revenueInCents: 10000,
      appointments: 1,
      revenueTrendPercent: null,
      appointmentsTrendPercent: null,
    });
  });

  it("should return ResourceNotFoundError when owner has no establishment", async () => {
    const { popularServicesUseCase, revenueVsAppointmentsUseCase } =
      makeChartUseCases(makeRepositories());

    const popularServicesResult = await popularServicesUseCase.execute({
      establishmentOwnerId: "missing-owner",
      range: makeRange(),
      pagination: {
        page: 1,
        size: 5,
      },
    });
    const revenueVsAppointmentsResult =
      await revenueVsAppointmentsUseCase.execute({
        establishmentOwnerId: "missing-owner",
        range: makeRange(),
        granularity: "daily",
      });

    expect(popularServicesResult.isLeft()).toBe(true);
    expect(revenueVsAppointmentsResult.isLeft()).toBe(true);

    if (
      popularServicesResult.isRight() ||
      revenueVsAppointmentsResult.isRight()
    ) {
      throw new Error(
        "Expected chart metrics to fail with ResourceNotFoundError",
      );
    }

    expect(popularServicesResult.value).toBeInstanceOf(ResourceNotFoundError);
    expect(revenueVsAppointmentsResult.value).toBeInstanceOf(
      ResourceNotFoundError,
    );
  });
});
