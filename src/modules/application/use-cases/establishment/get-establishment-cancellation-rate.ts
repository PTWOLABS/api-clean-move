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

type GetEstablishmentCancellationRateUseCaseRequest = {
  establishmentOwnerId: string;
  filters?: EstablishmentMetricsFilters;
};

type GetEstablishmentCancellationRateUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    cancellationRate: number;
  }
>;

@Injectable()
export class GetEstablishmentCancellationRateUseCase {
  constructor(
    private establishmentsRepository: EstablishmentsRepository,
    private appointmentsRepository: AppointmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    filters,
  }: GetEstablishmentCancellationRateUseCaseRequest): Promise<GetEstablishmentCancellationRateUseCaseResponse> {
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

    if (filteredAppointments.length === 0) {
      return right({ cancellationRate: 0 });
    }

    const cancelledCount = filteredAppointments.filter(
      (appointment) => appointment.status === "CANCELLED",
    ).length;

    return right({
      cancellationRate: Number(
        (cancelledCount / filteredAppointments.length).toFixed(4),
      ),
    });
  }
}
