import { Injectable } from "@nestjs/common";
import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Service } from "../../../catalog/domain/entities/services";
import { InvalidEstimatedDurationTransitionError } from "../../../catalog/domain/errors/invalid-estimated-duration-transition-error";
import {
  EstimatedDuration,
  InvalidEstimatedDurationError,
} from "../../../catalog/domain/value-objects/estimated-duration";
import {
  InvalidMoneyError,
  Money,
} from "../../../catalog/domain/value-objects/money";
import {
  InvalidServiceNameError,
  ServiceName,
} from "../../../catalog/domain/value-objects/service-name";
import { ServiceCategoriesRepository } from "../../repositories/service-categories-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import { ServicesRepository } from "../../repositories/services-repository";
import { InvalidServiceUpdateInputError } from "./update-service";

type CreateServiceUseCaseRequest = {
  establishmentOwnerId: string;
  serviceName: string;
  description?: string | undefined;
  categoryId?: string | null | undefined;
  estimatedDuration?:
    | {
        minInMinutes: number;
        maxInMinutes?: number | null | undefined;
      }
    | undefined;
  price: number;
  isActive?: boolean;
};

type CreateServiceUseCaseResponse = Either<
  | ResourceNotFoundError
  | InvalidServiceUpdateInputError
  | UnexpectedDomainError,
  {
    service: Service;
  }
>;

@Injectable()
export class CreateServiceUseCase {
  constructor(
    private servicesRepository: ServicesRepository,
    private establishmentsRepository: EstablishmentsRepository,
    private serviceCategoriesRepository: ServiceCategoriesRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    serviceName,
    description,
    categoryId,
    estimatedDuration,
    price,
    isActive = true,
  }: CreateServiceUseCaseRequest): Promise<CreateServiceUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "Establishment" }));
    }

    let category:
      | {
          id: UniqueEntityId;
          name: string;
        }
      | undefined;

    if (categoryId) {
      const serviceCategory =
        await this.serviceCategoriesRepository.findByIdAndEstablishmentId(
          categoryId,
          establishment.id.toString(),
        );

      if (!serviceCategory || serviceCategory.isDeleted()) {
        return left(
          new ResourceNotFoundError({ resource: "service category" }),
        );
      }

      category = {
        id: serviceCategory.id,
        name: serviceCategory.name.value,
      };
    }

    let service: Service;

    try {
      service = Service.create({
        establishmentId: establishment.id,
        serviceName: ServiceName.create(serviceName),
        description,
        category,
        price: Money.create(price),
        estimatedDuration: estimatedDuration
          ? EstimatedDuration.create(estimatedDuration)
          : undefined,
        isActive,
      });
    } catch (error) {
      if (
        error instanceof InvalidServiceNameError ||
        error instanceof InvalidEstimatedDurationError ||
        error instanceof InvalidMoneyError ||
        error instanceof InvalidEstimatedDurationTransitionError
      ) {
        return left(new InvalidServiceUpdateInputError(error.message));
      }
      return left(new UnexpectedDomainError());
    }

    await this.servicesRepository.create(service);

    const createdService = await this.servicesRepository.findById(
      service.id.toString(),
    );

    return right({
      service: createdService ?? service,
    });
  }
}
