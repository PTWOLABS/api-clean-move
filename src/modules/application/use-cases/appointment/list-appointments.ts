import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { Appointment } from "../../../scheduling/domain/entities/appointment";
import {
  EstablishmentScopeActor,
  EstablishmentScopeService,
} from "../../services/establishment-scope";
import {
  AppointmentFilters,
  AppointmentsRepository,
} from "../../repositories/appointments-repository";
import { AppointmentResourceStatusResolver } from "../../services/appointment-resource-status-resolver";

type ListAppointmentsUseCaseRequest = {
  actor: EstablishmentScopeActor;
  filters?: AppointmentFilters;
};

type ListAppointmentsUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  {
    appointments: Appointment[];
    totalItems: number;
  }
>;

@Injectable()
export class ListAppointmentsUseCase {
  constructor(
    private appointmentsRepository: AppointmentsRepository,
    private establishmentScope: EstablishmentScopeService,
    private appointmentResourceStatusResolver: AppointmentResourceStatusResolver,
  ) {}

  async execute({
    actor,
    filters,
  }: ListAppointmentsUseCaseRequest): Promise<ListAppointmentsUseCaseResponse> {
    const scopeResult = await this.establishmentScope.resolve(actor);

    if (scopeResult.isLeft()) {
      return left(scopeResult.value);
    }

    const { establishment } = scopeResult.value;

    const { appointments, totalItems } =
      await this.appointmentsRepository.findManyByEstablishmentId(
        establishment.id.toString(),
        filters,
      );

    await this.appointmentResourceStatusResolver.applyToAppointments(
      appointments,
      establishment.id.toString(),
    );

    return right({
      appointments,
      totalItems,
    });
  }
}
