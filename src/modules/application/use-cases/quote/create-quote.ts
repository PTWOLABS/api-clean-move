import { Injectable } from "@nestjs/common";

import { Address } from "../../../accounts/domain/value-objects/address";
import { InactiveServiceError } from "../../../catalog/domain/errors/inactive-service-error";
import {
  Quote,
  QuoteAddressSnapshot,
  QuoteCustomerSnapshot,
  QuotePaymentOptionInput,
  QuoteServiceSnapshotInput,
  QuoteVehicleSnapshot,
} from "../../../quotes/domain/entities/quote";
import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import { Either, left, right } from "../../../../shared/either";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../../repositories/customers-repository";
import { QuotesRepository } from "../../repositories/quotes-repository";
import { ServicesRepository } from "../../repositories/services-repository";
import { UsersRepository } from "../../repositories/users-repository";
import {
  EstablishmentScopeActor,
  EstablishmentScopeService,
} from "../../services/establishment-scope";

type QuoteCustomerInput = {
  name: string;
  phone?: string | null;
  cpfCnpj?: string | null;
  address?: QuoteAddressSnapshot;
};

type QuoteVehicleInput = {
  plate?: string | null;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
};

type QuoteServiceItemInput = {
  serviceId: string;
  isCourtesy?: boolean;
};

export type CreateQuoteUseCaseRequest = {
  actor: EstablishmentScopeActor;
  customerId?: string | null;
  customer?: QuoteCustomerInput;
  vehicleId?: string | null;
  vehicle?: QuoteVehicleInput | null;
  serviceItems: QuoteServiceItemInput[];
  paymentOptions: QuotePaymentOptionInput[];
  description?: string | null;
  termsAndConditions?: string | null;
  expiresAt?: Date | null;
};

type CreateQuoteUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | InactiveServiceError
  | InvalidQuoteInputError
  | UnexpectedDomainError,
  {
    quote: Quote;
  }
>;

type CustomerSnapshotResult = {
  customerId: UniqueEntityId | null;
  customer: QuoteCustomerSnapshot;
};

type VehicleSnapshotResult = {
  vehicleId: UniqueEntityId | null;
  vehicle: QuoteVehicleSnapshot;
};

@Injectable()
export class CreateQuoteUseCase {
  constructor(
    private quotesRepository: QuotesRepository,
    private customersRepository: CustomersRepository,
    private customerVehiclesRepository: CustomerVehiclesRepository,
    private establishmentScope: EstablishmentScopeService,
    private servicesRepository: ServicesRepository,
    private usersRepository: UsersRepository,
  ) {}

  async execute(
    request: CreateQuoteUseCaseRequest,
  ): Promise<CreateQuoteUseCaseResponse> {
    const scope = await this.establishmentScope.resolve(request.actor);
    if (scope.isLeft()) return left(scope.value);

    const { establishment } = scope.value;
    const owner = await this.usersRepository.findById(
      establishment.ownerId.toString(),
    );
    if (!owner) return left(new ResourceNotFoundError({ resource: "owner" }));

    const customerResult = await this.resolveCustomerSnapshot(
      request,
      establishment.id.toString(),
    );
    if (customerResult.isLeft()) return left(customerResult.value);

    const vehicleResult = await this.resolveVehicleSnapshot(
      request,
      customerResult.value.customerId,
      establishment.id.toString(),
    );
    if (vehicleResult.isLeft()) return left(vehicleResult.value);

    const servicesResult = await this.resolveServices(
      request.serviceItems,
      establishment.id.toString(),
    );
    if (servicesResult.isLeft()) return left(servicesResult.value);

    let quote: Quote;

    try {
      quote = Quote.create({
        establishmentId: establishment.id,
        customerId: customerResult.value.customerId,
        vehicleId: vehicleResult.value.vehicleId,
        establishment: {
          name: establishment.tradeName ?? owner.name,
          legalBusinessName:
            establishment.legalBusinessName ??
            establishment.tradeName ??
            owner.name,
          cnpj: establishment.cnpj?.toString() ?? "",
          address: toAddressSnapshot(owner.address),
          bannerImageUrl: establishment.bannerImageUrl,
        },
        customer: customerResult.value.customer,
        vehicle: vehicleResult.value.vehicle,
        services: servicesResult.value,
        paymentOptions: request.paymentOptions,
        description: request.description ?? null,
        termsAndConditions: request.termsAndConditions ?? null,
        expiresAt: request.expiresAt ?? null,
      });
    } catch (error) {
      return left(error instanceof Error ? error : new UnexpectedDomainError());
    }

    await this.quotesRepository.create(quote);

    return right({ quote });
  }

  private async resolveCustomerSnapshot(
    request: CreateQuoteUseCaseRequest,
    establishmentId: string,
  ): Promise<
    Either<
      ResourceNotFoundError | InvalidQuoteInputError,
      CustomerSnapshotResult
    >
  > {
    if (request.customerId) {
      const customer =
        await this.customersRepository.findByIdAndEstablishmentId(
          request.customerId,
          establishmentId,
        );

      if (!customer || customer.isDeleted()) {
        return left(new ResourceNotFoundError({ resource: "customer" }));
      }

      return right({
        customerId: customer.id,
        customer: {
          name: customer.fullName,
          phone: customer.phone.toString(),
          cpfCnpj: customer.cpfCnpj?.toString() ?? null,
          address: toAddressSnapshot(customer.address),
        },
      });
    }

    const name = request.customer?.name.trim();

    if (!name) {
      return left(new InvalidQuoteInputError("customer.name is required."));
    }

    return right({
      customerId: null,
      customer: {
        name,
        phone: request.customer?.phone ?? null,
        cpfCnpj: request.customer?.cpfCnpj ?? null,
        address: request.customer?.address ?? null,
      },
    });
  }

  private async resolveVehicleSnapshot(
    request: CreateQuoteUseCaseRequest,
    customerId: UniqueEntityId | null,
    establishmentId: string,
  ): Promise<
    Either<
      ResourceNotFoundError | InvalidQuoteInputError,
      VehicleSnapshotResult
    >
  > {
    if (request.vehicleId && !customerId) {
      return left(
        new InvalidQuoteInputError(
          "vehicleId requires an existing customerId.",
        ),
      );
    }

    if (request.vehicleId && customerId) {
      const vehicle =
        await this.customerVehiclesRepository.findByIdAndCustomerIdAndEstablishmentId(
          request.vehicleId,
          customerId.toString(),
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

    return right({
      vehicleId: null,
      vehicle: request.vehicle
        ? {
            plate: request.vehicle.plate ?? null,
            brand: request.vehicle.brand ?? null,
            model: request.vehicle.model ?? null,
            color: request.vehicle.color ?? null,
            year: request.vehicle.year ?? null,
          }
        : null,
    });
  }

  private async resolveServices(
    serviceItems: QuoteServiceItemInput[],
    establishmentId: string,
  ): Promise<
    Either<
      ResourceNotFoundError | InactiveServiceError,
      QuoteServiceSnapshotInput[]
    >
  > {
    const services: QuoteServiceSnapshotInput[] = [];

    for (const item of serviceItems) {
      const service =
        await this.servicesRepository.findByServiceIdAndEstablishmentId(
          item.serviceId,
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
        isCourtesy: item.isCourtesy ?? false,
      });
    }

    return right(services);
  }
}

function toAddressSnapshot(address: Address | null): QuoteAddressSnapshot {
  if (address === null) {
    return null;
  }

  return {
    street: address.street,
    country: address.country,
    state: address.state,
    zipCode: address.zipCode,
    city: address.city,
    complement: address.complement,
  };
}
