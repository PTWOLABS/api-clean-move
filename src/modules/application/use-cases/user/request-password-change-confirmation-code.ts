import { Injectable } from "@nestjs/common";

import { EnvService } from "../../../../infra/env/env.service";
import { Either, left, right } from "../../../../shared/either";
import { InvalidCurrentPasswordError } from "../../../../shared/errors/invalid-current-password-error";
import { InvalidUserPasswordUpdateInputError } from "../../../../shared/errors/invalid-user-password-update-input-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { SamePasswordError } from "../../../../shared/errors/same-password-error";
import { PasswordChangeConfirmationCode } from "../../../accounts/domain/entities/password-change-confirmation-code";
import { EmailSender } from "../../gateways/email-sender";
import { buildPasswordChangeConfirmationEmail } from "../../mail/templates/password-change-confirmation-email";
import { ConfirmationCodeGenerator } from "../../repositories/confirmation-code-generator";
import { HashGenerator } from "../../repositories/hash-generator";
import { PasswordChangeConfirmationCodesRepository } from "../../repositories/password-change-confirmation-codes-repository";
import { TokenHasher } from "../../repositories/token-hasher";
import { UsersRepository } from "../../repositories/users-repository";
import { PasswordChangeValidator } from "../../services/password-change-validator";

type RequestPasswordChangeConfirmationCodeUseCaseRequest = {
  userId: string;
  newPassword: string;
  currentPassword?: string;
};

type RequestPasswordChangeConfirmationCodeUseCaseResponse = Either<
  | ResourceNotFoundError
  | InvalidUserPasswordUpdateInputError
  | InvalidCurrentPasswordError
  | SamePasswordError,
  void
>;

@Injectable()
export class RequestPasswordChangeConfirmationCodeUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private passwordChangeConfirmationCodesRepository: PasswordChangeConfirmationCodesRepository,
    private confirmationCodeGenerator: ConfirmationCodeGenerator,
    private tokenHasher: TokenHasher,
    private hashGenerator: HashGenerator,
    private emailSender: EmailSender,
    private passwordChangeValidator: PasswordChangeValidator,
    private readonly envService: EnvService,
  ) {}

  async execute({
    userId,
    newPassword,
    currentPassword,
  }: RequestPasswordChangeConfirmationCodeUseCaseRequest): Promise<RequestPasswordChangeConfirmationCodeUseCaseResponse> {
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

    const plainCode = this.confirmationCodeGenerator.generate();
    const hashedCode = await this.tokenHasher.hash(plainCode);
    const pendingPasswordHash = await this.hashGenerator.hash(newPassword);
    const codeTtlMs = this.envService.get(
      "PASSWORD_CHANGE_CONFIRMATION_CODE_TTL_IN_MS",
    );
    const now = new Date();
    const expiresAt = new Date(now.getTime() + codeTtlMs);

    const confirmationCode = PasswordChangeConfirmationCode.create({
      userId: user.id,
      hashedCode,
      pendingPasswordHash,
      expiresAt,
      failedAttempts: 0,
    });

    await this.passwordChangeConfirmationCodesRepository.upsert(
      confirmationCode,
    );

    const emailContent = buildPasswordChangeConfirmationEmail({
      confirmationCode: plainCode,
      logoUrl: this.envService.get("EMAIL_LOGO_URL"),
      expiresInMinutes: Math.round(codeTtlMs / 60_000),
    });

    try {
      await this.emailSender.send({
        to: user.email.getValue(),
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    } catch (error) {
      await this.passwordChangeConfirmationCodesRepository.deleteByUserId(
        userId,
      );
      throw error;
    }

    return right(undefined);
  }
}
