import { Injectable } from "@nestjs/common";
import { User } from "../../../accounts/domain/entities/user";
import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { EmployeesRepository } from "../../repositories/employees-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import { UsersRepository } from "../../repositories/users-repository";

type GetMeUseCaseRequest = {
  userId: string;
};

type GetMeUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    user: User;
    establishmentId: string | null;
  }
>;

@Injectable()
export class GetMeUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private establishmentsRepository: EstablishmentsRepository,
    private employeesRepository: EmployeesRepository,
  ) {}

  async execute({
    userId,
  }: GetMeUseCaseRequest): Promise<GetMeUseCaseResponse> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      return left(new ResourceNotFoundError({ resource: "user" }));
    }

    const establishmentId = await this.resolveEstablishmentId(user);

    return right({
      user,
      establishmentId,
    });
  }

  private async resolveEstablishmentId(user: User): Promise<string | null> {
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
