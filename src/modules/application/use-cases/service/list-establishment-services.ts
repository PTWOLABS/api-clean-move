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
import {
  EstablishmentScopeActor,
  EstablishmentScopeService,
} from "../../services/establishment-scope";

type ListEstablishmentServicesActor = EstablishmentScopeActor;

type ListEstablishmentServicesUseCaseRequest = {
  actor: ListEstablishmentServicesActor;
  establishmentId: string;
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
    private establishmentScope: EstablishmentScopeService,
  ) {}

  async execute({
    actor,
    establishmentId,
    filters,
  }: ListEstablishmentServicesUseCaseRequest): Promise<ListEstablishmentServicesUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findById(establishmentId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const scope = await this.establishmentScope.resolve(actor);
    if (scope.isLeft()) {
      return left(scope.value);
    }

    if (!scope.value.establishment.id.equals(establishment.id)) {
      return left(new NotAllowedError());
    }

    const { items, totalItems } =
      await this.servicesRepository.findManyByEstablishmentId(
        establishmentId,
        filters,
      );

    return right({
      items,
      totalItems,
    });
  }
}
