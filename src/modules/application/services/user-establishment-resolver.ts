import { Injectable } from "@nestjs/common";

import { User } from "../../accounts/domain/entities/user";
import { EmployeesRepository } from "../repositories/employees-repository";
import { EstablishmentsRepository } from "../repositories/establishment-repository";

export type UserEstablishmentContext = {
  establishmentId: string | null;
  onboardingCompletedAt: Date | null;
};

@Injectable()
export class UserEstablishmentResolver {
  constructor(
    private readonly establishmentsRepository: EstablishmentsRepository,
    private readonly employeesRepository: EmployeesRepository,
  ) {}

  async resolveEstablishmentId(user: User): Promise<string | null> {
    const context = await this.resolveEstablishmentContext(user);

    return context.establishmentId;
  }

  async resolveEstablishmentContext(
    user: User,
  ): Promise<UserEstablishmentContext> {
    if (user.role === "ESTABLISHMENT") {
      const establishment = await this.establishmentsRepository.findByOwnerId(
        user.id.toString(),
      );

      return {
        establishmentId: establishment ? establishment.id.toString() : null,
        onboardingCompletedAt: establishment?.onboardingCompletedAt ?? null,
      };
    }

    if (user.role === "EMPLOYEE") {
      const employee = await this.employeesRepository.findByUserId(
        user.id.toString(),
      );

      if (!employee || employee.isDeleted()) {
        return {
          establishmentId: null,
          onboardingCompletedAt: null,
        };
      }

      const establishment = await this.establishmentsRepository.findById(
        employee.establishmentId.toString(),
      );

      return {
        establishmentId: employee.establishmentId.toString(),
        onboardingCompletedAt: establishment?.onboardingCompletedAt ?? null,
      };
    }

    return {
      establishmentId: null,
      onboardingCompletedAt: null,
    };
  }
}
