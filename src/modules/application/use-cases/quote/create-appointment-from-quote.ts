import { Injectable } from "@nestjs/common";

import { Appointment } from "../../../scheduling/domain/entities/appointment";
import { Quote } from "../../../quotes/domain/entities/quote";
import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { AppointmentsRepository } from "../../repositories/appointments-repository";
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../../repositories/customers-repository";
import { QuotesRepository } from "../../repositories/quotes-repository";
import { UnitOfWork } from "../../repositories/unit-of-work";
import {
  EstablishmentScopeActor,
  EstablishmentScopeService,
} from "../../services/establishment-scope";

type CreateAppointmentFromQuoteUseCaseRequest = {
  actor: EstablishmentScopeActor;
  quoteId: string;
  startsAt: Date;
  endsAt?: Date | null;
};

type CreateAppointmentFromQuoteUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | InvalidQuoteInputError
  | UnexpectedDomainError,
  {
    appointment: Appointment;
    quote: Quote;
  }
>;

@Injectable()
export class CreateAppointmentFromQuoteUseCase {
  constructor(
    private quotesRepository: QuotesRepository,
    private appointmentsRepository: AppointmentsRepository,
    private customersRepository: CustomersRepository,
    private customerVehiclesRepository: CustomerVehiclesRepository,
    private establishmentScope: EstablishmentScopeService,
    private unitOfWork: UnitOfWork,
  ) {}

  async execute(
    request: CreateAppointmentFromQuoteUseCaseRequest,
  ): Promise<CreateAppointmentFromQuoteUseCaseResponse> {
    const scope = await this.establishmentScope.resolve(request.actor);
    if (scope.isLeft()) return left(scope.value);

    const establishmentId = scope.value.establishment.id.toString();
    const quote = await this.quotesRepository.findByIdAndEstablishmentId(
      request.quoteId,
      establishmentId,
    );
    if (!quote) return left(new ResourceNotFoundError({ resource: "quote" }));
    if (quote.convertedAppointmentId) {
      return left(new InvalidQuoteInputError("Quote is already converted."));
    }
    if (!quote.customerId) {
      return left(
        new InvalidQuoteInputError(
          "Quote must be linked to a customer before conversion.",
        ),
      );
    }

    const customer = await this.customersRepository.findByIdAndEstablishmentId(
      quote.customerId.toString(),
      establishmentId,
    );
    if (!customer || customer.isDeleted()) {
      return left(new ResourceNotFoundError({ resource: "customer" }));
    }

    if (quote.vehicleId) {
      const vehicle =
        await this.customerVehiclesRepository.findByIdAndCustomerIdAndEstablishmentId(
          quote.vehicleId.toString(),
          customer.id.toString(),
          establishmentId,
        );
      if (!vehicle || vehicle.isDeleted()) {
        return left(new ResourceNotFoundError({ resource: "vehicle" }));
      }
    }

    let appointment: Appointment;

    try {
      appointment = Appointment.create({
        establishmentId: scope.value.establishment.id,
        customerId: customer.id,
        vehicleId: quote.vehicleId,
        vehicle: quote.vehicle,
        services: quote.services.map((service) => ({
          serviceId: service.serviceId,
          serviceName: service.serviceName,
          category: service.category,
          durationInMinutes: service.durationInMinutes,
          priceInCents: service.isCourtesy ? 0 : service.priceInCents,
        })),
        startsAt: request.startsAt,
        endsAt: request.endsAt ?? null,
        description: quote.description,
        discountInCents: null,
      });
    } catch (error) {
      return left(error instanceof Error ? error : new UnexpectedDomainError());
    }

    try {
      await this.unitOfWork.execute(async () => {
        await this.appointmentsRepository.create(appointment);

        const converted = await this.quotesRepository.markAsConverted(
          quote,
          appointment.id,
          new Date(),
        );

        if (!converted) {
          throw new InvalidQuoteInputError("Quote is already converted.");
        }
      });
    } catch (error) {
      return left(error instanceof Error ? error : new UnexpectedDomainError());
    }

    return right({ appointment, quote });
  }
}
