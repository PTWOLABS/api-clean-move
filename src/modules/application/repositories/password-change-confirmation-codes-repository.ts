import { PasswordChangeConfirmationCode } from "../../accounts/domain/entities/password-change-confirmation-code";

export abstract class PasswordChangeConfirmationCodesRepository {
  abstract upsert(code: PasswordChangeConfirmationCode): Promise<void>;
  abstract findByUserId(
    userId: string,
  ): Promise<PasswordChangeConfirmationCode | null>;
  abstract deleteByUserId(userId: string): Promise<void>;
}
