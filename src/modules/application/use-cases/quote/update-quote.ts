import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { InactiveServiceError } from "../../../catalog/domain/errors/inactive-service-error";
import { Customer } from "../../../customer/domain/entities/customer";
import { CustomerVehicle } from "../../../customer/domain/entities/customer-vehicle";
import {
  Quote,
  QuoteAddressSnapshot,
  QuoteCustomerSnapshot,
  QuotePaymentOptionInput,
  QuoteServiceSnapshotInput,
  QuoteVehicleSnapshot,
} from "../../../quotes/domain/entities/quote";
import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../../repositories/customers-repository";
import { QuotesRepository } from "../../repositories/quotes-repository";
import { ServicesRepository } from "../../repositories/services-repository";
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

export type UpdateQuoteUseCaseRequest = {
  actor: EstablishmentScopeActor;
  quoteId: string;
  customerId?: string | null;
  customer?: QuoteCustomerInput | null;
  vehicleId?: string | null;
  vehicle?: QuoteVehicleInput | null;
  serviceItems?: QuoteServiceItemInput[];
  paymentOptions?: QuotePaymentOptionInput[];
  description?: string | null;
  termsAndConditions?: string | null;
  expiresAt?: Date | null;
  referenceDate?: Date;
};

type UpdateQuoteUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | InactiveServiceError
  | InvalidQuoteInputError
  | UnexpectedDomainError,
  {
    quote: Quote;
  }
>;

type ResolvedCustomer = {
  customerId: UniqueEntityId | null;
  customer: QuoteCustomerSnapshot;
  customerRecord: Customer | null;
};

type ResolvedVehicle = {
  vehicleId: UniqueEntityId | null;
  vehicle: QuoteVehicleSnapshot;
};

type ResolvedServices = {
  services?: QuoteServiceSnapshotInput[];
};

@Injectable()
export class UpdateQuoteUseCase {
  constructor(
    private quotesRepository: QuotesRepository,
    private customersRepository: CustomersRepository,
    private customerVehiclesRepository: CustomerVehiclesRepository,
    private establishmentScope: EstablishmentScopeService,
    private servicesRepository: ServicesRepository,
  ) {}

  async execute(
    request: UpdateQuoteUseCaseRequest,
  ): Promise<UpdateQuoteUseCaseResponse> {
    const referenceDate = request.referenceDate ?? new Date();
    const scope = await this.establishmentScope.resolve(request.actor);
    if (scope.isLeft()) return left(scope.value);

    const establishmentId = scope.value.establishment.id.toString();
    const quote = await this.quotesRepository.findByIdAndEstablishmentId(
      request.quoteId,
      establishmentId,
    );

    if (!quote) return left(new ResourceNotFoundError({ resource: "quote" }));

    const statusResult = assertCanUpdateQuote(quote, referenceDate);
    if (statusResult) return left(statusResult);

    const customerResult = await this.resolveCustomer(
      quote,
      request,
      establishmentId,
    );
    if (customerResult.isLeft()) return left(customerResult.value);

    const vehicleResult = await this.resolveVehicle(
      quote,
      request,
      establishmentId,
      customerResult.value.customerRecord,
    );
    if (vehicleResult.isLeft()) return left(vehicleResult.value);

    const servicesResult = await this.resolveServices(request, establishmentId);
    if (servicesResult.isLeft()) return left(servicesResult.value);

    if (
      request.paymentOptions !== undefined &&
      request.serviceItems === undefined
    ) {
      const staleServices = await this.hasStaleCurrentServices(
        quote,
        establishmentId,
      );
      if (staleServices) {
        return left(
          new InvalidQuoteInputError(
            "serviceItems must be provided before updating payment options.",
          ),
        );
      }
    }

    try {
      quote.update({
        ...(customerResult.value.customerId !== quote.customerId ||
        request.customerId !== undefined
          ? { customerId: customerResult.value.customerId }
          : {}),
        ...(request.customer !== undefined || request.customerId !== undefined
          ? { customer: customerResult.value.customer }
          : {}),
        ...(request.vehicleId !== undefined || request.vehicle !== undefined
          ? {
              vehicleId: vehicleResult.value.vehicleId,
              vehicle: vehicleResult.value.vehicle,
            }
          : {}),
        ...(servicesResult.value.services !== undefined
          ? { services: servicesResult.value.services }
          : {}),
        ...(request.paymentOptions !== undefined
          ? { paymentOptions: request.paymentOptions }
          : {}),
        ...(request.description !== undefined
          ? { description: request.description }
          : {}),
        ...(request.termsAndConditions !== undefined
          ? { termsAndConditions: request.termsAndConditions }
          : {}),
        ...(request.expiresAt !== undefined
          ? { expiresAt: request.expiresAt }
          : {}),
        referenceDate,
      });
    } catch (error) {
      return left(error instanceof Error ? error : new UnexpectedDomainError());
    }

    await this.quotesRepository.save(quote);

    return right({ quote });
  }

  private async resolveCustomer(
    quote: Quote,
    request: UpdateQuoteUseCaseRequest,
    establishmentId: string,
  ): Promise<
    Either<ResourceNotFoundError | InvalidQuoteInputError, ResolvedCustomer>
  > {
    if (request.customerId === null || request.customer === null) {
      return left(
        new InvalidQuoteInputError("customerId or customer is required."),
      );
    }

    if (request.customerId !== undefined && request.customer !== undefined) {
      return left(
        new InvalidQuoteInputError("Provide either customerId or customer."),
      );
    }

    if (quote.customerId && request.customer !== undefined) {
      return left(
        new InvalidQuoteInputError(
          "customer cannot be provided for quotes linked to a customer.",
        ),
      );
    }

    if (request.customerId !== undefined) {
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
        customer: customerToSnapshot(customer),
        customerRecord: customer,
      });
    }

    if (quote.customerId) {
      const customer =
        await this.customersRepository.findByIdAndEstablishmentId(
          quote.customerId.toString(),
          establishmentId,
        );

      if (!customer || customer.isDeleted()) {
        return left(new ResourceNotFoundError({ resource: "customer" }));
      }

      return right({
        customerId: quote.customerId,
        customer: quote.customer,
        customerRecord: customer,
      });
    }

    if (request.customer !== undefined) {
      return right({
        customerId: null,
        customer: {
          name: request.customer.name,
          phone: request.customer.phone ?? null,
          cpfCnpj: request.customer.cpfCnpj ?? null,
          address: request.customer.address ?? null,
        },
        customerRecord: null,
      });
    }

    return right({
      customerId: null,
      customer: quote.customer,
      customerRecord: null,
    });
  }

  private async resolveVehicle(
    quote: Quote,
    request: UpdateQuoteUseCaseRequest,
    establishmentId: string,
    customer: Customer | null,
  ): Promise<
    Either<ResourceNotFoundError | InvalidQuoteInputError, ResolvedVehicle>
  > {
    if (request.vehicleId !== undefined && request.vehicle !== undefined) {
      return left(
        new InvalidQuoteInputError("Provide either vehicleId or vehicle."),
      );
    }

    if (request.vehicleId === undefined && request.vehicle === undefined) {
      return right({
        vehicleId: quote.vehicleId,
        vehicle: quote.vehicle,
      });
    }

    if (request.vehicleId === null || request.vehicle === null) {
      return left(new InvalidQuoteInputError("vehicle is required."));
    }

    if (request.vehicleId !== undefined) {
      if (!customer) {
        return left(
          new InvalidQuoteInputError(
            "vehicleId requires a quote linked to a customer.",
          ),
        );
      }

      const vehicle =
        await this.customerVehiclesRepository.findByIdAndCustomerIdAndEstablishmentId(
          request.vehicleId,
          customer.id.toString(),
          establishmentId,
        );

      if (!vehicle || vehicle.isDeleted()) {
        return left(new ResourceNotFoundError({ resource: "vehicle" }));
      }

      return right({
        vehicleId: vehicle.id,
        vehicle: vehicleToSnapshot(vehicle),
      });
    }

    if (!request.vehicle) {
      return left(new InvalidQuoteInputError("vehicle is required."));
    }

    const brand = request.vehicle.brand?.trim();
    const model = request.vehicle.model?.trim();

    if (!brand || !model) {
      return left(
        new InvalidQuoteInputError(
          "vehicle.brand and vehicle.model are required.",
        ),
      );
    }

    return right({
      vehicleId: null,
      vehicle: {
        plate: request.vehicle.plate ?? null,
        brand,
        model,
        color: request.vehicle.color ?? null,
        year: request.vehicle.year ?? null,
      },
    });
  }

  private async resolveServices(
    request: UpdateQuoteUseCaseRequest,
    establishmentId: string,
  ): Promise<
    Either<ResourceNotFoundError | InactiveServiceError, ResolvedServices>
  > {
    if (request.serviceItems === undefined) {
      return right({});
    }

    const services: QuoteServiceSnapshotInput[] = [];

    for (const item of request.serviceItems) {
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
        priceInCents: service.priceSpecification.defaultChargePriceInCents,
        isCourtesy: item.isCourtesy ?? false,
      });
    }

    return right({ services });
  }

  private async hasStaleCurrentServices(quote: Quote, establishmentId: string) {
    const currentServices =
      await this.servicesRepository.findManyByIdsAndEstablishmentIdIncludingDeleted(
        quote.services.map((service) => service.serviceId.toString()),
        establishmentId,
      );
    const servicesById = new Map(
      currentServices.map((service) => [service.id.toString(), service]),
    );

    return quote.services.some((snapshot) => {
      const service = servicesById.get(snapshot.serviceId.toString());

      if (!service || service.isDeleted() || !service.isActive) {
        return true;
      }

      const currentDuration =
        service.estimatedDuration?.upperBoundInMinutes ?? undefined;
      const currentCategoryId = service.category?.id.toString() ?? null;
      const snapshotCategoryId = snapshot.category?.id.toString() ?? null;
      const currentCategoryName = service.category?.name ?? null;
      const snapshotCategoryName = snapshot.category?.name ?? null;

      return (
        service.serviceName.value !== snapshot.serviceName ||
        currentDuration !== snapshot.durationInMinutes ||
        service.priceSpecification.defaultChargePriceInCents !==
          snapshot.priceInCents ||
        currentCategoryId !== snapshotCategoryId ||
        currentCategoryName !== snapshotCategoryName
      );
    });
  }
}

function assertCanUpdateQuote(
  quote: Quote,
  referenceDate: Date,
): InvalidQuoteInputError | null {
  if (quote.convertedAppointmentId) {
    return new InvalidQuoteInputError("Approved quotes cannot be updated.");
  }

  if (!quote.expiresAt) {
    return null;
  }

  const todayStart = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    ),
  );

  if (quote.expiresAt < todayStart) {
    return new InvalidQuoteInputError("Expired quotes cannot be updated.");
  }

  return null;
}

function customerToSnapshot(customer: Customer): QuoteCustomerSnapshot {
  return {
    name: customer.fullName,
    phone: customer.phone?.toString() ?? null,
    cpfCnpj: customer.cpfCnpj?.toString() ?? null,
    address: customer.address
      ? {
          street: customer.address.street,
          country: customer.address.country,
          state: customer.address.state,
          zipCode: customer.address.zipCode,
          city: customer.address.city,
          complement: customer.address.complement,
        }
      : null,
  };
}

function vehicleToSnapshot(vehicle: CustomerVehicle): QuoteVehicleSnapshot {
  return {
    plate: vehicle.plate,
    brand: vehicle.brand,
    model: vehicle.model,
    color: vehicle.color,
    year: vehicle.year,
  };
}
