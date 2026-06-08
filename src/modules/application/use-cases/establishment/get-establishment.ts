import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UserRole } from "../../../accounts/domain/value-objects/user-role";
import { Establishment } from "../../../establishments/domain/entities/establishment";
import { EmployeesRepository } from "../../repositories/employees-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type GetEstablishmentActor = {
  userId: string;
  role: UserRole;
};

type GetEstablishmentUseCaseRequest = {
  actor: GetEstablishmentActor;
  establishmentId: string;
};

type GetEstablishmentUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  { establishment: Establishment }
>;

@Injectable()
export class GetEstablishmentUseCase {
  constructor(
    private establishmentsRepository: EstablishmentsRepository,
    private employeesRepository: EmployeesRepository,
  ) {}

  async execute({
    actor,
    establishmentId,
  }: GetEstablishmentUseCaseRequest): Promise<GetEstablishmentUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findById(establishmentId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    if (actor.role === "ESTABLISHMENT") {
      if (establishment.ownerId.toString() !== actor.userId) {
        return left(new NotAllowedError());
      }

      return right({ establishment });
    }

    if (actor.role === "EMPLOYEE") {
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

      return right({ establishment });
    }

    return left(new NotAllowedError());
  }
}
