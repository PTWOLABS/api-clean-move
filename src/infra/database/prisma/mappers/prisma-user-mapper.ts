import z from "zod";
import {
  Prisma,
  User as PrismaUser,
  SocialAccount as PrismaSocialAccount,
} from "../../../../generated/prisma/client";
import { User } from "../../../../modules/accounts/domain/entities/user";
import { Address } from "../../../../modules/accounts/domain/value-objects/address";
import { Email } from "../../../../modules/accounts/domain/value-objects/email";
import { Phone } from "../../../../modules/accounts/domain/value-objects/phone";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";

const addressSchema = z.object({
  street: z.string(),
  country: z.string(),
  state: z.string(),
  zipCode: z.string(),
  city: z.string(),
  complement: z.string().nullable().optional(),
});

export class PrismaUserMapper {
  static toDomain(
    raw: PrismaUser & { socialAccounts: PrismaSocialAccount[] },
  ): User {
    const address =
      raw.address === null
        ? null
        : Address.create(addressSchema.parse(raw.address));

    return User.create(
      {
        name: raw.name,
        email: new Email(raw.email),
        hashedPassword: raw.hashedPassword,
        role: raw.role,
        phone: raw.phone ? Phone.create(raw.phone) : null,
        address,
        socialAccounts: raw.socialAccounts.map((link) => ({
          provider: link.provider,
          subjectId: link.subjectId,
        })),
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPrisma(raw: User): Prisma.UserUncheckedCreateInput {
    const address =
      raw.address === null
        ? undefined
        : ({
            street: raw.address.street,
            country: raw.address.country,
            state: raw.address.state,
            zipCode: raw.address.zipCode,
            city: raw.address.city,
            ...(raw.address.complement !== null
              ? { complement: raw.address.complement }
              : {}),
          } satisfies Prisma.InputJsonObject);

    return {
      id: raw.id.toString(),
      name: raw.name,
      email: raw.email.toString(),
      hashedPassword: raw.hashedPassword,
      role: raw.role,
      phone: raw.phone?.toString() ?? null,
      socialAccounts: {
        create: raw.socialAccounts.map((socialAccount) => ({
          provider: socialAccount.provider,
          subjectId: socialAccount.subjectId,
        })),
      },
      ...(address && { address }),
    };
  }
}
