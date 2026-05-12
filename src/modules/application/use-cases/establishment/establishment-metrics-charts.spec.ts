import { Money } from "../../../catalog/domain/value-objects/money";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeAppointment } from "../../../../../tests/factories/appointment-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { InMemoryAppointmentsRepository } from "../../../../../tests/repositories/in-memory-appointments-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { GetEstablishmentPopularServicesByCategoryUseCase } from "./get-establishment-popular-services-by-category";
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
  const popularServicesUseCase =
    new GetEstablishmentPopularServicesByCategoryUseCase(
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

describe("Establishment metrics charts", () => {
  it("should return popular services and revenue vs appointments using snapshots and filters", async () => {
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

    const popularServicesResult = await popularServicesUseCase.execute({
      establishmentOwnerId: ownerId.toString(),
      filters: {
        categories: ["WASH", "AUTOMATIVE_DETAILING"],
        status: ["SCHEDULED"],
      },
    });

    const revenueVsAppointmentsResult =
      await revenueVsAppointmentsUseCase.execute({
        establishmentOwnerId: ownerId.toString(),
        filters: {
          status: ["SCHEDULED"],
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

    expect(popularServicesResult.value.popularServices).toEqual([
      {
        serviceId: washService.id.toString(),
        serviceName: washService.serviceName.value,
        category: "WASH",
        appointmentsCount: 2,
        revenueInCents: 21000,
      },
      {
        serviceId: detailsService.id.toString(),
        serviceName: detailsService.serviceName.value,
        category: "AUTOMATIVE_DETAILING",
        appointmentsCount: 1,
        revenueInCents: 25000,
      },
    ]);

    expect(revenueVsAppointmentsResult.value.points).toEqual([
      {
        period: "2026-04-01",
        appointmentsCount: 2,
        revenueInCents: 21000,
      },
      {
        period: "2026-04-02",
        appointmentsCount: 1,
        revenueInCents: 25000,
      },
    ]);
  });

  it("should return empty arrays when no appointments match", async () => {
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
      filters: {
        categories: ["WASH"],
      },
    });

    const revenueVsAppointmentsResult =
      await revenueVsAppointmentsUseCase.execute({
        establishmentOwnerId: ownerId.toString(),
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
    expect(revenueVsAppointmentsResult.value.points).toEqual([]);
  });

  it("should return ResourceNotFoundError when owner has no establishment", async () => {
    const { popularServicesUseCase, revenueVsAppointmentsUseCase } =
      makeChartUseCases(makeRepositories());

    const popularServicesResult = await popularServicesUseCase.execute({
      establishmentOwnerId: "missing-owner",
    });
    const revenueVsAppointmentsResult =
      await revenueVsAppointmentsUseCase.execute({
        establishmentOwnerId: "missing-owner",
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
