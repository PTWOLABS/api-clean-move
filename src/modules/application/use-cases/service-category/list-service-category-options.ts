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
  size?: number;
};

type ListServiceCategoryOptionsUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    categories: ServiceCategoryOption[];
    totalItems: number;
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
    size,
  }: ListServiceCategoryOptionsUseCaseRequest): Promise<ListServiceCategoryOptionsUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const { categories, totalItems } =
      await this.serviceCategoriesRepository.findOptionsByEstablishmentId(
        establishment.id.toString(),
        {
          ...(search !== undefined ? { search } : {}),
          ...(size !== undefined ? { size } : {}),
        },
      );

    return right({ categories, totalItems });
  }
}
