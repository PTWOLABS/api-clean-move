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
  AppointmentsRepository,
  CalendarAppointmentFilters,
} from "../../repositories/appointments-repository";

type ListCalendarAppointmentsUseCaseRequest = {
  actor: EstablishmentScopeActor;
  filters: CalendarAppointmentFilters;
};

type ListCalendarAppointmentsUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  {
    appointments: Appointment[];
    totalItems: number;
  }
>;

@Injectable()
export class ListCalendarAppointmentsUseCase {
  constructor(
    private appointmentsRepository: AppointmentsRepository,
    private establishmentScope: EstablishmentScopeService,
  ) {}

  async execute({
    actor,
    filters,
  }: ListCalendarAppointmentsUseCaseRequest): Promise<ListCalendarAppointmentsUseCaseResponse> {
    const scopeResult = await this.establishmentScope.resolve(actor);

    if (scopeResult.isLeft()) {
      return left(scopeResult.value);
    }

    const { establishment } = scopeResult.value;

    const { appointments, totalItems } =
      await this.appointmentsRepository.findManyByEstablishmentIdInCalendarRange(
        establishment.id.toString(),
        filters,
      );

    return right({
      appointments,
      totalItems,
    });
  }
}
