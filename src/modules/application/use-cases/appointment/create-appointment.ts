import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { InactiveServiceError } from "../../../catalog/domain/errors/inactive-service-error";
import { Money } from "../../../catalog/domain/value-objects/money";
import { Appointment } from "../../../scheduling/domain/entities/appointment";
import { AppointmentsRepository } from "../../repositories/appointments-repository";
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../../repositories/customers-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import { ServicesRepository } from "../../repositories/services-repository";

type CreateAppointmentUseCaseRequest = {
  establishmentOwnerId: string;
  customerId: string;
  serviceId: string;
  vehicleId?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  description?: string | null;
  discountInCents?: number | null;
};

type CreateAppointmentUseCaseResponse = Either<
  ResourceNotFoundError | InactiveServiceError | UnexpectedDomainError,
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
    private establishmentsRepository: EstablishmentsRepository,
    private servicesRepository: ServicesRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    customerId,
    serviceId,
    vehicleId = null,
    startsAt,
    endsAt = null,
    description = null,
    discountInCents = null,
  }: CreateAppointmentUseCaseRequest): Promise<CreateAppointmentUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const customer = await this.customersRepository.findByIdAndEstablishmentId(
      customerId,
      establishment.id.toString(),
    );

    if (!customer || customer.isDeleted()) {
      return left(new ResourceNotFoundError({ resource: "customer" }));
    }

    const service =
      await this.servicesRepository.findByServiceIdAndEstablishmentId(
        serviceId,
        establishment.id.toString(),
      );

    if (!service) {
      return left(new ResourceNotFoundError({ resource: "service" }));
    }

    if (!service.isActive) {
      return left(new InactiveServiceError(service.serviceName.value));
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
        service: {
          serviceId: service.id,
          serviceName: service.serviceName.value,
          category: service.category,
          durationInMinutes: service.estimatedDuration?.upperBoundInMinutes,
          priceInCents: service.price.amountInCents,
        },
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
