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
  establishmentOwnerId: string;
  establishmentId: string;
  filters?: ServiceFilters;
};

type ListEstablishmentServicesUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  {
    services: Service[];
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
    establishmentId,
    filters,
  }: ListEstablishmentServicesUseCaseRequest): Promise<ListEstablishmentServicesUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    if (establishment.id.toString() !== establishmentId) {
      return left(new NotAllowedError());
    }

    const services = await this.servicesRepository.findManyByEstablishmentId(
      establishmentId,
      filters,
    );

    return right({
      services,
    });
  }
}
