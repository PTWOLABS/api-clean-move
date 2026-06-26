import { PasswordResetToken } from "../../src/modules/accounts/domain/entities/password-reset-token";
import { PasswordResetTokensRepository } from "../../src/modules/application/repositories/password-reset-tokens-repository";

export class InMemoryPasswordResetTokensRepository implements PasswordResetTokensRepository {
  public items: PasswordResetToken[] = [];

  async upsert(token: PasswordResetToken): Promise<void> {
    const userId = token.userId.toString();
    this.items = this.items.filter((t) => t.userId.toString() !== userId);
    this.items.push(token);
  }

  async findByTokenHash(
    hashedToken: string,
  ): Promise<PasswordResetToken | null> {
    const token = this.items.find((t) => t.hashedToken === hashedToken);

    return token ?? null;
  }

  async deleteByUserId(userId: string): Promise<void> {
    this.items = this.items.filter((t) => t.userId.toString() !== userId);
  }
}
