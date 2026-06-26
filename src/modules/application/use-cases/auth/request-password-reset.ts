import { Injectable } from "@nestjs/common";

import { EnvService } from "../../../../infra/env/env.service";
import { PasswordResetToken } from "../../../accounts/domain/entities/password-reset-token";
import {
  Email,
  InvalidEmailError,
} from "../../../accounts/domain/value-objects/email";
import { buildPasswordResetEmail } from "../../mail/templates/password-reset-email";
import { EmailSender } from "../../gateways/email-sender";
import { PasswordResetTokensRepository } from "../../repositories/password-reset-tokens-repository";
import { ResetTokenGenerator } from "../../repositories/reset-token-generator";
import { TokenHasher } from "../../repositories/token-hasher";
import { UsersRepository } from "../../repositories/users-repository";
import {
  PasswordResetAuditContext,
  PasswordResetAuditLogger,
} from "../../services/password-reset-audit-logger";

const DEFAULT_TOKEN_TTL_MS = 15 * 60 * 1000;

type RequestPasswordResetUseCaseRequest = {
  email: string;
} & PasswordResetAuditContext;

@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private passwordResetTokensRepository: PasswordResetTokensRepository,
    private tokenHasher: TokenHasher,
    private emailSender: EmailSender,
    private resetTokenGenerator: ResetTokenGenerator,
    private passwordResetAuditLogger: PasswordResetAuditLogger,
    private readonly envService: EnvService,
  ) {}

  async execute({
    email,
    ipAddress = null,
    userAgent = null,
  }: RequestPasswordResetUseCaseRequest): Promise<void> {
    let parsedEmail: Email;

    try {
      parsedEmail = new Email(email);
    } catch (error) {
      if (error instanceof InvalidEmailError) {
        return;
      }

      throw error;
    }

    this.passwordResetAuditLogger.log({
      event: "password_reset.requested",
      outcome: "success",
      ipAddress,
      userAgent,
    });

    const user = await this.usersRepository.findByEmail(parsedEmail.toString());

    if (!user) {
      this.passwordResetAuditLogger.log({
        event: "password_reset.requested",
        outcome: "skipped",
        reason: "user_not_found",
        ipAddress,
        userAgent,
      });

      return;
    }

    const plainToken = this.resetTokenGenerator.generate();
    const hashedToken = await this.tokenHasher.hash(plainToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DEFAULT_TOKEN_TTL_MS);

    const token = PasswordResetToken.create({
      userId: user.id,
      hashedToken,
      expiresAt,
    });

    await this.passwordResetTokensRepository.upsert(token);

    const emailContent = buildPasswordResetEmail({
      resetPath: this.envService.get("PASSWORD_RESET_PATH"),
      token: plainToken,
    });

    await this.emailSender.send({
      to: user.email.getValue(),
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    this.passwordResetAuditLogger.log({
      event: "password_reset.token_issued",
      outcome: "success",
      userId: user.id.toString(),
      ipAddress,
      userAgent,
    });
  }
}
