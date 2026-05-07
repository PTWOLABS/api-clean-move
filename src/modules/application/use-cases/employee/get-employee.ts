import { Injectable } from "@nestjs/common";
import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UserRole } from "../../../accounts/domain/value-objects/user-role";
import { Employee } from "../../../employees/domain/entities/employee";
import { EmployeeFeaturesPolicy } from "../../../employees/domain/policies/employee-features-policy";
import { EmployeesRepository } from "../../repositories/employees-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type GetEmployeeActor = {
  userId: string;
  role: UserRole;
};

type GetEmployeeUseCaseRequest = {
  actor: GetEmployeeActor;
  employeeId: string;
};

type GetEmployeeUseCaseResponse = Either<
  ResourceNotFoundError | NotAllowedError,
  { employee: Employee }
>;

@Injectable()
export class GetEmployeeUseCase {
  constructor(
    private employeesRepository: EmployeesRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    actor,
    employeeId,
  }: GetEmployeeUseCaseRequest): Promise<GetEmployeeUseCaseResponse> {
    if (actor.role === "ESTABLISHMENT") {
      const establishment = await this.establishmentsRepository.findByOwnerId(
        actor.userId,
      );

      if (!establishment) {
        return left(new ResourceNotFoundError({ resource: "establishment" }));
      }

      const employee =
        await this.employeesRepository.findByIdAndEstablishmentId(
          employeeId,
          establishment.id.toString(),
        );

      if (!employee || employee.isDeleted()) {
        return left(new ResourceNotFoundError({ resource: "employee" }));
      }

      return right({ employee });
    }

    if (actor.role === "EMPLOYEE") {
      const employee = await this.employeesRepository.findByUserId(
        actor.userId,
      );

      if (
        !employee ||
        employee.isDeleted() ||
        employee.id.toString() !== employeeId
      ) {
        return left(new ResourceNotFoundError({ resource: "employee" }));
      }

      if (
        !EmployeeFeaturesPolicy.hasAll(employee.features, [
          "read:employees:self",
        ])
      ) {
        return left(new NotAllowedError());
      }

      return right({ employee });
    }

    return left(new NotAllowedError());
  }
}
