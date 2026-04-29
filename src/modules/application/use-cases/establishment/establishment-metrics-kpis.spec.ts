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

describe("Establishment metrics KPIs", () => {
  it("should calculate revenue, ticket, appointments and cancellation rate with filters", async () => {
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

    const protectionService = makeService(
      {
        establishmentId: establishment.id,
        category: "PROTECTION",
      },
      new UniqueEntityId("service-2"),
    );

    await servicesRepository.create(washService);
    await servicesRepository.create(protectionService);

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
        status: "CANCELLED",
        service: {
          serviceId: washService.id,
          serviceName: washService.serviceName.value,
          category: washService.category,
          durationInMinutes: 60,
          priceInCents: 15000,
        },
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

    const filters: EstablishmentMetricsFilters = {
      startsAt: new Date("2026-04-01T00:00:00Z"),
      endsAt: new Date("2026-04-02T23:59:59Z"),
      categories: ["WASH"],
      status: ["SCHEDULED", "CANCELLED"],
    };

    const totalRevenueUseCase = new GetEstablishmentTotalRevenueUseCase(
      establishmentsRepository,
      appointmentsRepository,
      servicesRepository,
    );
    const averageTicketUseCase = new GetEstablishmentAverageTicketUseCase(
      establishmentsRepository,
      appointmentsRepository,
      servicesRepository,
    );
    const appointmentsCountUseCase =
      new GetEstablishmentAppointmentsCountUseCase(
        establishmentsRepository,
        appointmentsRepository,
        servicesRepository,
      );
    const cancellationRateUseCase = new GetEstablishmentCancellationRateUseCase(
      establishmentsRepository,
      appointmentsRepository,
      servicesRepository,
    );

    const totalRevenueResult = await totalRevenueUseCase.execute({
      establishmentId: establishment.id.toString(),
      filters,
    });
    const averageTicketResult = await averageTicketUseCase.execute({
      establishmentId: establishment.id.toString(),
      filters,
    });
    const appointmentsCountResult = await appointmentsCountUseCase.execute({
      establishmentId: establishment.id.toString(),
      filters,
    });
    const cancellationRateResult = await cancellationRateUseCase.execute({
      establishmentId: establishment.id.toString(),
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

    expect(totalRevenueResult.value.totalRevenueInCents).toBe(25000);
    expect(averageTicketResult.value.averageTicketInCents).toBe(12500);
    expect(appointmentsCountResult.value.appointmentsCount).toBe(2);
    expect(cancellationRateResult.value.cancellationRate).toBe(0.5);
  });
});
