import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { AppointmentAlreadyDeletedError } from "../../../scheduling/domain/errors/appointment-already-deleted-error";
import { DoneAppointmentCannotBeDeletedError } from "../../../scheduling/domain/errors/done-appointment-cannot-be-deleted-error";
import {
  EstablishmentScopeActor,
  EstablishmentScopeService,
} from "../../services/establishment-scope";
import { AppointmentsRepository } from "../../repositories/appointments-repository";

type DeleteAppointmentUseCaseRequest = {
  actor: EstablishmentScopeActor;
  appointmentId: string;
};

type DeleteAppointmentUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | DoneAppointmentCannotBeDeletedError
  | UnexpectedDomainError,
  Record<string, never>
>;

@Injectable()
export class DeleteAppointmentUseCase {
  constructor(
    private appointmentsRepository: AppointmentsRepository,
    private establishmentScope: EstablishmentScopeService,
  ) {}

  async execute({
    actor,
    appointmentId,
  }: DeleteAppointmentUseCaseRequest): Promise<DeleteAppointmentUseCaseResponse> {
    const scopeResult = await this.establishmentScope.resolve(actor);

    if (scopeResult.isLeft()) {
      return left(scopeResult.value);
    }

    const { establishment } = scopeResult.value;

    const appointment =
      await this.appointmentsRepository.findByIdAndEstablishmentId(
        appointmentId,
        establishment.id.toString(),
      );

    if (!appointment) {
      return left(new ResourceNotFoundError({ resource: "appointment" }));
    }

    try {
      appointment.softDelete();
      await this.appointmentsRepository.save(appointment);
    } catch (error) {
      if (error instanceof AppointmentAlreadyDeletedError) {
        return left(new ResourceNotFoundError({ resource: "appointment" }));
      }

      if (error instanceof DoneAppointmentCannotBeDeletedError) {
        return left(error);
      }

      if (error instanceof Error) {
        return left(new UnexpectedDomainError());
      }

      throw error;
    }

    return right({});
  }
}
