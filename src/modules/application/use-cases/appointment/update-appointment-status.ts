import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import {
  Appointment,
  AppointmentStatus,
} from "../../../scheduling/domain/entities/appointment";
import {
  EmployeeFeature,
  EmployeeFeaturesPolicy,
} from "../../../employees/domain/policies/employee-features-policy";
import {
  EstablishmentScopeActor,
  EstablishmentScopeService,
} from "../../services/establishment-scope";
import { AppointmentsRepository } from "../../repositories/appointments-repository";

type UpdateAppointmentStatusUseCaseRequest = {
  actor: EstablishmentScopeActor;
  appointmentId: string;
  status: AppointmentStatus;
};

type UpdateAppointmentStatusUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  {
    appointment: Appointment;
  }
>;

@Injectable()
export class UpdateAppointmentStatusUseCase {
  constructor(
    private appointmentsRepository: AppointmentsRepository,
    private establishmentScope: EstablishmentScopeService,
  ) {}

  async execute({
    actor,
    appointmentId,
    status,
  }: UpdateAppointmentStatusUseCaseRequest): Promise<UpdateAppointmentStatusUseCaseResponse> {
    const scopeResult = await this.establishmentScope.resolve(actor);

    if (scopeResult.isLeft()) {
      return left(scopeResult.value);
    }

    const { establishment, employee } = scopeResult.value;

    if (employee) {
      const requiredFeature: EmployeeFeature =
        status === "CANCELLED" ? "delete:appointments" : "update:appointments";

      if (!EmployeeFeaturesPolicy.hasAll(employee.features, [requiredFeature])) {
        return left(new NotAllowedError());
      }
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
