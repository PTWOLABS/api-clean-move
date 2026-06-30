import { Injectable } from "@nestjs/common";

import { EnvService } from "../../../../infra/env/env.service";
import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { PasswordChangeConfirmationCode } from "../../../accounts/domain/entities/password-change-confirmation-code";
import { buildPasswordChangeConfirmationEmail } from "../../mail/templates/password-change-confirmation-email";
import { EmailSender } from "../../gateways/email-sender";
import { ConfirmationCodeGenerator } from "../../repositories/confirmation-code-generator";
import { PasswordChangeConfirmationCodesRepository } from "../../repositories/password-change-confirmation-codes-repository";
import { TokenHasher } from "../../repositories/token-hasher";
import { UsersRepository } from "../../repositories/users-repository";
import { PasswordChangeValidator } from "../../services/password-change-validator";
import { InvalidUserPasswordUpdateInputError } from "../user/update-user-password";
import { InvalidCurrentPasswordError } from "../../../../shared/errors/invalid-current-password-error";
import { SamePasswordError } from "../../../../shared/errors/same-password-error";

const DEFAULT_CODE_TTL_MS = 15 * 60 * 1000;

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
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DEFAULT_CODE_TTL_MS);

    const confirmationCode = PasswordChangeConfirmationCode.create({
      userId: user.id,
      hashedCode,
      expiresAt,
    });

    await this.passwordChangeConfirmationCodesRepository.upsert(
      confirmationCode,
    );

    const emailContent = buildPasswordChangeConfirmationEmail({
      confirmationCode: plainCode,
      logoUrl: this.envService.get("EMAIL_LOGO_URL"),
    });

    await this.emailSender.send({
      to: user.email.getValue(),
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    return right(undefined);
  }
}
