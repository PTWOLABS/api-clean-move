import { Injectable } from "@nestjs/common";
import { Either, left, right } from "../../../../shared/either";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { UserRole } from "../../../accounts/domain/value-objects/user-role";
import { Employee } from "../../../employees/domain/entities/employee";
import { EmployeeAlreadyDeletedError } from "../../../employees/domain/errors/employee-already-deleted-error";
import { InvalidRegisterEmployeeInputError } from "../../../employees/domain/errors/invalid-register-employee-input-error";
import {
  EmployeeFeaturesPolicy,
  InvalidEmployeeFeatureError,
} from "../../../employees/domain/policies/employee-features-policy";
import { InvalidBirthDateError } from "../../../employees/domain/value-objects/birth-date";
import { EmployeesRepository } from "../../repositories/employees-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type UpdateEmployeeActor = {
  userId: string;
  role: UserRole;
};

type UpdateEmployeeUseCaseRequest = {
  actor: UpdateEmployeeActor;
  employeeId: string;
  name?: string;
  birthDate?: Date | null;
  extraFeatures?: string[];
};

type UpdateEmployeeUseCaseResponse = Either<
  | ResourceNotFoundError
  | NotAllowedError
  | InvalidRegisterEmployeeInputError
  | UnexpectedDomainError,
  { employee: Employee }
>;

@Injectable()
export class UpdateEmployeeUseCase {
  constructor(
    private employeesRepository: EmployeesRepository,
    private establishmentsRepository: EstablishmentsRepository,
  ) {}

  async execute({
    actor,
    employeeId,
    name,
    birthDate,
    extraFeatures,
  }: UpdateEmployeeUseCaseRequest): Promise<UpdateEmployeeUseCaseResponse> {
    if (actor.role === "ESTABLISHMENT") {
      return this.updateAsEstablishment({
        establishmentOwnerId: actor.userId,
        employeeId,
        ...(name !== undefined ? { name } : {}),
        ...(birthDate !== undefined ? { birthDate } : {}),
        ...(extraFeatures !== undefined ? { extraFeatures } : {}),
      });
    }

    if (actor.role === "EMPLOYEE") {
      return this.updateAsEmployee({
        actorUserId: actor.userId,
        employeeId,
        ...(name !== undefined ? { name } : {}),
        ...(birthDate !== undefined ? { birthDate } : {}),
        ...(extraFeatures !== undefined ? { extraFeatures } : {}),
      });
    }

    return left(new NotAllowedError());
  }

  private async updateAsEstablishment({
    establishmentOwnerId,
    employeeId,
    name,
    birthDate,
    extraFeatures,
  }: {
    establishmentOwnerId: string;
    employeeId: string;
    name?: string;
    birthDate?: Date | null;
    extraFeatures?: string[];
  }): Promise<UpdateEmployeeUseCaseResponse> {
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

    return this.applyUpdate(employee, {
      ...(name !== undefined ? { name } : {}),
      ...(birthDate !== undefined ? { birthDate } : {}),
      ...(extraFeatures !== undefined ? { extraFeatures } : {}),
    });
  }

  private async updateAsEmployee({
    actorUserId,
    employeeId,
    name,
    birthDate,
    extraFeatures,
  }: {
    actorUserId: string;
    employeeId: string;
    name?: string;
    birthDate?: Date | null;
    extraFeatures?: string[];
  }): Promise<UpdateEmployeeUseCaseResponse> {
    const employee = await this.employeesRepository.findByUserId(actorUserId);

    if (
      !employee ||
      employee.isDeleted() ||
      employee.id.toString() !== employeeId
    ) {
      return left(new ResourceNotFoundError({ resource: "employee" }));
    }

    if (
      !EmployeeFeaturesPolicy.hasAll(employee.features, [
        "update:employees:self",
      ])
    ) {
      return left(new NotAllowedError());
    }

    if (extraFeatures !== undefined) {
      return left(new NotAllowedError("Employees cannot update features."));
    }

    return this.applyUpdate(employee, {
      ...(name !== undefined ? { name } : {}),
      ...(birthDate !== undefined ? { birthDate } : {}),
    });
  }

  private async applyUpdate(
    employee: Employee,
    data: {
      name?: string;
      birthDate?: Date | null;
      extraFeatures?: string[];
    },
  ): Promise<UpdateEmployeeUseCaseResponse> {
    try {
      employee.update(data);
      await this.employeesRepository.save(employee);
      return right({ employee });
    } catch (error) {
      if (
        error instanceof InvalidRegisterEmployeeInputError ||
        error instanceof InvalidBirthDateError ||
        error instanceof InvalidEmployeeFeatureError
      ) {
        return left(new InvalidRegisterEmployeeInputError(error.message));
      }

      if (error instanceof EmployeeAlreadyDeletedError) {
        return left(new ResourceNotFoundError({ resource: "employee" }));
      }

      return left(new UnexpectedDomainError());
    }
  }
}
