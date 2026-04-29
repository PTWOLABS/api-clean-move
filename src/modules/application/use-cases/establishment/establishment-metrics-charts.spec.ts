import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeAppointment } from "../../../../../tests/factories/appointment-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { InMemoryAppointmentsRepository } from "../../../../../tests/repositories/in-memory-appointments-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { GetEstablishmentPopularServicesByCategoryUseCase } from "./get-establishment-popular-services-by-category";
import { GetEstablishmentRevenueVsAppointmentsUseCase } from "./get-establishment-revenue-vs-appointments";

describe("Establishment metrics charts", () => {
  it("should return popular services by category and revenue vs appointments", async () => {
    const servicesRepository = new InMemoryServicesRepository();
    const establishmentsRepository = new InMemoryEstablishmentsRepository(
      servicesRepository,
    );
    const appointmentsRepository = new InMemoryAppointmentsRepository();

    const establishment = makeEstablishment({}, new UniqueEntityId("est-1"));

    await establishmentsRepository.create(establishment);

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

    await servicesRepository.create(washService);
    await servicesRepository.create(detailsService);

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
        startsAt: new Date("2026-04-02T14:00:00Z"),
        endsAt: new Date("2026-04-02T15:00:00Z"),
      }),
    );

    const popularServicesUseCase =
      new GetEstablishmentPopularServicesByCategoryUseCase(
        establishmentsRepository,
        appointmentsRepository,
        servicesRepository,
      );

    const revenueVsAppointmentsUseCase =
      new GetEstablishmentRevenueVsAppointmentsUseCase(
        establishmentsRepository,
        appointmentsRepository,
        servicesRepository,
      );

    const popularServicesResult = await popularServicesUseCase.execute({
      establishmentId: establishment.id.toString(),
      filters: {
        categories: ["WASH", "AUTOMATIVE_DETAILING"],
        status: ["SCHEDULED"],
      },
    });

    const revenueVsAppointmentsResult =
      await revenueVsAppointmentsUseCase.execute({
        establishmentId: establishment.id.toString(),
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
      throw new Error("Expected charts metrics to be calculated successfully");
    }

    expect(popularServicesResult.value.popularServices).toEqual([
      {
        serviceId: washService.id.toString(),
        serviceName: washService.serviceName.value,
        category: "WASH",
        appointmentsCount: 2,
        revenueInCents: 22000,
      },
      {
        serviceId: detailsService.id.toString(),
        serviceName: detailsService.serviceName.value,
        category: "AUTOMATIVE_DETAILING",
        appointmentsCount: 1,
        revenueInCents: 30000,
      },
    ]);

    expect(revenueVsAppointmentsResult.value.points).toEqual([
      {
        period: "2026-04-01",
        appointmentsCount: 2,
        revenueInCents: 22000,
      },
      {
        period: "2026-04-02",
        appointmentsCount: 1,
        revenueInCents: 30000,
      },
    ]);
  });
});
