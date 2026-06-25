import { Injectable, OnModuleDestroy } from "@nestjs/common";

import { DomainEvents } from "../../../shared/events/domain-events";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../shared/errors/unexpected-domain-error";
import { QuoteApprovedEvent } from "../../quotes/domain/events/quote-approved-event";
import { InvalidQuoteInputError } from "../../quotes/domain/errors/invalid-quote-input-error";
import { Appointment } from "../../scheduling/domain/entities/appointment";
import { AppointmentsRepository } from "../repositories/appointments-repository";
import { CustomerVehiclesRepository } from "../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../repositories/customers-repository";
import { QuotesRepository } from "../repositories/quotes-repository";

@Injectable()
export class CreateAppointmentOnQuoteApproved implements OnModuleDestroy {
  constructor(
    private quotesRepository: QuotesRepository,
    private appointmentsRepository: AppointmentsRepository,
    private customersRepository: CustomersRepository,
    private customerVehiclesRepository: CustomerVehiclesRepository,
  ) {
    this.setupSubscriptions();
  }

  private setupSubscriptions() {
    DomainEvents.register(
      this.createAppointment,
      QuoteApprovedEvent.name,
    );
  }

  onModuleDestroy() {
    DomainEvents.unregister(
      this.createAppointment,
      QuoteApprovedEvent.name,
    );
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
        services: quote.services.map((service) => ({
          serviceId: service.serviceId,
          serviceName: service.serviceName,
          category: service.category,
          durationInMinutes: service.durationInMinutes,
          priceInCents: service.isCourtesy ? 0 : service.priceInCents,
        })),
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
}
