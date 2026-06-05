import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { Service } from "../../../catalog/domain/entities/services";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import {
  type ServiceFilters,
  ServicesRepository,
} from "../../repositories/services-repository";

type ListEstablishmentServicesUseCaseRequest = {
  establishmentOwnerId: string;
  filters?: ServiceFilters;
};

type ListEstablishmentServicesUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    items: Service[];
    totalItems: number;
  }
>;

@Injectable()
export class ListEstablishmentServicesUseCase {
  constructor(
    private servicesRepository: ServicesRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    filters,
  }: ListEstablishmentServicesUseCaseRequest): Promise<ListEstablishmentServicesUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const { items, totalItems } =
      await this.servicesRepository.findManyByEstablishmentId(
        establishment.id.toString(),
        filters,
      );

    return right({
      items,
      totalItems,
    });
  }
}
