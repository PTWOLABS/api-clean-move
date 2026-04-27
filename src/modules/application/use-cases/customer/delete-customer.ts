import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { Customer } from "../../../customer/domain/entities/customer";
import { CustomersRepository } from "../../repositories/customers-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type DeleteCustomerUseCaseRequest = {
  establishmentOwnerId: string;
  customerId: string;
};

type DeleteCustomerUseCaseResponse = Either<
  Error,
  {
    customer: Customer;
  }
>;

@Injectable()
export class DeleteCustomerUseCase {
  constructor(
    private customersRepository: CustomersRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    customerId,
  }: DeleteCustomerUseCaseRequest): Promise<DeleteCustomerUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const customer =
      await this.customersRepository.findByIdAndEstablishmentId(
        customerId,
        establishment.id.toString(),
      );

    if (!customer || customer.isDeleted()) {
      return left(new ResourceNotFoundError({ resource: "customer" }));
    }

    try {
      customer.softDelete();
    } catch (error) {
      return left(error instanceof Error ? error : new UnexpectedDomainError());
    }

    await this.customersRepository.save(customer);

    return right({
      customer,
    });
  }
}
