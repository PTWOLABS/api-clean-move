import { Injectable } from "@nestjs/common";
import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { Employee } from "../../../employees/domain/entities/employee";
import { EmployeeAlreadyDeletedError } from "../../../employees/domain/errors/employee-already-deleted-error";
import { EmployeesRepository } from "../../repositories/employees-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type DeleteEmployeeUseCaseRequest = {
  establishmentOwnerId: string;
  employeeId: string;
};

type DeleteEmployeeUseCaseResponse = Either<
  ResourceNotFoundError | UnexpectedDomainError,
  { employee: Employee }
>;

@Injectable()
export class DeleteEmployeeUseCase {
  constructor(
    private employeesRepository: EmployeesRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    employeeId,
  }: DeleteEmployeeUseCaseRequest): Promise<DeleteEmployeeUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const employee = await this.employeesRepository.findByIdAndEstablishmentId(
      employeeId,
      establishment.id.toString(),
    );

    if (!employee || employee.isDeleted()) {
      return left(new ResourceNotFoundError({ resource: "employee" }));
    }

    try {
      employee.softDelete();
      await this.employeesRepository.save(employee);
    } catch (error) {
      if (error instanceof EmployeeAlreadyDeletedError) {
        return left(new ResourceNotFoundError({ resource: "employee" }));
      }

      return left(new UnexpectedDomainError());
    }

    return right({ employee });
  }
}
