import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { InvalidCurrentPasswordError } from "../../../../shared/errors/invalid-current-password-error";
import { InvalidPasswordConfirmationCodeError } from "../../../../shared/errors/invalid-password-confirmation-code-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { SamePasswordError } from "../../../../shared/errors/same-password-error";
import { User } from "../../../accounts/domain/entities/user";
import { HashGenerator } from "../../repositories/hash-generator";
import { PasswordChangeConfirmationCodesRepository } from "../../repositories/password-change-confirmation-codes-repository";
import { TokenHasher } from "../../repositories/token-hasher";
import { UnitOfWork } from "../../repositories/unit-of-work";
import { UsersRepository } from "../../repositories/users-repository";
import { PasswordChangeValidator } from "../../services/password-change-validator";

type UpdateUserPasswordUseCaseRequest = {
  userId: string;
  confirmationCode: string;
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
  | InvalidCurrentPasswordError
  | SamePasswordError
  | InvalidPasswordConfirmationCodeError,
  { user: User }
>;

@Injectable()
export class UpdateUserPasswordUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private passwordChangeConfirmationCodesRepository: PasswordChangeConfirmationCodesRepository,
    private hashGenerator: HashGenerator,
    private tokenHasher: TokenHasher,
    private passwordChangeValidator: PasswordChangeValidator,
    private unitOfWork: UnitOfWork,
  ) {}

  async execute({
    userId,
    confirmationCode,
    newPassword,
    currentPassword,
  }: UpdateUserPasswordUseCaseRequest): Promise<UpdateUserPasswordUseCaseResponse> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      return left(new ResourceNotFoundError({ resource: "user" }));
    }

    const validationResult = await this.passwordChangeValidator.validate({
      user,
      newPassword,
      ...(currentPassword !== undefined ? { currentPassword } : {}),
    });

    if (validationResult.isLeft()) {
      return left(validationResult.value);
    }

    const storedCode =
      await this.passwordChangeConfirmationCodesRepository.findByUserId(userId);

    const hashedConfirmationCode =
      await this.tokenHasher.hash(confirmationCode);

    if (
      !storedCode ||
      storedCode.isExpired(new Date()) ||
      storedCode.hashedCode !== hashedConfirmationCode
    ) {
      return left(new InvalidPasswordConfirmationCodeError());
    }

    const hashedPassword = await this.hashGenerator.hash(newPassword);

    await this.unitOfWork.execute(async () => {
      user.changePassword(hashedPassword);
      await this.usersRepository.save(user);
      await this.passwordChangeConfirmationCodesRepository.deleteByUserId(
        userId,
      );
    });

    return right({ user });
  }
}
