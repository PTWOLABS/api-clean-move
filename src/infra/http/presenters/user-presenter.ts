import { User } from "../../../modules/accounts/domain/entities/user";

export class UserPresenter {
  static toHTTP(user: User) {
    const address = user.address
      ? {
          street: user.address.street,
          complement: user.address.complement,
          country: user.address.country,
          state: user.address.state,
          zipCode: user.address.zipCode,
          city: user.address.city,
        }
      : null;

    return {
      id: user.id.toString(),
      name: user.name,
      email: user.email.toString(),
      role: user.role,
      phone: user.phone ? user.phone.toString() : null,
      address,
      socialAccounts: user.socialAccounts.map((link) => ({
        provider: link.provider,
        subjectId: link.subjectId,
      })),
      profileComplete: user.isProfileComplete(),
      createdAt: user.createdAt?.toISOString() ?? null,
      updatedAt: user.updatedAt?.toISOString() ?? null,
    };
  }
}
