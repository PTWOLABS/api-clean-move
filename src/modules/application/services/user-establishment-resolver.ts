import { Injectable } from "@nestjs/common";

import { User } from "../../accounts/domain/entities/user";
import { EmployeesRepository } from "../repositories/employees-repository";
import { EstablishmentsRepository } from "../repositories/establishment-repository";

@Injectable()
export class UserEstablishmentResolver {
  constructor(
    private readonly establishmentsRepository: EstablishmentsRepository,
    private readonly employeesRepository: EmployeesRepository,
  ) {}

  async resolveEstablishmentId(user: User): Promise<string | null> {
    if (user.role === "ESTABLISHMENT") {
      const establishment = await this.establishmentsRepository.findByOwnerId(
        user.id.toString(),
      );

      return establishment ? establishment.id.toString() : null;
    }

    if (user.role === "EMPLOYEE") {
      const employee = await this.employeesRepository.findByUserId(
        user.id.toString(),
      );

      if (!employee || employee.isDeleted()) {
        return null;
      }

      return employee.establishmentId.toString();
    }

    return null;
  }
}
