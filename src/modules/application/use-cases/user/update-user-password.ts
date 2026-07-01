import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { InvalidCurrentPasswordError } from "../../../../shared/errors/invalid-current-password-error";
import { InvalidPasswordConfirmationCodeError } from "../../../../shared/errors/invalid-password-confirmation-code-error";
import { InvalidUserPasswordUpdateInputError } from "../../../../shared/errors/invalid-user-password-update-input-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { SamePasswordError } from "../../../../shared/errors/same-password-error";
import { MAX_FAILED_ATTEMPTS } from "../../../accounts/domain/entities/password-change-confirmation-code";
import { User } from "../../../accounts/domain/entities/user";
import { HashComparer } from "../../repositories/hash-comparer";
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
    private hashComparer: HashComparer,
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

    if (!storedCode) {
      return left(new InvalidPasswordConfirmationCodeError());
    }

    const isPendingPasswordMatch = await this.hashComparer.compare(
      newPassword,
      storedCode.pendingPasswordHash,
    );

    if (!isPendingPasswordMatch) {
      return left(
        new InvalidUserPasswordUpdateInputError(
          "The new password does not match the one used to request the confirmation code.",
        ),
      );
    }

    if (storedCode.isExpired(new Date())) {
      return left(new InvalidPasswordConfirmationCodeError());
    }

    const hashedConfirmationCode =
      await this.tokenHasher.hash(confirmationCode);

    if (storedCode.hashedCode !== hashedConfirmationCode) {
      storedCode.incrementFailedAttempts();
      await this.passwordChangeConfirmationCodesRepository.upsert(storedCode);

      if (storedCode.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        await this.passwordChangeConfirmationCodesRepository.deleteByUserId(
          userId,
        );
      }

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
