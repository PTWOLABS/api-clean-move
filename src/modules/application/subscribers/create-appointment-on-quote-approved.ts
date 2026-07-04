import { Injectable, OnModuleDestroy } from "@nestjs/common";

import { DomainEvents } from "../../../shared/events/domain-events";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UniqueEntityId } from "../../../shared/entities/unique-entity-id";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { Service } from "../../catalog/domain/entities/services";
import { ServiceName } from "../../catalog/domain/value-objects/service-name";
import { ServicePriceSpecification } from "../../catalog/domain/value-objects/service-price-specification";
import { QuoteApprovedEvent } from "../../quotes/domain/events/quote-approved-event";
import { InvalidQuoteInputError } from "../../quotes/domain/errors/invalid-quote-input-error";
import { QuotedServiceSnapshot } from "../../quotes/domain/entities/quote";
import {
  Appointment,
  AppointmentServiceSnapshot,
} from "../../scheduling/domain/entities/appointment";
import { AppointmentsRepository } from "../repositories/appointments-repository";
import { CustomerVehiclesRepository } from "../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../repositories/customers-repository";
import { QuotesRepository } from "../repositories/quotes-repository";
import { ServicesRepository } from "../repositories/services-repository";

@Injectable()
export class CreateAppointmentOnQuoteApproved implements OnModuleDestroy {
  constructor(
    private quotesRepository: QuotesRepository,
    private appointmentsRepository: AppointmentsRepository,
    private customersRepository: CustomersRepository,
    private customerVehiclesRepository: CustomerVehiclesRepository,
    private servicesRepository: ServicesRepository,
  ) {
    this.setupSubscriptions();
  }

  private setupSubscriptions() {
    DomainEvents.register(this.createAppointment, QuoteApprovedEvent.name);
  }

  onModuleDestroy() {
    DomainEvents.unregister(this.createAppointment, QuoteApprovedEvent.name);
  }

  private createAppointment = async (event: QuoteApprovedEvent) => {
    const establishmentId = event.establishmentId.toString();
    const quote = await this.quotesRepository.findByIdAndEstablishmentId(
      event.quoteId.toString(),
      establishmentId,
    );

    if (!quote) {
      throw new ResourceNotFoundError({ resource: "quote" });
    }

    if (quote.convertedAppointmentId) {
      throw new InvalidQuoteInputError("Quote is already converted.");
    }

    if (!quote.customerId) {
      throw new InvalidQuoteInputError(
        "Quote must be linked to a customer before conversion.",
      );
    }

    const customer = await this.customersRepository.findByIdAndEstablishmentId(
      quote.customerId.toString(),
      establishmentId,
    );

    if (!customer || customer.isDeleted()) {
      throw new ResourceNotFoundError({ resource: "customer" });
    }

    if (quote.vehicleId) {
      const vehicle =
        await this.customerVehiclesRepository.findByIdAndCustomerIdAndEstablishmentId(
          quote.vehicleId.toString(),
          customer.id.toString(),
          establishmentId,
        );

      if (!vehicle || vehicle.isDeleted()) {
        throw new ResourceNotFoundError({ resource: "vehicle" });
      }
    }

    const services = await this.resolveAppointmentServices(
      quote.services,
      event.establishmentId,
      establishmentId,
    );

    let appointment: Appointment;

    try {
      appointment = Appointment.create({
        establishmentId: event.establishmentId,
        customerId: customer.id,
        customer: {
          fullName: customer.fullName,
        },
        vehicleId: quote.vehicleId,
        vehicle: quote.vehicle,
        services,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        description: quote.description,
        discountInCents: null,
      });
    } catch (error) {
      throw error instanceof Error ? error : new UnexpectedDomainError();
    }

    await this.appointmentsRepository.create(appointment);

    const converted = await this.quotesRepository.markAsConverted(
      quote,
      appointment.id,
      event.occurredAt,
    );

    if (!converted) {
      throw new InvalidQuoteInputError("Quote is already converted.");
    }
  };

  private async resolveAppointmentServices(
    quoteServices: QuotedServiceSnapshot[],
    establishmentId: UniqueEntityId,
    establishmentIdText: string,
  ): Promise<AppointmentServiceSnapshot[]> {
    const services: AppointmentServiceSnapshot[] = [];

    for (const quoteService of quoteServices) {
      const serviceId =
        quoteService.serviceId ??
        (await this.createCatalogServiceFromQuoteService(
          quoteService,
          establishmentId,
          establishmentIdText,
        ));

      services.push({
        serviceId,
        serviceName: quoteService.serviceName,
        category: quoteService.category,
        durationInMinutes: quoteService.durationInMinutes,
        priceInCents: quoteService.isCourtesy ? 0 : quoteService.priceInCents,
      });
    }

    return services;
  }

  private async createCatalogServiceFromQuoteService(
    quoteService: QuotedServiceSnapshot,
    establishmentId: UniqueEntityId,
    establishmentIdText: string,
  ) {
    const existingService =
      await this.servicesRepository.findActiveByNameAndEstablishmentId(
        quoteService.serviceName,
        establishmentIdText,
      );

    if (existingService) {
      throw new InvalidQuoteInputError(
        "A service with this name already exists. Select the existing service or use another name.",
      );
    }

    const service = Service.create({
      establishmentId,
      serviceName: ServiceName.create(quoteService.serviceName),
      priceSpecification: ServicePriceSpecification.create({
        type: "FIXED",
        fixedPriceInCents: quoteService.priceInCents,
      }),
      isActive: true,
    });

    await this.servicesRepository.create(service);

    return service.id;
  }
}
