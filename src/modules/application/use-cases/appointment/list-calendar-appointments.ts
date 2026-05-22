import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { Appointment } from "../../../scheduling/domain/entities/appointment";
import { EmployeeFeaturesPolicy } from "../../../employees/domain/policies/employee-features-policy";
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

    const { establishment, employee } = scopeResult.value;

    if (employee) {
      if (
        !EmployeeFeaturesPolicy.hasAll(employee.features, ["read:appointments"])
      ) {
        return left(new NotAllowedError());
      }
    }

    const appointments =
      await this.appointmentsRepository.findManyByEstablishmentIdInCalendarRange(
        establishment.id.toString(),
        filters,
      );

    return right({
      appointments,
    });
  }
}
