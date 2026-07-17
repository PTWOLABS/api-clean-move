import { AggregateRoot } from "../../../../shared/entities/aggregate-root";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Optional } from "../../../../shared/types/optional";
import { InvalidQuoteInputError } from "../errors/invalid-quote-input-error";
import { QuoteConvertedEvent } from "../events/quote-converted-event";
import {
  QuotePaymentOption,
  QuotePaymentOptionInput,
} from "../value-objects/quote-payment-option";
import {
  QuotedServiceSnapshot,
  QuoteServiceSnapshotInput,
} from "../value-objects/quoted-service-snapshot";

export type {
  QuoteDiscountType,
  QuotePaymentMethod,
  QuotePaymentOptionInput,
  QuotePaymentOptionProps,
} from "../value-objects/quote-payment-option";

export type {
  QuoteServiceSnapshot,
  QuoteServiceSnapshotInput,
} from "../value-objects/quoted-service-snapshot";

export { QuotePaymentOption, QuotedServiceSnapshot };

export type QuoteAddressSnapshot = {
  street: string | null;
  country: string | null;
  state: string | null;
  zipCode: string | null;
  city: string | null;
  complement: string | null;
} | null;

export type QuoteEstablishmentSnapshot = {
  name: string;
  legalBusinessName: string;
  cnpj: string;
  address: QuoteAddressSnapshot;
  bannerImageUrl: string | null;
};

export type QuoteCustomerSnapshot = {
  name: string;
  phone: string | null;
  email: string | null;
  cpfCnpj: string | null;
  address: QuoteAddressSnapshot;
};

export type QuoteVehicleSnapshot = {
  plate: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
} | null;

export type QuoteProps = {
  establishmentId: UniqueEntityId;
  customerId: UniqueEntityId | null;
  vehicleId: UniqueEntityId | null;
  convertedAppointmentId: UniqueEntityId | null;
  convertedAt: Date | null;
  establishment: QuoteEstablishmentSnapshot;
  customer: QuoteCustomerSnapshot;
  vehicle: QuoteVehicleSnapshot;
  services: QuotedServiceSnapshot[];
  paymentOptions: QuotePaymentOption[];
  description: string | null;
  termsAndConditions: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type QuoteCreateProps = Optional<
  Omit<QuoteProps, "services" | "paymentOptions"> & {
    services: QuoteServiceSnapshotInput[];
    paymentOptions: QuotePaymentOptionInput[];
  },
  | "convertedAppointmentId"
  | "convertedAt"
  | "expiresAt"
  | "createdAt"
  | "updatedAt"
>;

export class Quote extends AggregateRoot<QuoteProps> {
  get establishmentId() {
    return this.props.establishmentId;
  }

  get customerId() {
    return this.props.customerId;
  }

  get vehicleId() {
    return this.props.vehicleId;
  }

  get convertedAppointmentId() {
    return this.props.convertedAppointmentId;
  }

  get convertedAt() {
    return this.props.convertedAt;
  }

  get establishment() {
    return Quote.cloneEstablishment(this.props.establishment);
  }

  get customer() {
    return Quote.cloneCustomer(this.props.customer);
  }

  get vehicle() {
    return Quote.cloneVehicle(this.props.vehicle);
  }

  get services() {
    return [...this.props.services];
  }

  get paymentOptions() {
    return [...this.props.paymentOptions];
  }

  get description() {
    return this.props.description;
  }

  get termsAndConditions() {
    return this.props.termsAndConditions;
  }

  get expiresAt() {
    return this.props.expiresAt;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }

  get subtotalInCents() {
    return Quote.subtotalInCents(this.props.services);
  }

  get totalCourtesyValueInCents() {
    return Quote.totalCourtesyValueInCents(this.props.services);
  }

  static create(props: QuoteCreateProps, id?: UniqueEntityId) {
    const services = props.services.map((service) =>
      QuotedServiceSnapshot.create(service),
    );
    const subtotalInCents = Quote.subtotalInCents(services);

    const quote = new Quote(
      {
        ...props,
        convertedAppointmentId: props.convertedAppointmentId ?? null,
        convertedAt: props.convertedAt ?? null,
        establishment: Quote.normalizeEstablishment(props.establishment),
        customer: Quote.normalizeCustomer(props.customer),
        vehicle: Quote.normalizeVehicle(props.vehicle),
        services,
        paymentOptions: props.paymentOptions.map((paymentOption) =>
          QuotePaymentOption.create(paymentOption, subtotalInCents),
        ),
        description: Quote.normalizeOptionalText(props.description),
        termsAndConditions: Quote.normalizeOptionalText(
          props.termsAndConditions,
        ),
        expiresAt: props.expiresAt ?? null,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id,
    );

    quote.assertValidState();

    return quote;
  }

  static subtotalInCents(services: QuotedServiceSnapshot[]) {
    return services.reduce((total, service) => {
      return total + service.effectivePriceInCents;
    }, 0);
  }

  static totalCourtesyValueInCents(services: QuotedServiceSnapshot[]) {
    return services.reduce((total, service) => {
      return total + service.courtesyValueInCents;
    }, 0);
  }

  markAsConverted(
    appointmentId: UniqueEntityId,
    referenceDate: Date = new Date(),
  ) {
    this.assertValidDate(referenceDate, "referenceDate must be a valid date.");

    if (this.props.convertedAppointmentId || this.props.convertedAt) {
      throw new InvalidQuoteInputError(
        "Quote is already converted.",
        "QUOTE_ALREADY_CONVERTED",
      );
    }

    this.props.convertedAppointmentId = appointmentId;
    this.props.convertedAt = referenceDate;
    this.touch(referenceDate);
    this.addDomainEvent(
      new QuoteConvertedEvent(this, appointmentId, referenceDate),
    );
  }

  associateService(
    quoteServiceId: UniqueEntityId,
    serviceId: UniqueEntityId,
    referenceDate: Date = new Date(),
  ): void {
    this.assertValidDate(referenceDate, "referenceDate must be a valid date.");
    this.assertNotConverted();

    const serviceIndex = this.findServiceIndex(quoteServiceId);
    const services = [...this.props.services];
    services[serviceIndex] = services[serviceIndex]!.withServiceId(serviceId);
    this.assertValidServices(services);

    this.props.services = services;
    this.touch(referenceDate);
  }

  renameDetachedService(
    quoteServiceId: UniqueEntityId,
    serviceName: string,
    referenceDate: Date = new Date(),
  ): void {
    this.assertValidDate(referenceDate, "referenceDate must be a valid date.");
    this.assertNotConverted();

    const serviceIndex = this.findServiceIndex(quoteServiceId);
    const currentService = this.props.services[serviceIndex]!;

    if (currentService.serviceId) {
      throw new InvalidQuoteInputError(
        "Only detached quote services can be renamed.",
      );
    }

    const services = [...this.props.services];
    services[serviceIndex] = currentService.withServiceName(serviceName);
    this.assertValidServices(services);

    this.props.services = services;
    this.touch(referenceDate);
  }

  resolveCustomerReferences(
    customerId: UniqueEntityId,
    vehicleId: UniqueEntityId | null,
    referenceDate: Date = new Date(),
  ): void {
    this.assertValidDate(referenceDate, "referenceDate must be a valid date.");
    this.assertNotConverted();

    this.props.customerId = customerId;
    this.props.vehicleId = vehicleId;
    this.touch(referenceDate);
  }

  linkCustomer(customerId: UniqueEntityId, vehicleId: UniqueEntityId | null) {
    this.assertNotConverted();

    if (this.props.customerId) {
      throw new InvalidQuoteInputError(
        "Quote already has a customer.",
        "QUOTE_ALREADY_HAS_CUSTOMER",
      );
    }

    this.props.customerId = customerId;
    this.props.vehicleId = vehicleId;
    this.touch();
  }

  private touch(referenceDate: Date = new Date()) {
    this.props.updatedAt = referenceDate;
  }

  private assertValidState() {
    this.assertNullableDate(
      this.props.expiresAt,
      "expiresAt must be a valid date.",
    );
    this.assertValidDate(
      this.props.createdAt,
      "createdAt must be a valid date.",
    );
    this.assertValidDate(
      this.props.updatedAt,
      "updatedAt must be a valid date.",
    );
    this.assertNullableDate(
      this.props.convertedAt,
      "convertedAt must be a valid date.",
    );

    if (
      (this.props.convertedAppointmentId && !this.props.convertedAt) ||
      (!this.props.convertedAppointmentId && this.props.convertedAt)
    ) {
      throw new InvalidQuoteInputError(
        "Converted appointment id and converted date must be provided together.",
      );
    }

    this.assertValidServices(this.props.services);

    if (this.props.paymentOptions.length === 0) {
      throw new InvalidQuoteInputError(
        "At least one payment option is required.",
      );
    }
  }

  private assertValidServices(services: QuotedServiceSnapshot[]) {
    if (services.length === 0) {
      throw new InvalidQuoteInputError("At least one service is required.");
    }

    const quoteServiceIds = new Set<string>();
    const serviceIds = new Set<string>();
    const detachedServiceNames = new Set<string>();

    for (const service of services) {
      const quoteServiceId = service.quoteServiceId.toString();

      if (quoteServiceIds.has(quoteServiceId)) {
        throw new InvalidQuoteInputError(
          "Duplicate quote service item ids are not allowed.",
        );
      }

      quoteServiceIds.add(quoteServiceId);

      const serviceId = service.serviceId?.toString();

      if (serviceId && serviceIds.has(serviceId)) {
        throw new InvalidQuoteInputError(
          "Duplicate services are not allowed in the same quote.",
          "QUOTE_DUPLICATE_SERVICE_RESOLUTION",
        );
      }

      if (serviceId) {
        serviceIds.add(serviceId);
        continue;
      }

      const serviceName = service.serviceName.trim().toLowerCase();

      if (detachedServiceNames.has(serviceName)) {
        throw new InvalidQuoteInputError(
          "Duplicate detached services are not allowed in the same quote.",
          "QUOTE_SERVICE_NAME_UNAVAILABLE",
        );
      }

      detachedServiceNames.add(serviceName);
    }
  }

  private findServiceIndex(quoteServiceId: UniqueEntityId) {
    const serviceIndex = this.props.services.findIndex((service) =>
      service.quoteServiceId.equals(quoteServiceId),
    );

    if (serviceIndex === -1) {
      throw new InvalidQuoteInputError(
        "Quote service item was not found.",
        "QUOTE_SERVICE_ITEM_NOT_FOUND",
      );
    }

    return serviceIndex;
  }

  private assertNotConverted() {
    if (this.props.convertedAppointmentId || this.props.convertedAt) {
      throw new InvalidQuoteInputError(
        "Quote is already converted.",
        "QUOTE_ALREADY_CONVERTED",
      );
    }
  }

  private assertValidDate(value: Date, message: string) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new InvalidQuoteInputError(message);
    }
  }

  private assertNullableDate(value: Date | null, message: string) {
    if (value === null) {
      return;
    }

    this.assertValidDate(value, message);
  }

  private static normalizeEstablishment(
    establishment: QuoteEstablishmentSnapshot,
  ): QuoteEstablishmentSnapshot {
    return {
      name: Quote.normalizeRequiredText(
        establishment.name,
        "establishment.name is required.",
      ),
      legalBusinessName: Quote.normalizeRequiredText(
        establishment.legalBusinessName,
        "establishment.legalBusinessName is required.",
      ),
      cnpj: Quote.normalizeRequiredText(
        establishment.cnpj,
        "establishment.cnpj is required.",
      ),
      address: Quote.normalizeAddress(establishment.address),
      bannerImageUrl: Quote.normalizeOptionalText(establishment.bannerImageUrl),
    };
  }

  private static normalizeCustomer(
    customer: QuoteCustomerSnapshot,
  ): QuoteCustomerSnapshot {
    return {
      name: Quote.normalizeRequiredText(
        customer.name,
        "customer.name is required.",
      ),
      phone: Quote.normalizeOptionalText(customer.phone),
      email: Quote.normalizeOptionalText(customer.email),
      cpfCnpj: Quote.normalizeOptionalText(customer.cpfCnpj),
      address: Quote.normalizeAddress(customer.address),
    };
  }

  private static normalizeVehicle(
    vehicle: QuoteVehicleSnapshot,
  ): QuoteVehicleSnapshot {
    if (vehicle === null) {
      return null;
    }

    return {
      plate: Quote.normalizeOptionalText(vehicle.plate),
      brand: Quote.normalizeOptionalText(vehicle.brand),
      model: Quote.normalizeOptionalText(vehicle.model),
      color: Quote.normalizeOptionalText(vehicle.color),
      year: vehicle.year,
    };
  }

  private static normalizeAddress(
    address: QuoteAddressSnapshot,
  ): QuoteAddressSnapshot {
    if (address === null) {
      return null;
    }

    return {
      street: Quote.normalizeOptionalText(address.street),
      country: Quote.normalizeOptionalText(address.country),
      state: Quote.normalizeOptionalText(address.state),
      zipCode: Quote.normalizeOptionalText(address.zipCode),
      city: Quote.normalizeOptionalText(address.city),
      complement: Quote.normalizeOptionalText(address.complement),
    };
  }

  private static cloneEstablishment(
    establishment: QuoteEstablishmentSnapshot,
  ): QuoteEstablishmentSnapshot {
    return {
      ...establishment,
      address: Quote.cloneAddress(establishment.address),
    };
  }

  private static cloneCustomer(
    customer: QuoteCustomerSnapshot,
  ): QuoteCustomerSnapshot {
    return {
      ...customer,
      address: Quote.cloneAddress(customer.address),
    };
  }

  private static cloneVehicle(vehicle: QuoteVehicleSnapshot) {
    if (vehicle === null) {
      return null;
    }

    return { ...vehicle };
  }

  private static cloneAddress(address: QuoteAddressSnapshot) {
    if (address === null) {
      return null;
    }

    return { ...address };
  }

  private static normalizeRequiredText(value: string, message: string) {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new InvalidQuoteInputError(message);
    }

    return normalizedValue;
  }

  private static normalizeOptionalText(value: string | null | undefined) {
    const normalizedValue = value?.trim();

    if (!normalizedValue) {
      return null;
    }

    return normalizedValue;
  }
}
