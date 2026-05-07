import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { EmployeesRepository } from "../../modules/application/repositories/employees-repository";
import { EmployeeFeaturesPolicy } from "../../modules/employees/domain/policies/employee-features-policy";
import { AuthenticatedRequest } from "./authenticated-user";
import { EmployeeFeatures } from "./employee-features";

@Injectable()
export class EmployeeFeaturesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly employeesRepository: EmployeesRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeatures = this.reflector.getAllAndOverride(
      EmployeeFeatures,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredFeatures || requiredFeatures.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      return false;
    }

    if (user.role !== "EMPLOYEE") {
      return true;
    }

    const employee = await this.employeesRepository.findByUserId(user.userId);

    if (!employee || employee.isDeleted()) {
      return false;
    }

    return EmployeeFeaturesPolicy.hasAll(employee.features, requiredFeatures);
  }
}
