import { Injectable } from "@nestjs/common";
import { UserRole } from "../../accounts/domain/value-objects/user-role";
import { EmployeeFeaturesPolicy } from "../../employees/domain/policies/employee-features-policy";
import { EmployeesRepository } from "../repositories/employees-repository";

type EmployeeSessionActor = {
  userId: string;
  role: UserRole;
};

@Injectable()
export class EmployeeSessionAccessService {
  constructor(private readonly employeesRepository: EmployeesRepository) {}

  async canCreateSessionFor(actor: EmployeeSessionActor) {
    return this.hasEmployeeFeature(actor, "create:sessions:self");
  }

  async canReadSessionFor(actor: EmployeeSessionActor) {
    return this.hasEmployeeFeature(actor, "read:sessions:self");
  }

  private async hasEmployeeFeature(
    actor: EmployeeSessionActor,
    feature: "create:sessions:self" | "read:sessions:self",
  ) {
    if (actor.role !== "EMPLOYEE") {
      return true;
    }

    const employee = await this.employeesRepository.findByUserId(actor.userId);

    if (!employee || employee.isDeleted()) {
      return false;
    }

    return EmployeeFeaturesPolicy.hasAll(employee.features, [feature]);
  }
}
