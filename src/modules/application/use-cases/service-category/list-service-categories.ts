import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { ServiceCategory } from "../../../catalog/domain/entities/service-category";
import { ServiceCategoriesRepository } from "../../repositories/service-categories-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type ListServiceCategoriesUseCaseRequest = {
  establishmentOwnerId: string;
  includeDeleted?: boolean;
};

type ListServiceCategoriesUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    categories: ServiceCategory[];
  }
>;

@Injectable()
export class ListServiceCategoriesUseCase {
  constructor(
    private serviceCategoriesRepository: ServiceCategoriesRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    includeDeleted = false,
  }: ListServiceCategoriesUseCaseRequest): Promise<ListServiceCategoriesUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const categories =
      await this.serviceCategoriesRepository.findManyByEstablishmentId(
        establishment.id.toString(),
        { includeDeleted },
      );

    return right({ categories });
  }
}
