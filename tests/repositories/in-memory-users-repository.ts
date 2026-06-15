import type { OAuthProvider } from "../../src/modules/accounts/domain/value-objects/oauth-provider";
import { User } from "../../src/modules/accounts/domain/entities/user";
import { UsersRepository } from "../../src/modules/application/repositories/users-repository";

export class InMemoryUsersRepository implements UsersRepository {
  public items: User[] = [];

  async create(user: User): Promise<void> {
    this.items.push(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = this.items.find((item) => item.email.toString() === email);

    if (!user) {
      return null;
    }

    return user;
  }

  async findById(userId: string): Promise<User | null> {
    const user = this.items.find((item) => item.id.toString() === userId);

    if (!user) {
      return null;
    }

    return user;
  }

  async findManyByIds(userIds: string[]): Promise<User[]> {
    if (userIds.length === 0) {
      return [];
    }

    const idSet = new Set(userIds);

    return this.items.filter((item) => idSet.has(item.id.toString()));
  }

  async findByProviderAndSubject(
    provider: OAuthProvider,
    subjectId: string,
  ): Promise<User | null> {
    const user = this.items.find((item) =>
      item.socialAccounts.some(
        (link) => link.provider === provider && link.subjectId === subjectId,
      ),
    );

    return user ?? null;
  }

  async save(user: User): Promise<void> {
    const userIndex = this.items.findIndex((item) => item.id.equals(user.id));

    if (userIndex < 0) {
      return;
    }

    this.items[userIndex] = user;
  }
}
