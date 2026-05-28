import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { InactiveServiceError } from "../../../catalog/domain/errors/inactive-service-error";
import { Money } from "../../../catalog/domain/value-objects/money";
import {
  Appointment,
  AppointmentVehicleSnapshot,
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

type UpdateAppointmentUseCaseRequest = {
  actor: EstablishmentScopeActor;
  appointmentId: string;
  customerId?: string;
  serviceIds?: string[];
  vehicleId?: string | null;
  startsAt?: Date;
  endsAt?: Date | null;
  description?: string | null;
  discountInCents?: number | null;
};

type UpdateAppointmentUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | InactiveServiceError
  | InvalidAppointmentInputError
  | UnexpectedDomainError,
  {
    appointment: Appointment;
  }
>;

type ResolveServicesResponse = Either<
  ResourceNotFoundError | InactiveServiceError | InvalidAppointmentInputError,
  {
    services: AppointmentServiceSnapshot[];
  }
>;

type ResolveVehicleResponse = Either<
  ResourceNotFoundError,
  {
    vehicleId: Appointment["vehicleId"];
    vehicle: AppointmentVehicleSnapshot;
  }
>;

@Injectable()
export class UpdateAppointmentUseCase {
  constructor(
    private appointmentsRepository: AppointmentsRepository,
    private customersRepository: CustomersRepository,
    private customerVehiclesRepository: CustomerVehiclesRepository,
    private establishmentScope: EstablishmentScopeService,
    private servicesRepository: ServicesRepository,
  ) {}

  async execute({
    actor,
    appointmentId,
    customerId,
    serviceIds,
    vehicleId,
    startsAt,
    endsAt,
    description,
    discountInCents,
  }: UpdateAppointmentUseCaseRequest): Promise<UpdateAppointmentUseCaseResponse> {
    const scopeResult = await this.establishmentScope.resolve(actor);

    if (scopeResult.isLeft()) {
      return left(scopeResult.value);
    }

    const { establishment } = scopeResult.value;
    const establishmentId = establishment.id.toString();

    const appointment =
      await this.appointmentsRepository.findByIdAndEstablishmentId(
        appointmentId,
        establishmentId,
      );

    if (!appointment) {
      return left(new ResourceNotFoundError({ resource: "appointment" }));
    }

    const effectiveCustomerId = customerId ?? appointment.customerId.toString();
    const customer = await this.customersRepository.findByIdAndEstablishmentId(
      effectiveCustomerId,
      establishmentId,
    );

    if (!customer || customer.isDeleted()) {
      return left(new ResourceNotFoundError({ resource: "customer" }));
    }

    const servicesResult: ResolveServicesResponse =
      serviceIds !== undefined
        ? await this.resolveServices(serviceIds, establishmentId)
        : right({ services: appointment.services });

    if (servicesResult.isLeft()) {
      return left(servicesResult.value);
    }

    const customerChanged = !customer.id.equals(appointment.customerId);
    const vehicleResult: ResolveVehicleResponse =
      vehicleId !== undefined
        ? await this.resolveVehicle(
            vehicleId,
            customer.id.toString(),
            establishmentId,
          )
        : right({
            vehicleId: customerChanged ? null : appointment.vehicleId,
            vehicle: customerChanged ? null : appointment.vehicle,
          });

    if (vehicleResult.isLeft()) {
      return left(vehicleResult.value);
    }

    try {
      appointment.update({
        ...(customerId !== undefined ? { customerId: customer.id } : {}),
        ...(serviceIds !== undefined
          ? { services: servicesResult.value.services }
          : {}),
        ...(vehicleId !== undefined || customerChanged
          ? {
              vehicleId: vehicleResult.value.vehicleId,
              vehicle: vehicleResult.value.vehicle,
            }
          : {}),
        ...(startsAt !== undefined ? { startsAt } : {}),
        ...(endsAt !== undefined ? { endsAt } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(discountInCents !== undefined
          ? {
              discountInCents:
                discountInCents !== null ? Money.create(discountInCents) : null,
            }
          : {}),
      });
    } catch (error) {
      return left(error instanceof Error ? error : new UnexpectedDomainError());
    }

    await this.appointmentsRepository.save(appointment);

    return right({
      appointment,
    });
  }

  private async resolveServices(
    serviceIds: string[],
    establishmentId: string,
  ): Promise<ResolveServicesResponse> {
    if (new Set(serviceIds).size !== serviceIds.length) {
      return left(
        new InvalidAppointmentInputError(
          "Duplicate services are not allowed in the same appointment.",
        ),
      );
    }

    const services: AppointmentServiceSnapshot[] = [];

    for (const serviceId of serviceIds) {
      const service =
        await this.servicesRepository.findByServiceIdAndEstablishmentId(
          serviceId,
          establishmentId,
        );

      if (!service || service.isDeleted()) {
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

    return right({ services });
  }

  private async resolveVehicle(
    vehicleId: string | null,
    customerId: string,
    establishmentId: string,
  ): Promise<ResolveVehicleResponse> {
    if (vehicleId === null) {
      return right({
        vehicleId: null,
        vehicle: null,
      });
    }

    const vehicle =
      await this.customerVehiclesRepository.findByIdAndCustomerIdAndEstablishmentId(
        vehicleId,
        customerId,
        establishmentId,
      );

    if (!vehicle || vehicle.isDeleted()) {
      return left(new ResourceNotFoundError({ resource: "vehicle" }));
    }

    return right({
      vehicleId: vehicle.id,
      vehicle: {
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        color: vehicle.color,
        year: vehicle.year,
      },
    });
  }
}
