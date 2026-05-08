import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import {
  Address,
  AddressCreateInput,
} from "../../../accounts/domain/value-objects/address";
import { Email } from "../../../accounts/domain/value-objects/email";
import { Phone } from "../../../accounts/domain/value-objects/phone";
import { Customer } from "../../../customer/domain/entities/customer";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import { CustomersRepository } from "../../repositories/customers-repository";

type CreateCustomerUseCaseRequest = {
  establishmentOwnerId: string;
  cpfCnpj?: string | null;
  fullName: string;
  phone: string;
  email: string;
  address?: AddressCreateInput | null;
  birthDate?: Date | null;
  nickname?: string | null;
};

type CreateCustomerUseCaseResponse = Either<
  Error,
  {
    customer: Customer;
  }
>;

@Injectable()
export class CreateCustomerUseCase {
  constructor(
    private customersRepository: CustomersRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    cpfCnpj = null,
    fullName,
    phone,
    email,
    address = null,
    birthDate = null,
    nickname = null,
  }: CreateCustomerUseCaseRequest): Promise<CreateCustomerUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    let customer: Customer;

    try {
      customer = Customer.create({
        establishmentId: establishment.id,
        cpfCnpj,
        fullName,
        phone: Phone.create(phone),
        email: new Email(email),
        address: address ? Address.create(address) : null,
        birthDate,
        nickname,
      });
    } catch (error) {
      return left(error instanceof Error ? error : new UnexpectedDomainError());
    }

    if (customer.cpfCnpj) {
      const customerWithSameCpfCnpj =
        await this.customersRepository.findActiveByCpfCnpjAndEstablishmentId(
          customer.cpfCnpj.toString(),
          establishment.id.toString(),
        );

      if (customerWithSameCpfCnpj) {
        return left(
          new ResourceAlreadyExistsError("Customer already registered."),
        );
      }
    }

    await this.customersRepository.create(customer);

    return right({
      customer,
    });
  }
}
