import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { Appointment } from "../../../scheduling/domain/entities/appointment";
import {
  AppointmentFilters,
  AppointmentsRepository,
} from "../../repositories/appointments-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type ListAppointmentsUseCaseRequest = {
  establishmentOwnerId: string;
  filters?: AppointmentFilters;
};

type ListAppointmentsUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    appointments: Appointment[];
  }
>;

@Injectable()
export class ListAppointmentsUseCase {
  constructor(
    private appointmentsRepository: AppointmentsRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    filters,
  }: ListAppointmentsUseCaseRequest): Promise<ListAppointmentsUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const appointments =
      await this.appointmentsRepository.findManyByEstablishmentId(
        establishment.id.toString(),
        filters,
      );

    return right({
      appointments,
    });
  }
}
