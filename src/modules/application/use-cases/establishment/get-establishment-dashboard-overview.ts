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

type GetEstablishmentDashboardOverviewUseCaseRequest = {
  establishmentOwnerId: string;
  filters?: EstablishmentMetricsFilters;
};

type GetEstablishmentDashboardOverviewUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    totalRevenueInCents: number;
    averageTicketInCents: number;
    appointmentsCount: number;
    cancellationRate: number;
  }
>;

@Injectable()
export class GetEstablishmentDashboardOverviewUseCase {
  constructor(
    private establishmentsRepository: EstablishmentsRepository,
    private appointmentsRepository: AppointmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    filters,
  }: GetEstablishmentDashboardOverviewUseCaseRequest): Promise<GetEstablishmentDashboardOverviewUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const appointments = await findAllAppointmentsByEstablishment(
      this.appointmentsRepository,
      establishment.id.toString(),
    );

    const filteredAppointments = filterAppointmentsByMetrics(
      appointments,
      filters,
    );

    let totalRevenueInCents = 0;
    let cancelledCount = 0;

    for (const appointment of filteredAppointments) {
      totalRevenueInCents += getAppointmentNetRevenueInCents(appointment);

      if (appointment.status === "CANCELLED") {
        cancelledCount += 1;
      }
    }

    const appointmentsCount = filteredAppointments.length;
    const averageTicketInCents =
      appointmentsCount === 0
        ? 0
        : Math.round(totalRevenueInCents / appointmentsCount);
    const cancellationRate =
      appointmentsCount === 0
        ? 0
        : Number((cancelledCount / appointmentsCount).toFixed(4));

    return right({
      totalRevenueInCents,
      averageTicketInCents,
      appointmentsCount,
      cancellationRate,
    });
  }
}
