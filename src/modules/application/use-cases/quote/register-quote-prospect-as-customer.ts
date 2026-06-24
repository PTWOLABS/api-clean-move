import { Injectable } from "@nestjs/common";

import { Address } from "../../../accounts/domain/value-objects/address";
import { Email } from "../../../accounts/domain/value-objects/email";
import { Phone } from "../../../accounts/domain/value-objects/phone";
import { Customer } from "../../../customer/domain/entities/customer";
import { CustomerVehicle } from "../../../customer/domain/entities/customer-vehicle";
import {
  Quote,
  QuoteAddressSnapshot,
} from "../../../quotes/domain/entities/quote";
import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { CustomersRepository } from "../../repositories/customers-repository";
import { QuotesRepository } from "../../repositories/quotes-repository";
import { UnitOfWork } from "../../repositories/unit-of-work";
import {
  EstablishmentScopeActor,
  EstablishmentScopeService,
} from "../../services/establishment-scope";

type RegisterQuoteProspectAsCustomerUseCaseRequest = {
  actor: EstablishmentScopeActor;
  quoteId: string;
  email: string;
  phone?: string | null;
  birthDate?: Date | null;
  nickname?: string | null;
  createVehicleFromQuote: boolean;
};

type RegisterQuoteProspectAsCustomerUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | ResourceAlreadyExistsError
  | InvalidQuoteInputError
  | UnexpectedDomainError
  | Error,
  {
    customer: Customer;
    vehicle: CustomerVehicle | null;
    quote: Quote;
  }
>;

@Injectable()
export class RegisterQuoteProspectAsCustomerUseCase {
  constructor(
    private quotesRepository: QuotesRepository,
    private customersRepository: CustomersRepository,
    private customerVehiclesRepository: CustomerVehiclesRepository,
    private establishmentScope: EstablishmentScopeService,
    private unitOfWork: UnitOfWork,
  ) {}

  async execute(
    request: RegisterQuoteProspectAsCustomerUseCaseRequest,
  ): Promise<RegisterQuoteProspectAsCustomerUseCaseResponse> {
    const scope = await this.establishmentScope.resolve(request.actor);
    if (scope.isLeft()) return left(scope.value);

    const quote = await this.quotesRepository.findByIdAndEstablishmentId(
      request.quoteId,
      scope.value.establishment.id.toString(),
    );

    if (!quote) {
      return left(new ResourceNotFoundError({ resource: "quote" }));
    }

    if (quote.customerId) {
      return left(new InvalidQuoteInputError("Quote already has a customer."));
    }

    let customer: Customer;
    let vehicle: CustomerVehicle | null = null;

    try {
      const phoneValue = request.phone ?? quote.customer.phone ?? null;

      customer = Customer.create({
        establishmentId: scope.value.establishment.id,
        cpfCnpj: quote.customer.cpfCnpj,
        fullName: quote.customer.name,
        phone:
          phoneValue !== null && phoneValue.trim()
            ? Phone.create(phoneValue)
            : null,
        email: new Email(request.email),
        address: toAddress(quote.customer.address),
        birthDate: request.birthDate ?? null,
        nickname: request.nickname ?? null,
      });

      if (request.createVehicleFromQuote) {
        if (!quote.vehicle) {
          return left(
            new InvalidQuoteInputError("Quote has no vehicle snapshot."),
          );
        }

        if (!quote.vehicle.brand?.trim() || !quote.vehicle.model?.trim()) {
          return left(
            new InvalidQuoteInputError(
              "Quote vehicle snapshot must include brand and model.",
            ),
          );
        }

        vehicle = CustomerVehicle.create({
          establishmentId: scope.value.establishment.id,
          customerId: customer.id,
          imageUrl: null,
          plate: quote.vehicle.plate,
          brand: quote.vehicle.brand,
          model: quote.vehicle.model,
          color: quote.vehicle.color,
          year: quote.vehicle.year,
          notes: null,
        });
      }
    } catch (error) {
      return left(error instanceof Error ? error : new UnexpectedDomainError());
    }

    if (customer.cpfCnpj) {
      const conflict =
        await this.customersRepository.findActiveByCpfCnpjAndEstablishmentId(
          customer.cpfCnpj.toString(),
          scope.value.establishment.id.toString(),
        );

      if (conflict) {
        return left(
          new ResourceAlreadyExistsError("Customer already registered."),
        );
      }
    }

    await this.unitOfWork.execute(async () => {
      await this.customersRepository.create(customer);

      if (vehicle) {
        await this.customerVehiclesRepository.create(vehicle);
      }

      quote.linkCustomer(customer.id, vehicle?.id ?? null);
      await this.quotesRepository.save(quote);
    });

    return right({ customer, vehicle, quote });
  }
}

function toAddress(address: QuoteAddressSnapshot): Address | null {
  if (!address) {
    return null;
  }

  if (
    !address.street ||
    !address.country ||
    !address.state ||
    !address.zipCode ||
    !address.city
  ) {
    throw new InvalidQuoteInputError("Quote customer address is incomplete.");
  }

  return Address.create({
    street: address.street,
    country: address.country,
    state: address.state,
    zipCode: address.zipCode,
    city: address.city,
    complement: address.complement,
  });
}
