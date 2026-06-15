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

type CreateServiceCategoryUseCaseRequest = {
  establishmentOwnerId: string;
  name: string;
};

type CreateServiceCategoryUseCaseResponse = Either<
  | ResourceNotFoundError
  | ResourceAlreadyExistsError
  | InvalidServiceCategoryInputError
  | UnexpectedDomainError,
  {
    category: ServiceCategory;
  }
>;

export class InvalidServiceCategoryInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidServiceCategoryInputError";
  }
}

@Injectable()
export class CreateServiceCategoryUseCase {
  constructor(
    private serviceCategoriesRepository: ServiceCategoriesRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    name,
  }: CreateServiceCategoryUseCaseRequest): Promise<CreateServiceCategoryUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
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

    if (existingCategory) {
      return left(
        new ResourceAlreadyExistsError(
          "A service category with this name already exists.",
        ),
      );
    }

    const category = ServiceCategory.create({
      establishmentId: establishment.id,
      name: categoryName,
    });

    try {
      await this.serviceCategoriesRepository.create(category);
    } catch (error) {
      return left(error instanceof Error ? error : new UnexpectedDomainError());
    }

    return right({ category });
  }
}
