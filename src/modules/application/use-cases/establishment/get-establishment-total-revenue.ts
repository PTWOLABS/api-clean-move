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

type GetEstablishmentTotalRevenueUseCaseRequest = {
  establishmentOwnerId: string;
  filters?: EstablishmentMetricsFilters;
};

type GetEstablishmentTotalRevenueUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    totalRevenueInCents: number;
  }
>;

@Injectable()
export class GetEstablishmentTotalRevenueUseCase {
  constructor(
    private establishmentsRepository: EstablishmentsRepository,
    private appointmentsRepository: AppointmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    filters,
  }: GetEstablishmentTotalRevenueUseCaseRequest): Promise<GetEstablishmentTotalRevenueUseCaseResponse> {
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

    const totalRevenueInCents = filteredAppointments.reduce(
      (acc, appointment) => acc + getAppointmentNetRevenueInCents(appointment),
      0,
    );

    return right({
      totalRevenueInCents,
    });
  }
}
