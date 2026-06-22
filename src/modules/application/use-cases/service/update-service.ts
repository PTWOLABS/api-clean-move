import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { Service } from "../../../catalog/domain/entities/services";
import { ServiceCategoriesRepository } from "../../repositories/service-categories-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import { ServicesRepository } from "../../repositories/services-repository";
import { NoUpdateFieldsProvidedError } from "../../../../shared/errors/no-update-field-provided-error";
import {
  InvalidServiceNameError,
  ServiceName,
} from "../../../catalog/domain/value-objects/service-name";
import { InvalidEstimatedDurationError } from "../../../catalog/domain/value-objects/estimated-duration";
import { InvalidEstimatedDurationTransitionError } from "../../../catalog/domain/errors/invalid-estimated-duration-transition-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import {
  InvalidServicePriceSpecificationError,
  ServicePriceSpecificationValue,
} from "../../../catalog/domain/value-objects/service-price-specification";

type UpdateServiceUseCaseRequest = {
  establishmentOwnerId: string;
  serviceId: string;
  data: {
    serviceName?: string;
    description?: string;
    categoryId?: string | null;
    estimatedDuration?: {
      minInMinutes: number;
      maxInMinutes?: number | null | undefined;
    };
    price?: number;
    priceSpecification?: ServicePriceSpecificationValue;
    isActive?: boolean;
  };
};

type UpdateServiceUseCaseResponse = Either<
  | NoUpdateFieldsProvidedError
  | ResourceNotFoundError
  | ResourceAlreadyExistsError
  | NotAllowedError
  | InvalidServiceUpdateInputError
  | UnexpectedDomainError,
  {
    service: Service;
  }
>;

export class InvalidServiceUpdateInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidServiceUpdateInputError";
  }
}

@Injectable()
export class UpdateServiceUseCase {
  constructor(
    private servicesRepository: ServicesRepository,
    private establishmentsRepository: EstablishmentsRepository,
    private serviceCategoriesRepository: ServiceCategoriesRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    serviceId,
    data,
  }: UpdateServiceUseCaseRequest): Promise<UpdateServiceUseCaseResponse> {
    let hasAnyFieldToUpdate = false;

    for (const field in data) {
      if (data[field as keyof typeof data] !== undefined) {
        hasAnyFieldToUpdate = true;
        break;
      }
    }

    if (!hasAnyFieldToUpdate) {
      return left(new NoUpdateFieldsProvidedError());
    }

    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const serviceToUpdate = await this.servicesRepository.findById(serviceId);

    if (!serviceToUpdate) {
      return left(new ResourceNotFoundError({ resource: "service" }));
    }

    if (!serviceToUpdate.establishmentId.equals(establishment.id)) {
      return left(new NotAllowedError());
    }

    let resolvedServiceName: ServiceName | undefined;

    if (data.serviceName !== undefined) {
      try {
        resolvedServiceName = ServiceName.create(data.serviceName);
      } catch (error) {
        if (error instanceof InvalidServiceNameError) {
          return left(new InvalidServiceUpdateInputError(error.message));
        }

        return left(new UnexpectedDomainError());
      }

      const serviceWithSameName =
        await this.servicesRepository.findActiveByNameAndEstablishmentId(
          resolvedServiceName.value,
          establishment.id.toString(),
        );

      if (
        serviceWithSameName &&
        !serviceWithSameName.id.equals(serviceToUpdate.id)
      ) {
        return left(
          new ResourceAlreadyExistsError(
            "A service with this name already exists.",
          ),
        );
      }
    }

    const updatePayload: Parameters<Service["update"]>[0] = {
      ...(data.serviceName !== undefined
        ? { serviceName: resolvedServiceName!.value }
        : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(data.estimatedDuration !== undefined
        ? { estimatedDuration: data.estimatedDuration }
        : {}),
      ...(data.priceSpecification !== undefined
        ? { priceSpecification: data.priceSpecification }
        : data.price !== undefined
          ? { price: data.price }
          : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    };

    if (data.categoryId !== undefined) {
      if (data.categoryId === null) {
        updatePayload.categoryId = null;
      } else {
        const serviceCategory =
          await this.serviceCategoriesRepository.findByIdAndEstablishmentId(
            data.categoryId,
            establishment.id.toString(),
          );

        if (!serviceCategory || serviceCategory.isDeleted()) {
          return left(
            new ResourceNotFoundError({ resource: "service category" }),
          );
        }

        updatePayload.categoryId = data.categoryId;
        updatePayload.categoryName = serviceCategory.name.value;
      }
    }

    try {
      serviceToUpdate.update(updatePayload);
    } catch (error) {
      if (
        error instanceof InvalidServiceNameError ||
        error instanceof InvalidEstimatedDurationError ||
        error instanceof InvalidServicePriceSpecificationError ||
        error instanceof InvalidEstimatedDurationTransitionError
      ) {
        return left(new InvalidServiceUpdateInputError(error.message));
      }
      return left(new UnexpectedDomainError());
    }

    await this.servicesRepository.save(serviceToUpdate);

    const updatedService = await this.servicesRepository.findById(serviceId);

    return right({
      service: updatedService ?? serviceToUpdate,
    });
  }
}
