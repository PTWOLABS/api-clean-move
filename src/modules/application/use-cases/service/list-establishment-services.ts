import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UserRole } from "../../../accounts/domain/value-objects/user-role";
import { Service } from "../../../catalog/domain/entities/services";
import { EmployeesRepository } from "../../repositories/employees-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import {
  type ServiceFilters,
  ServicesRepository,
} from "../../repositories/services-repository";

type ListEstablishmentServicesActor = {
  userId: string;
  role: UserRole;
};

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
    private employeesRepository: EmployeesRepository,
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

    if (actor.role === "ESTABLISHMENT") {
      if (establishment.ownerId.toString() !== actor.userId) {
        return left(new NotAllowedError());
      }
    } else if (actor.role === "EMPLOYEE") {
      const employee = await this.employeesRepository.findByUserId(
        actor.userId,
      );

      if (
        !employee ||
        employee.isDeleted() ||
        !employee.establishmentId.equals(establishment.id)
      ) {
        return left(new NotAllowedError());
      }
    } else {
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
