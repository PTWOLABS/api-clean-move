import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import {
  ServiceOption,
  ServicesRepository,
} from "../../repositories/services-repository";
import {
  EstablishmentScopeActor,
  EstablishmentScopeService,
} from "../../services/establishment-scope";

type ListServiceOptionsUseCaseRequest = {
  actor: EstablishmentScopeActor;
  search?: string;
  size?: number;
};

type ListServiceOptionsUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  {
    services: ServiceOption[];
    totalItems: number;
  }
>;

@Injectable()
export class ListServiceOptionsUseCase {
  constructor(
    private servicesRepository: ServicesRepository,
    private establishmentScope: EstablishmentScopeService,
  ) {}

  async execute({
    actor,
    search,
    size,
  }: ListServiceOptionsUseCaseRequest): Promise<ListServiceOptionsUseCaseResponse> {
    const scopeResult = await this.establishmentScope.resolve(actor);

    if (scopeResult.isLeft()) {
      return left(scopeResult.value);
    }

    const { establishment } = scopeResult.value;

    const { services, totalItems } =
      await this.servicesRepository.findOptionsByEstablishmentId(
        establishment.id.toString(),
        {
          ...(search !== undefined ? { search } : {}),
          ...(size !== undefined ? { size } : {}),
        },
      );

    return right({
      services,
      totalItems,
    });
  }
}
