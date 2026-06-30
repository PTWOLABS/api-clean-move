import type {
  PasswordChangeConfirmationCode as PrismaPasswordChangeConfirmationCode,
  Prisma,
} from "../../../../generated/prisma/client";
import { PasswordChangeConfirmationCode } from "../../../../modules/accounts/domain/entities/password-change-confirmation-code";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";

export class PrismaPasswordChangeConfirmationCodeMapper {
  static toDomain(
    raw: PrismaPasswordChangeConfirmationCode,
  ): PasswordChangeConfirmationCode {
    return PasswordChangeConfirmationCode.create(
      {
        userId: new UniqueEntityId(raw.userId),
        hashedCode: raw.hashedCode,
        expiresAt: raw.expiresAt,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPrisma(
    raw: PasswordChangeConfirmationCode,
  ): Prisma.PasswordChangeConfirmationCodeUncheckedCreateInput {
    return {
      id: raw.id.toString(),
      userId: raw.userId.toString(),
      hashedCode: raw.hashedCode,
      expiresAt: raw.expiresAt,
    };
  }
}
