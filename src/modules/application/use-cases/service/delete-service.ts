import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { ServiceAlreadyDeletedError } from "../../../catalog/domain/errors/service-already-deleted-error";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import { ServicesRepository } from "../../repositories/services-repository";

type DeleteServiceUseCaseRequest = {
  establishmentOwnerId: string;
  serviceId: string;
};

type DeleteServiceUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError | UnexpectedDomainError,
  Record<string, never>
>;

@Injectable()
export class DeleteServiceUseCase {
  constructor(
    private servicesRepository: ServicesRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    serviceId,
  }: DeleteServiceUseCaseRequest): Promise<DeleteServiceUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const establishmentId = establishment.id.toString();

    const service =
      await this.servicesRepository.findByServiceIdAndEstablishmentId(
        serviceId,
        establishmentId,
      );

    if (service) {
      if (service.isDeleted()) {
        return left(new ResourceNotFoundError({ resource: "service" }));
      }

      try {
        service.softDelete();
        await this.servicesRepository.save(service);
      } catch (error) {
        if (error instanceof ServiceAlreadyDeletedError) {
          return left(new ResourceNotFoundError({ resource: "service" }));
        }

        return left(new UnexpectedDomainError());
      }

      return right({});
    }

    const serviceAnywhere =
      await this.servicesRepository.findByIdIncludingSoftDeleted(serviceId);

    if (!serviceAnywhere) {
      return left(new ResourceNotFoundError({ resource: "service" }));
    }

    if (!serviceAnywhere.establishmentId.equals(establishment.id)) {
      return left(new NotAllowedError());
    }

    if (serviceAnywhere.isDeleted()) {
      return left(new ResourceNotFoundError({ resource: "service" }));
    }

    try {
      serviceAnywhere.softDelete();
      await this.servicesRepository.save(serviceAnywhere);
    } catch (error) {
      if (error instanceof ServiceAlreadyDeletedError) {
        return left(new ResourceNotFoundError({ resource: "service" }));
      }

      return left(new UnexpectedDomainError());
    }

    return right({});
  }
}
