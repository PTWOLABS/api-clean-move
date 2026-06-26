import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { InvalidOrExpiredPasswordResetTokenError } from "../../../../shared/errors/invalid-or-expired-password-reset-token-error";
import { User } from "../../../accounts/domain/entities/user";
import { HashGenerator } from "../../repositories/hash-generator";
import { PasswordResetTokensRepository } from "../../repositories/password-reset-tokens-repository";
import { TokenHasher } from "../../repositories/token-hasher";
import { UnitOfWork } from "../../repositories/unit-of-work";
import { UsersRepository } from "../../repositories/users-repository";
import {
  PasswordResetAuditContext,
  PasswordResetAuditLogger,
} from "../../services/password-reset-audit-logger";

type ResetPasswordWithTokenUseCaseRequest = {
  token: string;
  newPassword: string;
} & PasswordResetAuditContext;

type ResetPasswordWithTokenUseCaseResponse = Either<
  InvalidOrExpiredPasswordResetTokenError,
  { user: User }
>;

@Injectable()
export class ResetPasswordWithTokenUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private passwordResetTokensRepository: PasswordResetTokensRepository,
    private tokenHasher: TokenHasher,
    private hashGenerator: HashGenerator,
    private passwordResetAuditLogger: PasswordResetAuditLogger,
    private unitOfWork: UnitOfWork,
  ) {}

  async execute({
    token,
    newPassword,
    ipAddress = null,
    userAgent = null,
  }: ResetPasswordWithTokenUseCaseRequest): Promise<ResetPasswordWithTokenUseCaseResponse> {
    const hashedToken = await this.tokenHasher.hash(token);
    const resetToken =
      await this.passwordResetTokensRepository.findByTokenHash(hashedToken);

    if (!resetToken || resetToken.isExpired(new Date())) {
      this.passwordResetAuditLogger.log({
        event: "password_reset.confirm_failed",
        outcome: "failure",
        reason: "invalid_or_expired_token",
        ipAddress,
        userAgent,
      });

      return left(new InvalidOrExpiredPasswordResetTokenError());
    }

    const user = await this.usersRepository.findById(
      resetToken.userId.toString(),
    );

    if (!user) {
      this.passwordResetAuditLogger.log({
        event: "password_reset.confirm_failed",
        outcome: "failure",
        reason: "invalid_or_expired_token",
        ipAddress,
        userAgent,
      });

      return left(new InvalidOrExpiredPasswordResetTokenError());
    }

    const hashedPassword = await this.hashGenerator.hash(newPassword);

    await this.unitOfWork.execute(async () => {
      user.changePassword(hashedPassword);
      await this.usersRepository.save(user);
      await this.passwordResetTokensRepository.deleteByUserId(
        user.id.toString(),
      );
    });

    this.passwordResetAuditLogger.log({
      event: "password_reset.completed",
      outcome: "success",
      userId: user.id.toString(),
      ipAddress,
      userAgent,
    });

    return right({ user });
  }
}
