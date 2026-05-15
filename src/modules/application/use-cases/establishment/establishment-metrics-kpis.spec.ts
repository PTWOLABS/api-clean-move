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
import { GetEstablishmentAppointmentsCountUseCase } from "./get-establishment-appointments-count";
import { GetEstablishmentAverageTicketUseCase } from "./get-establishment-average-ticket";
import { GetEstablishmentCancellationRateUseCase } from "./get-establishment-cancellation-rate";
import { GetEstablishmentTotalRevenueUseCase } from "./get-establishment-total-revenue";
import { EstablishmentMetricsFilters } from "./establishment-metrics-helpers";

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

function makeKpiUseCases({
  appointmentsRepository,
  establishmentsRepository,
}: ReturnType<typeof makeRepositories>) {
  const totalRevenueUseCase = new GetEstablishmentTotalRevenueUseCase(
    establishmentsRepository,
    appointmentsRepository,
  );
  const averageTicketUseCase = new GetEstablishmentAverageTicketUseCase(
    establishmentsRepository,
    appointmentsRepository,
  );
  const appointmentsCountUseCase = new GetEstablishmentAppointmentsCountUseCase(
    establishmentsRepository,
    appointmentsRepository,
  );
  const cancellationRateUseCase = new GetEstablishmentCancellationRateUseCase(
    establishmentsRepository,
    appointmentsRepository,
  );

  return {
    appointmentsCountUseCase,
    averageTicketUseCase,
    cancellationRateUseCase,
    totalRevenueUseCase,
  };
}

function makeMetricsRange(
  currentStartsAt: string,
  currentEndsAt: string,
  comparisonStartsAt: string,
  comparisonEndsAt: string,
): ResolvedDashboardMetricsRange {
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

describe("Establishment metrics KPIs", () => {
  it("should calculate revenue, average ticket, appointments and cancellation rate with filters", async () => {
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
    const protectionService = makeService(
      {
        establishmentId: establishment.id,
        category: "PROTECTION",
      },
      new UniqueEntityId("service-2"),
    );
    const otherWashService = makeService(
      {
        establishmentId: otherEstablishment.id,
        category: "WASH",
      },
      new UniqueEntityId("service-3"),
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
        status: "CANCELLED",
        service: {
          serviceId: washService.id,
          serviceName: washService.serviceName.value,
          category: washService.category,
          durationInMinutes: 60,
          priceInCents: 15000,
        },
        discountInCents: Money.create(5000),
        startsAt: new Date("2026-04-02T10:00:00Z"),
        endsAt: new Date("2026-04-02T11:00:00Z"),
      }),
    );

    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "SCHEDULED",
        service: {
          serviceId: protectionService.id,
          serviceName: protectionService.serviceName.value,
          category: protectionService.category,
          durationInMinutes: 60,
          priceInCents: 25000,
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
          priceInCents: 99999,
        },
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
          priceInCents: 10000,
        },
        startsAt: new Date("2026-03-30T10:00:00Z"),
        endsAt: new Date("2026-03-30T11:00:00Z"),
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
          priceInCents: 10000,
        },
        startsAt: new Date("2026-03-31T10:00:00Z"),
        endsAt: new Date("2026-03-31T11:00:00Z"),
      }),
    );

    const filters: EstablishmentMetricsFilters = {
      startsAt: new Date("2026-04-01T00:00:00Z"),
      endsAt: new Date("2026-04-02T23:59:59Z"),
      categories: ["WASH"],
      status: ["SCHEDULED", "CANCELLED"],
    };

    const {
      appointmentsCountUseCase,
      averageTicketUseCase,
      cancellationRateUseCase,
      totalRevenueUseCase,
    } = makeKpiUseCases(repositories);

    const request = {
      establishmentOwnerId: ownerId.toString(),
      filters,
    };

    const totalRevenueResult = await totalRevenueUseCase.execute(request);
    const averageTicketResult = await averageTicketUseCase.execute(request);
    const appointmentsCountResult =
      await appointmentsCountUseCase.execute(request);
    const cancellationRateResult = await cancellationRateUseCase.execute({
      establishmentOwnerId: ownerId.toString(),
      range: makeMetricsRange(
        "2026-04-01T00:00:00Z",
        "2026-04-02T23:59:59Z",
        "2026-03-30T00:00:00Z",
        "2026-03-31T23:59:59Z",
      ),
      filters,
    });

    expect(totalRevenueResult.isRight()).toBe(true);
    expect(averageTicketResult.isRight()).toBe(true);
    expect(appointmentsCountResult.isRight()).toBe(true);
    expect(cancellationRateResult.isRight()).toBe(true);

    if (
      totalRevenueResult.isLeft() ||
      averageTicketResult.isLeft() ||
      appointmentsCountResult.isLeft() ||
      cancellationRateResult.isLeft()
    ) {
      throw new Error("Expected metrics to be calculated successfully");
    }

    expect(totalRevenueResult.value.totalRevenueInCents).toBe(19000);
    expect(averageTicketResult.value.averageTicketInCents).toBe(9500);
    expect(appointmentsCountResult.value.appointmentsCount).toBe(2);
    expect(typeof cancellationRateResult.value.appointmentsCount).toBe(
      "number",
    );
    expect(cancellationRateResult.value.appointmentsCount).toBe(2);
    expect(cancellationRateResult.value.cancellationRate).toEqual({
      currentPercent: 50,
      comparisonPercentPoints: 50,
    });
  });

  it("should calculate cancellation rate percentages from current and comparison ranges", async () => {
    const repositories = makeRepositories();
    const { appointmentsRepository, establishmentsRepository } = repositories;

    const ownerId = new UniqueEntityId("owner-1");
    const establishment = makeEstablishment(
      { ownerId },
      new UniqueEntityId("est-1"),
    );

    await establishmentsRepository.create(establishment);

    const washService = makeService({
      establishmentId: establishment.id,
      category: "WASH",
    });
    const protectionService = makeService({
      establishmentId: establishment.id,
      category: "PROTECTION",
    });

    const createAppointment = async ({
      status,
      startsAt,
      category = "WASH",
    }: {
      status: "SCHEDULED" | "DONE" | "CANCELLED";
      startsAt: string;
      category?: "WASH" | "PROTECTION";
    }) => {
      const service = category === "WASH" ? washService : protectionService;

      await appointmentsRepository.create(
        makeAppointment({
          establishmentId: establishment.id,
          status,
          service: {
            serviceId: service.id,
            serviceName: service.serviceName.value,
            category: service.category,
            durationInMinutes: 60,
            priceInCents: 10000,
          },
          startsAt: new Date(startsAt),
          endsAt: new Date(new Date(startsAt).getTime() + 60 * 60 * 1000),
        }),
      );
    };

    await createAppointment({
      status: "CANCELLED",
      startsAt: "2026-04-01T10:00:00Z",
    });
    await createAppointment({
      status: "SCHEDULED",
      startsAt: "2026-04-02T10:00:00Z",
    });
    await createAppointment({
      status: "DONE",
      startsAt: "2026-04-03T10:00:00Z",
    });
    await createAppointment({
      status: "CANCELLED",
      startsAt: "2026-04-01T12:00:00Z",
      category: "PROTECTION",
    });
    await createAppointment({
      status: "CANCELLED",
      startsAt: "2026-03-28T10:00:00Z",
    });
    await createAppointment({
      status: "SCHEDULED",
      startsAt: "2026-03-29T10:00:00Z",
    });
    await createAppointment({
      status: "SCHEDULED",
      startsAt: "2026-03-30T10:00:00Z",
    });
    await createAppointment({
      status: "DONE",
      startsAt: "2026-03-31T10:00:00Z",
    });
    await createAppointment({
      status: "CANCELLED",
      startsAt: "2026-03-29T12:00:00Z",
      category: "PROTECTION",
    });

    const { cancellationRateUseCase } = makeKpiUseCases(repositories);

    const result = await cancellationRateUseCase.execute({
      establishmentOwnerId: ownerId.toString(),
      range: makeMetricsRange(
        "2026-04-01T00:00:00Z",
        "2026-04-03T23:59:59Z",
        "2026-03-28T00:00:00Z",
        "2026-03-31T23:59:59Z",
      ),
      filters: {
        categories: ["WASH"],
        status: ["DONE"],
      },
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw new Error("Expected cancellation rate to be calculated");
    }

    expect(typeof result.value.appointmentsCount).toBe("number");
    expect(result.value.appointmentsCount).toBe(3);
    expect(result.value.cancellationRate).toEqual({
      currentPercent: 33.3,
      comparisonPercentPoints: 8.3,
    });
  });

  it("should return null comparison percent points when comparison has no appointments", async () => {
    const repositories = makeRepositories();
    const { appointmentsRepository, establishmentsRepository } = repositories;

    const ownerId = new UniqueEntityId("owner-1");
    const establishment = makeEstablishment(
      { ownerId },
      new UniqueEntityId("est-1"),
    );

    await establishmentsRepository.create(establishment);

    const washService = makeService({
      establishmentId: establishment.id,
      category: "WASH",
    });

    await appointmentsRepository.create(
      makeAppointment({
        establishmentId: establishment.id,
        status: "CANCELLED",
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

    const { cancellationRateUseCase } = makeKpiUseCases(repositories);

    const result = await cancellationRateUseCase.execute({
      establishmentOwnerId: ownerId.toString(),
      range: makeMetricsRange(
        "2026-04-01T00:00:00Z",
        "2026-04-01T23:59:59Z",
        "2026-03-31T00:00:00Z",
        "2026-03-31T23:59:59Z",
      ),
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw new Error("Expected cancellation rate to be calculated");
    }

    expect(result.value.cancellationRate).toEqual({
      currentPercent: 100,
      comparisonPercentPoints: null,
    });
  });

  it("should return zero KPI values when no appointments match", async () => {
    const repositories = makeRepositories();
    const { establishmentsRepository } = repositories;

    const ownerId = new UniqueEntityId("owner-1");
    const establishment = makeEstablishment(
      { ownerId },
      new UniqueEntityId("est-1"),
    );

    await establishmentsRepository.create(establishment);

    const filters: EstablishmentMetricsFilters = {
      status: ["DONE"],
    };

    const {
      appointmentsCountUseCase,
      averageTicketUseCase,
      cancellationRateUseCase,
      totalRevenueUseCase,
    } = makeKpiUseCases(repositories);

    const request = {
      establishmentOwnerId: ownerId.toString(),
      filters,
    };

    const totalRevenueResult = await totalRevenueUseCase.execute(request);
    const averageTicketResult = await averageTicketUseCase.execute(request);
    const appointmentsCountResult =
      await appointmentsCountUseCase.execute(request);
    const cancellationRateResult = await cancellationRateUseCase.execute({
      establishmentOwnerId: ownerId.toString(),
      range: makeMetricsRange(
        "2026-04-01T00:00:00Z",
        "2026-04-01T23:59:59Z",
        "2026-03-31T00:00:00Z",
        "2026-03-31T23:59:59Z",
      ),
      filters,
    });

    expect(totalRevenueResult.isRight()).toBe(true);
    expect(averageTicketResult.isRight()).toBe(true);
    expect(appointmentsCountResult.isRight()).toBe(true);
    expect(cancellationRateResult.isRight()).toBe(true);

    if (
      totalRevenueResult.isLeft() ||
      averageTicketResult.isLeft() ||
      appointmentsCountResult.isLeft() ||
      cancellationRateResult.isLeft()
    ) {
      throw new Error("Expected metrics to be calculated successfully");
    }

    expect(totalRevenueResult.value.totalRevenueInCents).toBe(0);
    expect(averageTicketResult.value.averageTicketInCents).toBe(0);
    expect(appointmentsCountResult.value.appointmentsCount).toBe(0);
    expect(typeof cancellationRateResult.value.appointmentsCount).toBe(
      "number",
    );
    expect(cancellationRateResult.value).toEqual({
      appointmentsCount: 0,
      cancellationRate: {
        currentPercent: 0,
        comparisonPercentPoints: null,
      },
    });
  });

  it("should return ResourceNotFoundError when owner has no establishment", async () => {
    const {
      appointmentsCountUseCase,
      averageTicketUseCase,
      cancellationRateUseCase,
      totalRevenueUseCase,
    } = makeKpiUseCases(makeRepositories());

    const request = {
      establishmentOwnerId: "missing-owner",
    };

    const totalRevenueResult = await totalRevenueUseCase.execute(request);
    const averageTicketResult = await averageTicketUseCase.execute(request);
    const appointmentsCountResult =
      await appointmentsCountUseCase.execute(request);
    const cancellationRateResult = await cancellationRateUseCase.execute({
      establishmentOwnerId: "missing-owner",
      range: makeMetricsRange(
        "2026-04-01T00:00:00Z",
        "2026-04-01T23:59:59Z",
        "2026-03-31T00:00:00Z",
        "2026-03-31T23:59:59Z",
      ),
    });

    expect(totalRevenueResult.isLeft()).toBe(true);
    expect(averageTicketResult.isLeft()).toBe(true);
    expect(appointmentsCountResult.isLeft()).toBe(true);
    expect(cancellationRateResult.isLeft()).toBe(true);

    if (
      totalRevenueResult.isRight() ||
      averageTicketResult.isRight() ||
      appointmentsCountResult.isRight() ||
      cancellationRateResult.isRight()
    ) {
      throw new Error("Expected metrics to fail with ResourceNotFoundError");
    }

    expect(totalRevenueResult.value).toBeInstanceOf(ResourceNotFoundError);
    expect(averageTicketResult.value).toBeInstanceOf(ResourceNotFoundError);
    expect(appointmentsCountResult.value).toBeInstanceOf(ResourceNotFoundError);
    expect(cancellationRateResult.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
