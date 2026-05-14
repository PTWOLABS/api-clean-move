import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { Service } from "../../../catalog/domain/entities/services";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import {
  type ServiceFilters,
  ServicesRepository,
} from "../../repositories/services-repository";

type ListEstablishmentServicesUseCaseRequest = {
  authenticatedUserId: string;
  pathOwnerUserId: string;
  filters?: ServiceFilters;
};

type ListEstablishmentServicesUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
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
    authenticatedUserId,
    pathOwnerUserId,
    filters,
  }: ListEstablishmentServicesUseCaseRequest): Promise<ListEstablishmentServicesUseCaseResponse> {
    if (authenticatedUserId !== pathOwnerUserId) {
      return left(new NotAllowedError());
    }

    const establishment =
      await this.establishmentsRepository.findByOwnerId(pathOwnerUserId);

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
