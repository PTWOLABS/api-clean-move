import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import {
  Address,
  AddressProps,
} from "../../../accounts/domain/value-objects/address";
import { Email } from "../../../accounts/domain/value-objects/email";
import { Phone } from "../../../accounts/domain/value-objects/phone";
import { Customer } from "../../../customer/domain/entities/customer";
import { CustomerDocument } from "../../../customer/domain/value-objects/customer-document";
import { CustomersRepository } from "../../repositories/customers-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type UpdateCustomerUseCaseRequest = {
  establishmentOwnerId: string;
  customerId: string;
  cpfCnpj?: string | null;
  fullName?: string;
  phone?: string;
  email?: string;
  address?: AddressProps | null;
  birthDate?: Date | null;
  nickname?: string | null;
};

type UpdateCustomerUseCaseResponse = Either<
  Error,
  {
    customer: Customer;
  }
>;

@Injectable()
export class UpdateCustomerUseCase {
  constructor(
    private customersRepository: CustomersRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    customerId,
    cpfCnpj,
    fullName,
    phone,
    email,
    address,
    birthDate,
    nickname,
  }: UpdateCustomerUseCaseRequest): Promise<UpdateCustomerUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const customer = await this.customersRepository.findByIdAndEstablishmentId(
      customerId,
      establishment.id.toString(),
    );

    if (!customer || customer.isDeleted()) {
      return left(new ResourceNotFoundError({ resource: "customer" }));
    }

    if (cpfCnpj !== undefined && cpfCnpj !== null && cpfCnpj.trim()) {
      let normalizedDocument: string;

      try {
        normalizedDocument = CustomerDocument.create(cpfCnpj).toString();
      } catch (error) {
        return left(
          error instanceof Error ? error : new UnexpectedDomainError(),
        );
      }

      const customerWithSameCpfCnpj =
        await this.customersRepository.findActiveByCpfCnpjAndEstablishmentId(
          normalizedDocument,
          establishment.id.toString(),
        );

      if (
        customerWithSameCpfCnpj &&
        !customerWithSameCpfCnpj.id.equals(customer.id)
      ) {
        return left(
          new ResourceAlreadyExistsError("Customer already registered."),
        );
      }
    }

    try {
      customer.update({
        ...(cpfCnpj !== undefined ? { cpfCnpj } : {}),
        ...(fullName !== undefined ? { fullName } : {}),
        ...(phone !== undefined ? { phone: Phone.create(phone) } : {}),
        ...(email !== undefined ? { email: new Email(email) } : {}),
        ...(address !== undefined
          ? { address: address ? Address.create(address) : null }
          : {}),
        ...(birthDate !== undefined ? { birthDate } : {}),
        ...(nickname !== undefined ? { nickname } : {}),
      });
    } catch (error) {
      return left(error instanceof Error ? error : new UnexpectedDomainError());
    }

    await this.customersRepository.save(customer);

    return right({
      customer,
    });
  }
}
