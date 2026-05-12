import { Money } from "../../../catalog/domain/value-objects/money";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeAppointment } from "../../../../../tests/factories/appointment-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { InMemoryAppointmentsRepository } from "../../../../../tests/repositories/in-memory-appointments-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
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
    const cancellationRateResult =
      await cancellationRateUseCase.execute(request);

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
    expect(cancellationRateResult.value.cancellationRate).toBe(0.5);
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
    const cancellationRateResult =
      await cancellationRateUseCase.execute(request);

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
    expect(cancellationRateResult.value.cancellationRate).toBe(0);
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
    const cancellationRateResult =
      await cancellationRateUseCase.execute(request);

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
