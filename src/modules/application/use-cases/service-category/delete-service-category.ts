import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { ServiceCategory } from "../../../catalog/domain/entities/service-category";
import { ServiceCategoriesRepository } from "../../repositories/service-categories-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import { ServicesRepository } from "../../repositories/services-repository";
import { UnitOfWork } from "../../repositories/unit-of-work";

type DeleteServiceCategoryUseCaseRequest = {
  establishmentOwnerId: string;
  categoryId: string;
};

type DeleteServiceCategoryUseCaseResponse = Either<
  ResourceNotFoundError | UnexpectedDomainError,
  {
    category: ServiceCategory;
  }
>;

@Injectable()
export class DeleteServiceCategoryUseCase {
  constructor(
    private serviceCategoriesRepository: ServiceCategoriesRepository,
    private establishmentsRepository: EstablishmentsRepository,
    private servicesRepository: ServicesRepository,
    private unitOfWork: UnitOfWork,
  ) {}

  async execute({
    establishmentOwnerId,
    categoryId,
  }: DeleteServiceCategoryUseCaseRequest): Promise<DeleteServiceCategoryUseCaseResponse> {
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

    try {
      await this.unitOfWork.execute(async () => {
        await this.servicesRepository.clearCategoryFromServices(categoryId);
        category.softDelete();
        await this.serviceCategoriesRepository.save(category);
      });
    } catch (error) {
      return left(error instanceof Error ? error : new UnexpectedDomainError());
    }

    return right({ category });
  }
}
