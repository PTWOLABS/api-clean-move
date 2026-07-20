import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import {
  CustomerOption,
  CustomersRepository,
} from "../../repositories/customers-repository";
import {
  EstablishmentScopeActor,
  EstablishmentScopeService,
} from "../../services/establishment-scope";

type ListCustomerOptionsUseCaseRequest = {
  actor: EstablishmentScopeActor;
  search?: string;
  size?: number;
};

type ListCustomerOptionsUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  {
    customers: CustomerOption[];
    totalItems: number;
  }
>;

@Injectable()
export class ListCustomerOptionsUseCase {
  constructor(
    private customersRepository: CustomersRepository,
    private establishmentScope: EstablishmentScopeService,
  ) {}

  async execute({
    actor,
    search,
    size,
  }: ListCustomerOptionsUseCaseRequest): Promise<ListCustomerOptionsUseCaseResponse> {
    const scopeResult = await this.establishmentScope.resolve(actor);

    if (scopeResult.isLeft()) {
      return left(scopeResult.value);
    }

    const { establishment } = scopeResult.value;

    const { customers, totalItems } =
      await this.customersRepository.findOptionsByEstablishmentId(
        establishment.id.toString(),
        {
          ...(search !== undefined ? { search } : {}),
          ...(size !== undefined ? { size } : {}),
        },
      );

    return right({
      customers,
      totalItems,
    });
  }
}
