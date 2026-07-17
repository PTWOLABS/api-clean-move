import { Injectable } from "@nestjs/common";

import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { Appointment } from "../../../scheduling/domain/entities/appointment";
import { Quote } from "../../../quotes/domain/entities/quote";
import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import { AppointmentsRepository } from "../../repositories/appointments-repository";
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../../repositories/customers-repository";

type QuoteToAppointmentConverterInput = {
  quote: Quote;
  startsAt: Date;
  endsAt?: Date | null;
};

@Injectable()
export class QuoteToAppointmentConverter {
  constructor(
    private readonly appointmentsRepository: AppointmentsRepository,
    private readonly customersRepository: CustomersRepository,
    private readonly customerVehiclesRepository: CustomerVehiclesRepository,
  ) {}

  async convert({
    quote,
    startsAt,
    endsAt = null,
  }: QuoteToAppointmentConverterInput) {
    if (!quote.customerId) {
      throw new InvalidQuoteInputError(
        "Quote must be linked to a customer before conversion.",
        "QUOTE_CANNOT_BE_APPROVED_FOR_PROSPECT",
      );
    }

    const customer =
      await this.customersRepository.findByIdAndEstablishmentIdIncludingDeleted(
        quote.customerId.toString(),
        quote.establishmentId.toString(),
      );

    if (!customer || customer.isDeleted()) {
      throw new ResourceNotFoundError({ resource: "customer" });
    }

    if (quote.vehicleId) {
      const vehicle =
        await this.customerVehiclesRepository.findByIdAndEstablishmentIdIncludingDeleted(
          quote.vehicleId.toString(),
          quote.establishmentId.toString(),
        );

      if (
        !vehicle ||
        vehicle.isDeleted() ||
        vehicle.customerId.toString() !== customer.id.toString()
      ) {
        throw new ResourceNotFoundError({ resource: "vehicle" });
      }
    }

    const services = quote.services.map((service) => {
      if (!service.serviceId) {
        throw new InvalidQuoteInputError(
          "Quote services must be linked before conversion.",
          "QUOTE_SERVICE_ITEM_NOT_FOUND",
        );
      }

      return {
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        category: service.category,
        durationInMinutes: service.durationInMinutes,
        priceInCents: service.isCourtesy ? 0 : service.priceInCents,
      };
    });

    const appointment = Appointment.create({
      establishmentId: quote.establishmentId,
      customerId: customer.id,
      customer: {
        fullName: quote.customer.name,
      },
      vehicleId: quote.vehicleId,
      vehicle: quote.vehicle,
      services,
      startsAt,
      endsAt,
      description: quote.description,
      discountInCents: null,
    });

    await this.appointmentsRepository.create(appointment);

    return appointment;
  }
}
