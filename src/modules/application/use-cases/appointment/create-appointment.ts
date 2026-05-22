import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { InactiveServiceError } from "../../../catalog/domain/errors/inactive-service-error";
import { Money } from "../../../catalog/domain/value-objects/money";
import {
  Appointment,
  AppointmentServiceSnapshot,
} from "../../../scheduling/domain/entities/appointment";
import { InvalidAppointmentInputError } from "../../../scheduling/domain/errors/invalid-appointment-input-error";
import {
  EstablishmentScopeActor,
  EstablishmentScopeService,
} from "../../services/establishment-scope";
import { AppointmentsRepository } from "../../repositories/appointments-repository";
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../../repositories/customers-repository";
import { ServicesRepository } from "../../repositories/services-repository";

type CreateAppointmentUseCaseRequest = {
  actor: EstablishmentScopeActor;
  customerId: string;
  serviceIds: string[];
  vehicleId?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  description?: string | null;
  discountInCents?: number | null;
};

type CreateAppointmentUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | InactiveServiceError
  | InvalidAppointmentInputError
  | UnexpectedDomainError,
  {
    appointment: Appointment;
  }
>;

@Injectable()
export class CreateAppointmentUseCase {
  constructor(
    private appointmentsRepository: AppointmentsRepository,
    private customersRepository: CustomersRepository,
    private customerVehiclesRepository: CustomerVehiclesRepository,
    private establishmentScope: EstablishmentScopeService,
    private servicesRepository: ServicesRepository,
  ) {}

  async execute({
    actor,
    customerId,
    serviceIds,
    vehicleId = null,
    startsAt,
    endsAt = null,
    description = null,
    discountInCents = null,
  }: CreateAppointmentUseCaseRequest): Promise<CreateAppointmentUseCaseResponse> {
    if (new Set(serviceIds).size !== serviceIds.length) {
      return left(
        new InvalidAppointmentInputError(
          "Duplicate services are not allowed in the same appointment.",
        ),
      );
    }

    const scopeResult = await this.establishmentScope.resolve(actor);

    if (scopeResult.isLeft()) {
      return left(scopeResult.value);
    }

    const { establishment } = scopeResult.value;

    const customer = await this.customersRepository.findByIdAndEstablishmentId(
      customerId,
      establishment.id.toString(),
    );

    if (!customer || customer.isDeleted()) {
      return left(new ResourceNotFoundError({ resource: "customer" }));
    }

    const services: AppointmentServiceSnapshot[] = [];

    for (const serviceId of serviceIds) {
      const service =
        await this.servicesRepository.findByServiceIdAndEstablishmentId(
          serviceId,
          establishment.id.toString(),
        );

      if (!service) {
        return left(new ResourceNotFoundError({ resource: "service" }));
      }

      if (service.isDeleted()) {
        return left(new ResourceNotFoundError({ resource: "service" }));
      }

      if (!service.isActive) {
        return left(new InactiveServiceError(service.serviceName.value));
      }

      services.push({
        serviceId: service.id,
        serviceName: service.serviceName.value,
        category: service.category,
        durationInMinutes: service.estimatedDuration?.upperBoundInMinutes,
        priceInCents: service.price.amountInCents,
      });
    }

    const vehicle = vehicleId
      ? await this.customerVehiclesRepository.findByIdAndCustomerIdAndEstablishmentId(
          vehicleId,
          customer.id.toString(),
          establishment.id.toString(),
        )
      : null;

    if (vehicleId && (!vehicle || vehicle.isDeleted())) {
      return left(new ResourceNotFoundError({ resource: "vehicle" }));
    }

    let appointment: Appointment;

    try {
      appointment = Appointment.create({
        establishmentId: establishment.id,
        customerId: customer.id,
        vehicleId: vehicle?.id ?? null,
        services,
        vehicle: vehicle
          ? {
              plate: vehicle.plate,
              brand: vehicle.brand,
              model: vehicle.model,
              color: vehicle.color,
              year: vehicle.year,
            }
          : null,
        startsAt,
        endsAt,
        description,
        discountInCents:
          discountInCents !== null ? Money.create(discountInCents) : null,
      });
    } catch (error) {
      return left(error instanceof Error ? error : new UnexpectedDomainError());
    }

    await this.appointmentsRepository.create(appointment);

    return right({
      appointment,
    });
  }
}
