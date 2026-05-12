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

type GetEstablishmentAverageTicketUseCaseRequest = {
  establishmentOwnerId: string;
  filters?: EstablishmentMetricsFilters;
};

type GetEstablishmentAverageTicketUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    averageTicketInCents: number;
  }
>;

@Injectable()
export class GetEstablishmentAverageTicketUseCase {
  constructor(
    private establishmentsRepository: EstablishmentsRepository,
    private appointmentsRepository: AppointmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    filters,
  }: GetEstablishmentAverageTicketUseCaseRequest): Promise<GetEstablishmentAverageTicketUseCaseResponse> {
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

    if (filteredAppointments.length === 0) {
      return right({
        averageTicketInCents: 0,
      });
    }

    const totalRevenueInCents = filteredAppointments.reduce(
      (acc, appointment) => acc + getAppointmentNetRevenueInCents(appointment),
      0,
    );

    return right({
      averageTicketInCents: Math.round(
        totalRevenueInCents / filteredAppointments.length,
      ),
    });
  }
}
