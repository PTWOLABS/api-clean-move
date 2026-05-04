import { Injectable } from "@nestjs/common";
import { Either, left, right } from "../../../../shared/either";
import { PersistenceError } from "../../../../shared/errors/persistence-error";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { UniqueConstraintViolationError } from "../../../../shared/errors/unique-constraint-violation-error";
import { User } from "../../../accounts/domain/entities/user";
import { InvalidCpfError, Cpf } from "../../../accounts/domain/value-objects/cpf";
import {
  Email,
  InvalidEmailError,
} from "../../../accounts/domain/value-objects/email";
import { UserRole } from "../../../accounts/domain/value-objects/user-role";
import { Employee } from "../../../employees/domain/entities/employee";
import { InvalidRegisterEmployeeInputError } from "../../../employees/domain/errors/invalid-register-employee-input-error";
import {
  EmployeeFeaturesPolicy,
  InvalidEmployeeFeatureError,
} from "../../../employees/domain/policies/employee-features-policy";
import {
  BirthDate,
  InvalidBirthDateError,
} from "../../../employees/domain/value-objects/birth-date";
import { Establishment } from "../../../establishments/domain/entities/establishment";
import { EmployeesRepository } from "../../repositories/employees-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import { HashGenerator } from "../../repositories/hash-generator";
import { UnitOfWork } from "../../repositories/unit-of-work";
import { UsersRepository } from "../../repositories/users-repository";

type RegisterEmployeeUseCaseRequest = {
  establishmentOwnerId: string;
  name: string;
  email: string;
  password: string;
  cpf?: string | null;
  birthDate?: Date | null;
  extraFeatures?: string[];
};

type RegisterEmployeeUseCaseResponse = Either<
  | ResourceAlreadyExistsError
  | ResourceNotFoundError
  | InvalidRegisterEmployeeInputError
  | UnexpectedDomainError,
  {
    employee: Employee;
  }
>;

@Injectable()
export class RegisterEmployeeUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private employeesRepository: EmployeesRepository,
    private establishmentsRepository: EstablishmentsRepository,
    private hashGenerator: HashGenerator,
    private unitOfWork: UnitOfWork,
  ) {}

  async execute({
    establishmentOwnerId,
    name,
    email: rawEmail,
    password,
    cpf: rawCpf = null,
    birthDate: rawBirthDate = null,
    extraFeatures = [],
  }: RegisterEmployeeUseCaseRequest): Promise<RegisterEmployeeUseCaseResponse> {
    let establishment: Establishment | null;

    try {
      establishment =
        await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);
    } catch (error) {
      if (error instanceof PersistenceError) {
        return left(new UnexpectedDomainError());
      }

      return left(new UnexpectedDomainError());
    }

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "Establishment" }));
    }

    let email: Email;
    let cpf: Cpf | null;
    let birthDate: BirthDate | null;

    try {
      email = new Email(rawEmail);
      cpf = rawCpf ? Cpf.create(rawCpf) : null;
      birthDate = rawBirthDate ? BirthDate.create(rawBirthDate) : null;
      EmployeeFeaturesPolicy.build(extraFeatures);
    } catch (error) {
      if (
        error instanceof InvalidEmailError ||
        error instanceof InvalidCpfError ||
        error instanceof InvalidBirthDateError ||
        error instanceof InvalidEmployeeFeatureError ||
        error instanceof InvalidRegisterEmployeeInputError
      ) {
        return left(new InvalidRegisterEmployeeInputError(error.message));
      }

      return left(new UnexpectedDomainError());
    }

    let userWithTheSameEmail: User | null;

    try {
      userWithTheSameEmail = await this.usersRepository.findByEmail(
        email.toString(),
      );
    } catch (error) {
      if (error instanceof PersistenceError) {
        return left(new UnexpectedDomainError());
      }

      return left(new UnexpectedDomainError());
    }

    if (userWithTheSameEmail) {
      return left(new ResourceAlreadyExistsError("Employee already registered."));
    }

    const userRole: UserRole = "EMPLOYEE";
    let hashedPassword: string;

    try {
      hashedPassword = await this.hashGenerator.hash(password);
    } catch (error) {
      return left(new UnexpectedDomainError());
    }

    const user = User.create({
      name,
      email,
      hashedPassword,
      role: userRole,
      phone: null,
      address: null,
    });

    let employee: Employee;

    try {
      employee = Employee.create({
        establishmentId: establishment.id,
        userId: user.id,
        name,
        cpf,
        birthDate,
        extraFeatures,
      });
    } catch (error) {
      if (
        error instanceof InvalidCpfError ||
        error instanceof InvalidBirthDateError ||
        error instanceof InvalidEmployeeFeatureError ||
        error instanceof InvalidRegisterEmployeeInputError
      ) {
        return left(new InvalidRegisterEmployeeInputError(error.message));
      }

      return left(new UnexpectedDomainError());
    }

    try {
      await this.unitOfWork.execute(async () => {
        await this.usersRepository.create(user);
        await this.employeesRepository.create(employee);
      });
    } catch (error) {
      if (error instanceof UniqueConstraintViolationError) {
        return left(
          new ResourceAlreadyExistsError("Employee already registered."),
        );
      }

      if (error instanceof PersistenceError) {
        return left(new UnexpectedDomainError());
      }

      return left(new UnexpectedDomainError());
    }

    return right({
      employee,
    });
  }
}
