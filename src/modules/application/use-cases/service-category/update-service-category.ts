import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { ServiceCategory } from "../../../catalog/domain/entities/service-category";
import {
  CategoryName,
  InvalidCategoryNameError,
} from "../../../catalog/domain/value-objects/category-name";
import { ServiceCategoriesRepository } from "../../repositories/service-categories-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import { InvalidServiceCategoryInputError } from "./create-service-category";

type UpdateServiceCategoryUseCaseRequest = {
  establishmentOwnerId: string;
  categoryId: string;
  name: string;
};

type UpdateServiceCategoryUseCaseResponse = Either<
  | ResourceNotFoundError
  | ResourceAlreadyExistsError
  | InvalidServiceCategoryInputError
  | UnexpectedDomainError,
  {
    category: ServiceCategory;
  }
>;

@Injectable()
export class UpdateServiceCategoryUseCase {
  constructor(
    private serviceCategoriesRepository: ServiceCategoriesRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    categoryId,
    name,
  }: UpdateServiceCategoryUseCaseRequest): Promise<UpdateServiceCategoryUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const category =
      await this.serviceCategoriesRepository.findByIdAndEstablishmentId(
        categoryId,
        establishment.id.toString(),
      );

    if (!category || category.isDeleted()) {
      return left(new ResourceNotFoundError({ resource: "service category" }));
    }

    let categoryName: CategoryName;

    try {
      categoryName = CategoryName.create(name);
    } catch (error) {
      if (error instanceof InvalidCategoryNameError) {
        return left(new InvalidServiceCategoryInputError(error.message));
      }

      return left(new UnexpectedDomainError());
    }

    const existingCategory =
      await this.serviceCategoriesRepository.findByNameAndEstablishmentId(
        categoryName.value,
        establishment.id.toString(),
      );

    if (existingCategory && !existingCategory.id.equals(category.id)) {
      return left(
        new ResourceAlreadyExistsError(
          "A service category with this name already exists.",
        ),
      );
    }

    try {
      category.rename(categoryName);
      await this.serviceCategoriesRepository.save(category);
    } catch (error) {
      return left(error instanceof Error ? error : new UnexpectedDomainError());
    }

    return right({ category });
  }
}
