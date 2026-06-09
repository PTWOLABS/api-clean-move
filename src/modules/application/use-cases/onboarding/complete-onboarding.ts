import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { hasAnyProvidedValue } from "../../../../shared/utils/has-any-provided-value";
import {
  Address,
  AddressCreateInput,
  InvalidAddressError,
} from "../../../accounts/domain/value-objects/address";
import {
  Email,
  InvalidEmailError,
} from "../../../accounts/domain/value-objects/email";
import {
  InvalidPhoneError,
  Phone,
} from "../../../accounts/domain/value-objects/phone";
import { Service } from "../../../catalog/domain/entities/services";
import { InvalidEstimatedDurationTransitionError } from "../../../catalog/domain/errors/invalid-estimated-duration-transition-error";
import {
  EstimatedDuration,
  InvalidEstimatedDurationError,
} from "../../../catalog/domain/value-objects/estimated-duration";
import {
  InvalidMoneyError,
  Money,
} from "../../../catalog/domain/value-objects/money";
import { ServiceCategory } from "../../../catalog/domain/value-objects/service-category";
import {
  InvalidServiceNameError,
  ServiceName,
} from "../../../catalog/domain/value-objects/service-name";
import { Customer } from "../../../customer/domain/entities/customer";
import { CustomerVehicle } from "../../../customer/domain/entities/customer-vehicle";
import { InvalidCustomerInputError } from "../../../customer/domain/errors/invalid-customer-input-error";
import { InvalidCustomerDocumentError } from "../../../customer/domain/value-objects/customer-document";
import { Establishment } from "../../../establishments/domain/entities/establishment";
import { InvalidCnpjError } from "../../../establishments/domain/value-objects/cnpj";
import { Appointment } from "../../../scheduling/domain/entities/appointment";
import { InvalidAppointmentInputError } from "../../../scheduling/domain/errors/invalid-appointment-input-error";
import { AppointmentsRepository } from "../../repositories/appointments-repository";
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../../repositories/customers-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import { ServicesRepository } from "../../repositories/services-repository";
import { UnitOfWork } from "../../repositories/unit-of-work";

export class InvalidOnboardingInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOnboardingInputError";
  }
}

type OnboardingEstablishmentInput = {
  tradeName?: string | undefined;
  legalBusinessName?: string | undefined;
  cnpj?: string | undefined;
};

type OnboardingServiceInput = {
  serviceName?: string | undefined;
  description?: string | undefined;
  category?: ServiceCategory | undefined;
  estimatedDuration?:
    | {
        minInMinutes?: number | undefined;
        maxInMinutes?: number | null | undefined;
      }
    | undefined;
  price?: number | undefined;
  isActive?: boolean | undefined;
};

type OnboardingCustomerInput = {
  cpfCnpj?: string | null | undefined;
  fullName?: string | undefined;
  phone?: string | undefined;
  email?: string | null | undefined;
  address?: AddressCreateInput | null | undefined;
  birthDate?: Date | null | undefined;
  nickname?: string | null | undefined;
};

type OnboardingVehicleInput = {
  plate?: string | null | undefined;
  brand?: string | null | undefined;
  model?: string | null | undefined;
  color?: string | null | undefined;
  year?: number | null | undefined;
  notes?: string | null | undefined;
};

type OnboardingAppointmentInput = {
  startsAt?: Date | undefined;
  endsAt?: Date | null | undefined;
  description?: string | null | undefined;
  discountInCents?: number | null | undefined;
};

type CompleteOnboardingUseCaseRequest = {
  establishmentOwnerId: string;
  establishment?: OnboardingEstablishmentInput | undefined;
  service?: OnboardingServiceInput | undefined;
  customer?: OnboardingCustomerInput | undefined;
  vehicle?: OnboardingVehicleInput | undefined;
  appointment?: OnboardingAppointmentInput | undefined;
};

type CompleteOnboardingUseCaseResponse = Either<
  | ResourceNotFoundError
  | ResourceAlreadyExistsError
  | InvalidOnboardingInputError
  | UnexpectedDomainError,
  {
    establishment: Establishment;
    service: Service | null;
    customer: Customer | null;
    vehicle: CustomerVehicle | null;
    appointment: Appointment | null;
  }
>;

@Injectable()
export class CompleteOnboardingUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly establishmentsRepository: EstablishmentsRepository,
    private readonly servicesRepository: ServicesRepository,
    private readonly customersRepository: CustomersRepository,
    private readonly customerVehiclesRepository: CustomerVehiclesRepository,
    private readonly appointmentsRepository: AppointmentsRepository,
  ) {}

  async execute(
    request: CompleteOnboardingUseCaseRequest,
  ): Promise<CompleteOnboardingUseCaseResponse> {
    const hasEstablishmentData = hasAnyProvidedValue(request.establishment);
    const hasServiceData = hasAnyProvidedValue(request.service);
    const hasCustomerData = hasAnyProvidedValue(request.customer);
    const hasVehicleData = hasAnyProvidedValue(request.vehicle);
    const hasAppointmentData = hasAnyProvidedValue(request.appointment);

    const validationError = this.validateConditionalPayload({
      hasServiceData,
      hasCustomerData,
      hasVehicleData,
      hasAppointmentData,
      service: request.service,
      customer: request.customer,
      appointment: request.appointment,
    });

    if (validationError) {
      return left(validationError);
    }

    try {
      return await this.unitOfWork.execute(async () => {
        const establishment = await this.establishmentsRepository.findByOwnerId(
          request.establishmentOwnerId,
        );

        if (!establishment) {
          return left(new ResourceNotFoundError({ resource: "establishment" }));
        }

        if (hasEstablishmentData && request.establishment) {
          const conflict = request.establishment.cnpj
            ? await this.establishmentsRepository.findByCnpj(
                request.establishment.cnpj,
              )
            : null;

          if (conflict && !conflict.id.equals(establishment.id)) {
            return left(
              new ResourceAlreadyExistsError(
                "Establishment already registered.",
              ),
            );
          }

          establishment.updateCommercialProfile({
            ...(request.establishment.tradeName !== undefined
              ? { tradeName: request.establishment.tradeName }
              : {}),
            ...(request.establishment.legalBusinessName !== undefined
              ? { legalBusinessName: request.establishment.legalBusinessName }
              : {}),
            ...(request.establishment.cnpj !== undefined
              ? { cnpj: request.establishment.cnpj }
              : {}),
          });

          await this.establishmentsRepository.save(establishment);
        }

        const service =
          hasServiceData && request.service
            ? await this.createService(establishment, request.service)
            : null;

        let customer: Customer | null = null;
        let vehicle: CustomerVehicle | null = null;
        let appointment: Appointment | null = null;

        if (hasCustomerData && request.customer) {
          customer = await this.createCustomer(establishment, request.customer);

          if (hasVehicleData && request.vehicle) {
            vehicle = await this.createVehicle(
              establishment,
              customer,
              request.vehicle,
            );
          }
        }

        if (hasAppointmentData && request.appointment && service && customer) {
          appointment = await this.createAppointment({
            establishment,
            service,
            customer,
            vehicle,
            appointmentInput: request.appointment,
          });
        }

        return right({
          establishment,
          service,
          customer,
          vehicle,
          appointment,
        });
      });
    } catch (error) {
      if (isKnownOnboardingInputError(error)) {
        return left(new InvalidOnboardingInputError(error.message));
      }

      if (error instanceof InvalidOnboardingInputError) {
        return left(error);
      }

      if (error instanceof ResourceAlreadyExistsError) {
        return left(error);
      }

      return left(new UnexpectedDomainError());
    }
  }

  private validateConditionalPayload({
    hasServiceData,
    hasCustomerData,
    hasVehicleData,
    hasAppointmentData,
    service,
    customer,
    appointment,
  }: {
    hasServiceData: boolean;
    hasCustomerData: boolean;
    hasVehicleData: boolean;
    hasAppointmentData: boolean;
    service?: OnboardingServiceInput | undefined;
    customer?: OnboardingCustomerInput | undefined;
    appointment?: OnboardingAppointmentInput | undefined;
  }) {
    if (hasServiceData) {
      if (
        !service?.serviceName?.trim() ||
        service.price === undefined ||
        service.category === undefined ||
        service.estimatedDuration?.minInMinutes === undefined
      ) {
        return new InvalidOnboardingInputError(
          "Service onboarding requires serviceName, price, category, and estimatedDuration.minInMinutes.",
        );
      }
    }

    if (hasVehicleData && !hasCustomerData) {
      return new InvalidOnboardingInputError(
        "Vehicle onboarding requires customer data.",
      );
    }

    if (hasCustomerData) {
      if (!customer?.fullName?.trim() || !customer.phone?.trim()) {
        return new InvalidOnboardingInputError(
          "Customer onboarding requires fullName and phone.",
        );
      }
    }

    if (hasAppointmentData) {
      if (!hasServiceData || !hasCustomerData) {
        return new InvalidOnboardingInputError(
          "Appointment onboarding requires service and customer data.",
        );
      }

      if (appointment?.startsAt === undefined) {
        return new InvalidOnboardingInputError(
          "Appointment onboarding requires startsAt.",
        );
      }

      if (service?.isActive === false) {
        return new InvalidOnboardingInputError(
          "Appointment onboarding requires an active service.",
        );
      }
    }

    return null;
  }

  private async createService(
    establishment: Establishment,
    serviceInput: OnboardingServiceInput,
  ) {
    const service = Service.create({
      establishmentId: establishment.id,
      serviceName: ServiceName.create(serviceInput.serviceName!),
      description: serviceInput.description,
      category: serviceInput.category,
      estimatedDuration: EstimatedDuration.create({
        minInMinutes: serviceInput.estimatedDuration!.minInMinutes!,
        maxInMinutes: serviceInput.estimatedDuration?.maxInMinutes,
      }),
      price: Money.create(serviceInput.price!),
      isActive: serviceInput.isActive ?? true,
    });

    await this.servicesRepository.create(service);

    return service;
  }

  private async createCustomer(
    establishment: Establishment,
    customerInput: OnboardingCustomerInput,
  ) {
    const customer = Customer.create({
      establishmentId: establishment.id,
      cpfCnpj: customerInput.cpfCnpj ?? null,
      fullName: customerInput.fullName!,
      phone: Phone.create(customerInput.phone!),
      email:
        customerInput.email !== undefined && customerInput.email !== null
          ? new Email(customerInput.email)
          : null,
      address: customerInput.address
        ? Address.create(customerInput.address)
        : null,
      birthDate: customerInput.birthDate ?? null,
      nickname: customerInput.nickname ?? null,
    });

    if (customer.cpfCnpj) {
      const conflict =
        await this.customersRepository.findActiveByCpfCnpjAndEstablishmentId(
          customer.cpfCnpj.toString(),
          establishment.id.toString(),
        );

      if (conflict) {
        throw new ResourceAlreadyExistsError("Customer already registered.");
      }
    }

    await this.customersRepository.create(customer);

    return customer;
  }

  private async createVehicle(
    establishment: Establishment,
    customer: Customer,
    vehicleInput: OnboardingVehicleInput,
  ) {
    const vehicle = CustomerVehicle.create({
      establishmentId: establishment.id,
      customerId: customer.id,
      plate: vehicleInput.plate ?? null,
      brand: vehicleInput.brand ?? null,
      model: vehicleInput.model ?? null,
      color: vehicleInput.color ?? null,
      year: vehicleInput.year ?? null,
      notes: vehicleInput.notes ?? null,
    });

    if (vehicle.plate) {
      const conflict =
        await this.customerVehiclesRepository.findActiveByPlateAndEstablishmentId(
          vehicle.plate,
          establishment.id.toString(),
        );

      if (conflict) {
        throw new ResourceAlreadyExistsError("Vehicle already registered.");
      }
    }

    await this.customerVehiclesRepository.create(vehicle);

    return vehicle;
  }

  private async createAppointment({
    establishment,
    service,
    customer,
    vehicle,
    appointmentInput,
  }: {
    establishment: Establishment;
    service: Service;
    customer: Customer;
    vehicle: CustomerVehicle | null;
    appointmentInput: OnboardingAppointmentInput;
  }) {
    const appointment = Appointment.create({
      establishmentId: establishment.id,
      customerId: customer.id,
      customer: {
        fullName: customer.fullName,
      },
      vehicleId: vehicle?.id ?? null,
      services: [
        {
          serviceId: service.id,
          serviceName: service.serviceName.value,
          category: service.category,
          durationInMinutes: service.estimatedDuration?.upperBoundInMinutes,
          priceInCents: service.price.amountInCents,
        },
      ],
      vehicle: vehicle
        ? {
            plate: vehicle.plate,
            brand: vehicle.brand,
            model: vehicle.model,
            color: vehicle.color,
            year: vehicle.year,
          }
        : null,
      startsAt: appointmentInput.startsAt!,
      endsAt: appointmentInput.endsAt ?? null,
      description: appointmentInput.description ?? null,
      discountInCents:
        appointmentInput.discountInCents !== undefined &&
        appointmentInput.discountInCents !== null
          ? Money.create(appointmentInput.discountInCents)
          : null,
    });

    await this.appointmentsRepository.create(appointment);

    return appointment;
  }
}

function isKnownOnboardingInputError(error: unknown): error is Error {
  return (
    error instanceof InvalidAddressError ||
    error instanceof InvalidAppointmentInputError ||
    error instanceof InvalidCnpjError ||
    error instanceof InvalidCustomerDocumentError ||
    error instanceof InvalidCustomerInputError ||
    error instanceof InvalidEmailError ||
    error instanceof InvalidEstimatedDurationError ||
    error instanceof InvalidEstimatedDurationTransitionError ||
    error instanceof InvalidMoneyError ||
    error instanceof InvalidPhoneError ||
    error instanceof InvalidServiceNameError
  );
}
