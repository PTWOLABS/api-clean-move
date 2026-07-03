import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { Customer } from "../../../customer/domain/entities/customer";
import { CustomersRepository } from "../../repositories/customers-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type GetCustomerUseCaseRequest = {
  establishmentOwnerId: string;
  customerId: string;
};

type GetCustomerUseCaseResponse = Either<
  ResourceNotFoundError,
  { customer: Customer }
>;

@Injectable()
export class GetCustomerUseCase {
  constructor(
    private customersRepository: CustomersRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    customerId,
  }: GetCustomerUseCaseRequest): Promise<GetCustomerUseCaseResponse> {
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

    return right({ customer });
  }
}
