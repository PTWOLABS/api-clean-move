import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { InactiveServiceError } from "../../../catalog/domain/errors/inactive-service-error";
import { Customer } from "../../../customer/domain/entities/customer";
import {
  Quote,
  QuoteAddressSnapshot,
  QuoteCustomerSnapshot,
  QuotePaymentOptionInput,
} from "../../../quotes/domain/entities/quote";
import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import { CustomersRepository } from "../../repositories/customers-repository";
import { QuotesRepository } from "../../repositories/quotes-repository";
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

@Injectable()
export class UpdateQuoteUseCase {
  constructor(
    private quotesRepository: QuotesRepository,
    private customersRepository: CustomersRepository,
    private establishmentScope: EstablishmentScopeService,
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

    try {
      quote.update({
        ...(customerResult.value.customerId !== quote.customerId ||
        request.customerId !== undefined
          ? { customerId: customerResult.value.customerId }
          : {}),
        ...(request.customer !== undefined || request.customerId !== undefined
          ? { customer: customerResult.value.customer }
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
