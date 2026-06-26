import type {
  PasswordResetToken as PrismaPasswordResetToken,
  Prisma,
} from "../../../../generated/prisma/client";
import { PasswordResetToken } from "../../../../modules/accounts/domain/entities/password-reset-token";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";

export class PrismaPasswordResetTokenMapper {
  static toDomain(raw: PrismaPasswordResetToken): PasswordResetToken {
    return PasswordResetToken.create(
      {
        userId: new UniqueEntityId(raw.userId),
        hashedToken: raw.hashedToken,
        expiresAt: raw.expiresAt,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPrisma(
    raw: PasswordResetToken,
  ): Prisma.PasswordResetTokenUncheckedCreateInput {
    return {
      id: raw.id.toString(),
      userId: raw.userId.toString(),
      hashedToken: raw.hashedToken,
      expiresAt: raw.expiresAt,
    };
  }
}
