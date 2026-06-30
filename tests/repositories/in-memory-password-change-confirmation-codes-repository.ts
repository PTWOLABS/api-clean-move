import { PasswordChangeConfirmationCode } from "../../src/modules/accounts/domain/entities/password-change-confirmation-code";
import { PasswordChangeConfirmationCodesRepository } from "../../src/modules/application/repositories/password-change-confirmation-codes-repository";

export class InMemoryPasswordChangeConfirmationCodesRepository implements PasswordChangeConfirmationCodesRepository {
  public items: PasswordChangeConfirmationCode[] = [];

  async upsert(code: PasswordChangeConfirmationCode): Promise<void> {
    const userId = code.userId.toString();
    this.items = this.items.filter((item) => item.userId.toString() !== userId);
    this.items.push(code);
  }

  async findByUserId(
    userId: string,
  ): Promise<PasswordChangeConfirmationCode | null> {
    const code = this.items.find((item) => item.userId.toString() === userId);

    return code ?? null;
  }

  async deleteByUserId(userId: string): Promise<void> {
    this.items = this.items.filter((item) => item.userId.toString() !== userId);
  }
}
