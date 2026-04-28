import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { Customer } from "../../../customer/domain/entities/customer";
import { CustomersRepository } from "../../repositories/customers-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type ListCustomersUseCaseRequest = {
  establishmentOwnerId: string;
  search?: string;
  page?: number;
  size?: number;
};

type ListCustomersUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    customers: Customer[];
  }
>;

@Injectable()
export class ListCustomersUseCase {
  constructor(
    private customersRepository: CustomersRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    search,
    page,
    size,
  }: ListCustomersUseCaseRequest): Promise<ListCustomersUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const customers = await this.customersRepository.findManyByEstablishmentId(
      establishment.id.toString(),
      {
        ...(search !== undefined ? { search } : {}),
        ...(page !== undefined ? { page } : {}),
        ...(size !== undefined ? { size } : {}),
      },
    );

    return right({
      customers,
    });
  }
}
