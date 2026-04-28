import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import {
  Appointment,
  AppointmentStatus,
} from "../../../scheduling/domain/entities/appointment";
import { AppointmentsRepository } from "../../repositories/appointments-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type UpdateAppointmentStatusUseCaseRequest = {
  establishmentOwnerId: string;
  appointmentId: string;
  status: AppointmentStatus;
};

type UpdateAppointmentStatusUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    appointment: Appointment;
  }
>;

@Injectable()
export class UpdateAppointmentStatusUseCase {
  constructor(
    private appointmentsRepository: AppointmentsRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    appointmentId,
    status,
  }: UpdateAppointmentStatusUseCaseRequest): Promise<UpdateAppointmentStatusUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const appointment =
      await this.appointmentsRepository.findByIdAndEstablishmentId(
        appointmentId,
        establishment.id.toString(),
      );

    if (!appointment) {
      return left(new ResourceNotFoundError({ resource: "appointment" }));
    }

    appointment.changeStatus(status);

    await this.appointmentsRepository.save(appointment);

    return right({
      appointment,
    });
  }
}
