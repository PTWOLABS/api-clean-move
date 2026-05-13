import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { AppointmentsRepository } from "../../repositories/appointments-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import {
  EstablishmentMetricsFilters,
  filterAppointmentsByMetrics,
  findAllAppointmentsByEstablishment,
  getAppointmentNetRevenueInCents,
} from "./establishment-metrics-helpers";

type GetEstablishmentPopularServicesByCategoryUseCaseRequest = {
  establishmentOwnerId: string;
  filters?: EstablishmentMetricsFilters;
};

type PopularServiceByCategoryItem = {
  serviceId: string;
  serviceName: string;
  category: string | null;
  appointmentsCount: number;
  revenueInCents: number;
};

type GetEstablishmentPopularServicesByCategoryUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    popularServices: PopularServiceByCategoryItem[];
  }
>;

@Injectable()
export class GetEstablishmentPopularServicesByCategoryUseCase {
  constructor(
    private establishmentsRepository: EstablishmentsRepository,
    private appointmentsRepository: AppointmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    filters,
  }: GetEstablishmentPopularServicesByCategoryUseCaseRequest): Promise<GetEstablishmentPopularServicesByCategoryUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const appointments = await findAllAppointmentsByEstablishment(
      this.appointmentsRepository,
      establishment.id.toString(),
      filters,
    );

    const filteredAppointments = filterAppointmentsByMetrics(
      appointments,
      filters,
    );

    const groupedByService = new Map<string, PopularServiceByCategoryItem>();

    for (const appointment of filteredAppointments) {
      const serviceId = appointment.service.serviceId.toString();
      const current = groupedByService.get(serviceId);
      const netRevenueInCents = getAppointmentNetRevenueInCents(appointment);

      if (!current) {
        groupedByService.set(serviceId, {
          serviceId,
          serviceName: appointment.service.serviceName,
          category: appointment.service.category ?? null,
          appointmentsCount: 1,
          revenueInCents: netRevenueInCents,
        });

        continue;
      }

      groupedByService.set(serviceId, {
        ...current,
        appointmentsCount: current.appointmentsCount + 1,
        revenueInCents: current.revenueInCents + netRevenueInCents,
      });
    }

    const popularServices = Array.from(groupedByService.values()).sort(
      (a, b) => {
        if (b.appointmentsCount === a.appointmentsCount) {
          return b.revenueInCents - a.revenueInCents;
        }

        return b.appointmentsCount - a.appointmentsCount;
      },
    );

    return right({
      popularServices,
    });
  }
}
