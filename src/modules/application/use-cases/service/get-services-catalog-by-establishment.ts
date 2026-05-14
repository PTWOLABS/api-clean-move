import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { Service } from "../../../catalog/domain/entities/services";
import {
  type ServiceFilters,
  ServicesRepository,
} from "../../repositories/services-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type GetServiceCatalogByEstablishmentUseCaseRequest = {
  establishmentId: string;
  filters?: ServiceFilters;
};

type GetServiceCatalogByEstablishmentUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    services: Service[];
  }
>;

@Injectable()
export class GetServiceCatalogByEstablishmentUseCase {
  constructor(
    private servicesRepository: ServicesRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentId,
    filters,
  }: GetServiceCatalogByEstablishmentUseCaseRequest): Promise<GetServiceCatalogByEstablishmentUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findById(establishmentId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const services = await this.servicesRepository.findManyByEstablishmentId(
      establishment.id.toString(),
      filters,
    );

    return right({
      services,
    });
  }
}
