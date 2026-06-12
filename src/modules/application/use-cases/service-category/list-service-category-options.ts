import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import {
  ServiceCategoriesRepository,
  ServiceCategoryOption,
} from "../../repositories/service-categories-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type ListServiceCategoryOptionsUseCaseRequest = {
  establishmentOwnerId: string;
  search?: string;
  limit?: number;
};

type ListServiceCategoryOptionsUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    categories: ServiceCategoryOption[];
  }
>;

@Injectable()
export class ListServiceCategoryOptionsUseCase {
  constructor(
    private serviceCategoriesRepository: ServiceCategoriesRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    search,
    limit,
  }: ListServiceCategoryOptionsUseCaseRequest): Promise<ListServiceCategoryOptionsUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const categories =
      await this.serviceCategoriesRepository.findOptionsByEstablishmentId(
        establishment.id.toString(),
        {
          ...(search !== undefined ? { search } : {}),
          ...(limit !== undefined ? { limit } : {}),
        },
      );

    return right({ categories });
  }
}
