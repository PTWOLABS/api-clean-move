import { PasswordResetToken } from "../../accounts/domain/entities/password-reset-token";

export abstract class PasswordResetTokensRepository {
  abstract upsert(token: PasswordResetToken): Promise<void>;
  abstract findByUserId(userId: string): Promise<PasswordResetToken | null>;
  abstract findByTokenHash(
    hashedToken: string,
  ): Promise<PasswordResetToken | null>;
  abstract deleteByUserId(userId: string): Promise<void>;
}
