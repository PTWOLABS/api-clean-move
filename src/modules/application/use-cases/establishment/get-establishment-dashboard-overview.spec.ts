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

describe("Get establishment dashboard overview", () => {
  it("should calculate overview KPIs with filters, discounts, and establishment isolation", async () => {
    const repositories = makeRepositories();
    const { appointmentsRepository, establishmentsRepository } = repositories;
    const findByOwnerIdSpy = vi.spyOn(
      establishmentsRepository,
      "findByOwnerId",
    );
    const findManyByEstablishmentIdSpy = vi.spyOn(
      appointmentsRepository,
      "findManyByEstablishmentId",
    );

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

    const sut = makeSut(repositories);

    const result = await sut.execute({
      establishmentOwnerId: ownerId.toString(),
      filters,
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw new Error(
        "Expected overview metrics to be calculated successfully",
      );
    }

    expect(result.value).toEqual({
      totalRevenueInCents: 19000,
      averageTicketInCents: 9500,
      appointmentsCount: 2,
      cancellationRate: 0.5,
    });
    expect(findByOwnerIdSpy).toHaveBeenCalledTimes(1);
    expect(findManyByEstablishmentIdSpy).toHaveBeenCalledTimes(1);
    expect(findManyByEstablishmentIdSpy).toHaveBeenCalledWith("est-1", {
      startsAt: filters.startsAt,
      endsAt: filters.endsAt,
      status: filters.status,
      categories: filters.categories,
      page: 1,
      size: 20,
    });
  });

  it("should return zero overview KPI values when no appointments match", async () => {
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
      }),
    );

    const sut = makeSut(repositories);

    const result = await sut.execute({
      establishmentOwnerId: ownerId.toString(),
      filters: {
        status: ["DONE"],
      },
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw new Error(
        "Expected overview metrics to be calculated successfully",
      );
    }

    expect(result.value).toEqual({
      totalRevenueInCents: 0,
      averageTicketInCents: 0,
      appointmentsCount: 0,
      cancellationRate: 0,
    });
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
