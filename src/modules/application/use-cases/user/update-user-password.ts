import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { InvalidCurrentPasswordError } from "../../../../shared/errors/invalid-current-password-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { User } from "../../../accounts/domain/entities/user";
import { HashComparer } from "../../repositories/hash-comparer";
import { HashGenerator } from "../../repositories/hash-generator";
import { UnitOfWork } from "../../repositories/unit-of-work";
import { UsersRepository } from "../../repositories/users-repository";

type UpdateUserPasswordUseCaseRequest = {
  userId: string;
  newPassword: string;
  currentPassword?: string;
};

export class InvalidUserPasswordUpdateInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUserPasswordUpdateInputError";
  }
}

type UpdateUserPasswordUseCaseResponse = Either<
  | ResourceNotFoundError
  | InvalidUserPasswordUpdateInputError
  | InvalidCurrentPasswordError,
  { user: User }
>;

@Injectable()
export class UpdateUserPasswordUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private hashGenerator: HashGenerator,
    private hashComparer: HashComparer,
    private unitOfWork: UnitOfWork,
  ) {}

  async execute({
    userId,
    newPassword,
    currentPassword,
  }: UpdateUserPasswordUseCaseRequest): Promise<UpdateUserPasswordUseCaseResponse> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      return left(new ResourceNotFoundError({ resource: "user" }));
    }

    if (user.hashedPassword === null) {
      if (currentPassword !== undefined) {
        return left(
          new InvalidUserPasswordUpdateInputError(
            "Current password must not be provided when setting the first local password.",
          ),
        );
      }
    } else {
      if (currentPassword === undefined) {
        return left(
          new InvalidUserPasswordUpdateInputError(
            "Current password is required to update an existing local password.",
          ),
        );
      }

      const isCurrentPasswordValid = await this.hashComparer.compare(
        currentPassword,
        user.hashedPassword,
      );

      if (!isCurrentPasswordValid) {
        return left(new InvalidCurrentPasswordError());
      }
    }

    const hashedPassword = await this.hashGenerator.hash(newPassword);

    await this.unitOfWork.execute(async () => {
      user.changePassword(hashedPassword);
      await this.usersRepository.save(user);
    });

    return right({ user });
  }
}
