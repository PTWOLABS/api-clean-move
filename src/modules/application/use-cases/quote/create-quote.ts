import { Injectable } from "@nestjs/common";

import { Address } from "../../../accounts/domain/value-objects/address";
import { Email } from "../../../accounts/domain/value-objects/email";
import { Phone } from "../../../accounts/domain/value-objects/phone";
import { InactiveServiceError } from "../../../catalog/domain/errors/inactive-service-error";
import {
  InvalidServiceNameError,
  ServiceName,
} from "../../../catalog/domain/value-objects/service-name";
import { CustomerVehicle } from "../../../customer/domain/entities/customer-vehicle";
import { CustomerDocument } from "../../../customer/domain/value-objects/customer-document";
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
  ChargeableServiceItemInput,
  resolveChargeableServices,
} from "../../services/chargeable-service-resolver";
import {
  EstablishmentScopeActor,
  EstablishmentScopeService,
} from "../../services/establishment-scope";

type QuoteCustomerInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
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
  serviceId?: string | null;
  serviceName?: string;
  priceInCents?: number;
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
    if (request.customerId && request.customer !== undefined) {
      return left(
        new InvalidQuoteInputError(
          "customer cannot be provided with customerId.",
        ),
      );
    }

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
          phone: customer.phone?.toString() ?? null,
          email: customer.email?.toString() ?? null,
          cpfCnpj: customer.cpfCnpj?.toString() ?? null,
          address: toAddressSnapshot(customer.address),
        },
      });
    }

    const name = request.customer?.name.trim();

    if (!name) {
      return left(new InvalidQuoteInputError("customer.name is required."));
    }

    const phoneResult = normalizePhoneSnapshot(request.customer?.phone);
    if (phoneResult.isLeft()) return left(phoneResult.value);

    const emailResult = normalizeEmailSnapshot(request.customer?.email);
    if (emailResult.isLeft()) return left(emailResult.value);

    const documentResult = normalizeCustomerDocumentSnapshot(
      request.customer?.cpfCnpj,
    );
    if (documentResult.isLeft()) return left(documentResult.value);

    const addressResult = normalizeAddressSnapshot(request.customer?.address);
    if (addressResult.isLeft()) return left(addressResult.value);

    return right({
      customerId: null,
      customer: {
        name,
        phone: phoneResult.value,
        email: emailResult.value,
        cpfCnpj: documentResult.value,
        address: addressResult.value,
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
    if (
      request.vehicleId &&
      request.vehicle !== undefined &&
      request.vehicle !== null
    ) {
      return left(
        new InvalidQuoteInputError(
          "vehicle cannot be provided with vehicleId.",
        ),
      );
    }

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

    const vehicleResult = normalizeVehicleSnapshot(request.vehicle);
    if (vehicleResult.isLeft()) return left(vehicleResult.value);

    return right({
      vehicleId: null,
      vehicle: vehicleResult.value,
    });
  }

  private async resolveServices(
    serviceItems: QuoteServiceItemInput[],
    establishmentId: string,
  ): Promise<
    Either<
      ResourceNotFoundError | InactiveServiceError | InvalidQuoteInputError,
      QuoteServiceSnapshotInput[]
    >
  > {
    const serviceItemsResult = this.normalizeServiceItems(serviceItems);

    if (serviceItemsResult.isLeft()) {
      return left(serviceItemsResult.value);
    }

    const services: QuoteServiceSnapshotInput[] = [];

    for (const item of serviceItemsResult.value) {
      if (item.serviceId) {
        const resolvedServicesResult = await resolveChargeableServices({
          servicesRepository: this.servicesRepository,
          establishmentId,
          serviceItems: [item as ChargeableServiceItemInput],
          makeInvalidPriceError: (message) =>
            new InvalidQuoteInputError(message),
        });

        if (resolvedServicesResult.isLeft()) {
          return left(resolvedServicesResult.value);
        }

        const { service, priceInCents } = resolvedServicesResult.value[0]!;

        services.push({
          serviceId: service.id,
          serviceName: service.serviceName.value,
          category: service.category,
          durationInMinutes: service.estimatedDuration?.upperBoundInMinutes,
          priceInCents,
          isCourtesy: item.isCourtesy ?? false,
        });

        continue;
      }

      const detachedServiceResult = await this.resolveDetachedService(
        item,
        establishmentId,
      );

      if (detachedServiceResult.isLeft()) {
        return left(detachedServiceResult.value);
      }

      services.push(detachedServiceResult.value);
    }

    return right(services);
  }

  private async resolveDetachedService(
    serviceItem: QuoteServiceItemInput,
    establishmentId: string,
  ): Promise<Either<InvalidQuoteInputError, QuoteServiceSnapshotInput>> {
    const serviceNameInput = serviceItem.serviceName;

    if (!serviceNameInput) {
      return left(new InvalidQuoteInputError("serviceName is required."));
    }

    if (serviceItem.priceInCents === undefined) {
      return left(new InvalidQuoteInputError("priceInCents is required."));
    }

    let serviceName: ServiceName;

    try {
      serviceName = ServiceName.create(serviceNameInput);
    } catch (error) {
      if (error instanceof InvalidServiceNameError) {
        return left(new InvalidQuoteInputError(error.message));
      }

      return left(new InvalidQuoteInputError("Invalid serviceName."));
    }

    const existingService =
      await this.servicesRepository.findActiveByNameAndEstablishmentId(
        serviceName.value,
        establishmentId,
      );

    if (existingService) {
      return left(
        new InvalidQuoteInputError(
          "A service with this name already exists. Select the existing service or use another name.",
          "QUOTE_SERVICE_NAME_ALREADY_EXISTS",
        ),
      );
    }

    return right({
      serviceName: serviceName.value,
      priceInCents: serviceItem.priceInCents,
      isCourtesy: serviceItem.isCourtesy ?? false,
    });
  }

  private normalizeServiceItems(
    serviceItems: QuoteServiceItemInput[],
  ): Either<InvalidQuoteInputError, QuoteServiceItemInput[]> {
    if (serviceItems.length === 0) {
      return left(
        new InvalidQuoteInputError("At least one service is required."),
      );
    }

    const ids = serviceItems
      .map((item) => item.serviceId)
      .filter((serviceId): serviceId is string => Boolean(serviceId));

    const itemWithAmbiguousService = serviceItems.some(
      (item) => item.serviceId && item.serviceName !== undefined,
    );

    if (itemWithAmbiguousService) {
      return left(
        new InvalidQuoteInputError(
          "serviceName cannot be provided with serviceId.",
        ),
      );
    }

    if (new Set(ids).size !== ids.length) {
      return left(
        new InvalidQuoteInputError(
          "Duplicate services are not allowed in the same quote.",
        ),
      );
    }

    const detachedServiceNames = serviceItems
      .filter((item) => !item.serviceId)
      .map((item) => item.serviceName?.trim().toLowerCase())
      .filter(
        (serviceName): serviceName is string =>
          serviceName !== undefined && serviceName.length > 0,
      );

    if (new Set(detachedServiceNames).size !== detachedServiceNames.length) {
      return left(
        new InvalidQuoteInputError(
          "Duplicate detached services are not allowed in the same quote.",
        ),
      );
    }

    return right(serviceItems);
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

function normalizeOptionalText(value: string | null | undefined) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return null;
  }

  return normalizedValue;
}

function normalizePhoneSnapshot(
  value: string | null | undefined,
): Either<InvalidQuoteInputError, string | null> {
  const normalizedValue = normalizeOptionalText(value);

  if (normalizedValue === null) {
    return right(null);
  }

  try {
    return right(Phone.create(normalizedValue).toString());
  } catch (error) {
    return left(
      new InvalidQuoteInputError(
        error instanceof Error ? error.message : "Invalid customer.phone.",
      ),
    );
  }
}

function normalizeEmailSnapshot(
  value: string | null | undefined,
): Either<InvalidQuoteInputError, string | null> {
  const normalizedValue = normalizeOptionalText(value);

  if (normalizedValue === null) {
    return right(null);
  }

  try {
    return right(new Email(normalizedValue).toString());
  } catch (error) {
    return left(
      new InvalidQuoteInputError(
        error instanceof Error ? error.message : "Invalid customer.email.",
      ),
    );
  }
}

function normalizeCustomerDocumentSnapshot(
  value: string | null | undefined,
): Either<InvalidQuoteInputError, string | null> {
  const normalizedValue = normalizeOptionalText(value);

  if (normalizedValue === null) {
    return right(null);
  }

  try {
    return right(CustomerDocument.create(normalizedValue).toString());
  } catch (error) {
    return left(
      new InvalidQuoteInputError(
        error instanceof Error ? error.message : "Invalid customer.cpfCnpj.",
      ),
    );
  }
}

function normalizeAddressSnapshot(
  address: QuoteAddressSnapshot | undefined,
): Either<InvalidQuoteInputError, QuoteAddressSnapshot> {
  if (address === undefined || address === null) {
    return right(null);
  }

  const street = normalizeOptionalText(address.street);
  const country = normalizeOptionalText(address.country);
  const state = normalizeOptionalText(address.state);
  const zipCode = normalizeOptionalText(address.zipCode);
  const city = normalizeOptionalText(address.city);

  if (!street || !country || !state || !zipCode || !city) {
    return left(
      new InvalidQuoteInputError(
        "customer.address must include street, country, state, zipCode, and city.",
      ),
    );
  }

  try {
    return right(
      toAddressSnapshot(
        Address.create({
          street,
          country,
          state,
          zipCode,
          city,
          complement: address.complement,
        }),
      ),
    );
  } catch (error) {
    return left(
      new InvalidQuoteInputError(
        error instanceof Error ? error.message : "Invalid customer.address.",
      ),
    );
  }
}

function normalizeVehicleSnapshot(
  vehicle: QuoteVehicleInput | null | undefined,
): Either<InvalidQuoteInputError, QuoteVehicleSnapshot> {
  if (vehicle === undefined || vehicle === null) {
    return right(null);
  }

  const brand = normalizeOptionalText(vehicle.brand);
  const model = normalizeOptionalText(vehicle.model);

  if (!brand) {
    return left(new InvalidQuoteInputError("vehicle.brand is required."));
  }

  if (!model) {
    return left(new InvalidQuoteInputError("vehicle.model is required."));
  }

  let plate: string | null;

  try {
    plate = CustomerVehicle.normalizePlate(vehicle.plate ?? null);
  } catch (error) {
    return left(
      new InvalidQuoteInputError(
        error instanceof Error ? error.message : "Invalid vehicle.plate.",
      ),
    );
  }

  if (
    vehicle.year !== undefined &&
    vehicle.year !== null &&
    (!Number.isInteger(vehicle.year) || vehicle.year < 1900)
  ) {
    return left(new InvalidQuoteInputError("year must be a valid integer."));
  }

  return right({
    plate,
    brand,
    model,
    color: normalizeOptionalText(vehicle.color),
    year: vehicle.year ?? null,
  });
}
