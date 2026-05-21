import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../shared/either";
import { NotAllowedError } from "../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../shared/errors/resource-not-found-error";
import { UserRole } from "../../accounts/domain/value-objects/user-role";
import { Employee } from "../../employees/domain/entities/employee";
import { Establishment } from "../../establishments/domain/entities/establishment";
import { EmployeesRepository } from "../repositories/employees-repository";
import { EstablishmentsRepository } from "../repositories/establishment-repository";

export type EstablishmentScopeActor = {
  userId: string;
  role: UserRole;
};

export type EstablishmentScopeResult = {
  establishment: Establishment;
  employee?: Employee;
};

@Injectable()
export class EstablishmentScopeService {
  constructor(
    private readonly establishmentsRepository: EstablishmentsRepository,
    private readonly employeesRepository: EmployeesRepository,
  ) {}

  async resolve(
    actor: EstablishmentScopeActor,
  ): Promise<
    Either<
      ResourceNotFoundError | NotAllowedError,
      EstablishmentScopeResult
    >
  > {
    if (actor.role === "ESTABLISHMENT") {
      const establishment = await this.establishmentsRepository.findByOwnerId(
        actor.userId,
      );

      if (!establishment) {
        return left(new ResourceNotFoundError({ resource: "establishment" }));
      }

      return right({ establishment });
    }

    if (actor.role === "EMPLOYEE") {
      const employee = await this.employeesRepository.findByUserId(
        actor.userId,
      );

      if (!employee || employee.isDeleted()) {
        return left(new ResourceNotFoundError({ resource: "establishment" }));
      }

      const establishment = await this.establishmentsRepository.findById(
        employee.establishmentId.toString(),
      );

      if (!establishment) {
        return left(new ResourceNotFoundError({ resource: "establishment" }));
      }

      return right({ establishment, employee });
    }

    return left(new NotAllowedError());
  }
}
