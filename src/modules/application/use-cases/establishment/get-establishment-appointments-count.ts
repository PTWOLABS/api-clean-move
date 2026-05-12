import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { AppointmentsRepository } from "../../repositories/appointments-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import {
  EstablishmentMetricsFilters,
  filterAppointmentsByMetrics,
  findAllAppointmentsByEstablishment,
} from "./establishment-metrics-helpers";

type GetEstablishmentAppointmentsCountUseCaseRequest = {
  establishmentOwnerId: string;
  filters?: EstablishmentMetricsFilters;
};

type GetEstablishmentAppointmentsCountUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    appointmentsCount: number;
  }
>;

@Injectable()
export class GetEstablishmentAppointmentsCountUseCase {
  constructor(
    private establishmentsRepository: EstablishmentsRepository,
    private appointmentsRepository: AppointmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    filters,
  }: GetEstablishmentAppointmentsCountUseCaseRequest): Promise<GetEstablishmentAppointmentsCountUseCaseResponse> {
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

    return right({
      appointmentsCount: filteredAppointments.length,
    });
  }
}
