import { Injectable } from "@nestjs/common";

import { PasswordResetToken } from "../../../../modules/accounts/domain/entities/password-reset-token";
import { PasswordResetTokensRepository } from "../../../../modules/application/repositories/password-reset-tokens-repository";
import { PrismaPasswordResetTokenMapper } from "../mappers/prisma-password-reset-token-mapper";
import { PrismaUnitOfWork } from "../prisma-unit-of-work";
import { rethrowPrismaRepositoryError } from "../prisma-repository-error-handler";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaPasswordResetTokensRepository implements PasswordResetTokensRepository {
  constructor(private prisma: PrismaService) {}

  async upsert(token: PasswordResetToken): Promise<void> {
    const data = PrismaPasswordResetTokenMapper.toPrisma(token);

    try {
      await PrismaUnitOfWork.getClient(this.prisma).passwordResetToken.upsert({
        where: {
          userId: token.userId.toString(),
        },
        create: data,
        update: {
          hashedToken: data.hashedToken,
          expiresAt: data.expiresAt,
        },
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findByUserId(userId: string): Promise<PasswordResetToken | null> {
    try {
      const token = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).passwordResetToken.findUnique({
        where: {
          userId,
        },
      });

      if (!token) {
        return null;
      }

      return PrismaPasswordResetTokenMapper.toDomain(token);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findByTokenHash(
    hashedToken: string,
  ): Promise<PasswordResetToken | null> {
    try {
      const token = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).passwordResetToken.findFirst({
        where: {
          hashedToken,
        },
      });

      if (!token) {
        return null;
      }

      return PrismaPasswordResetTokenMapper.toDomain(token);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async deleteByUserId(userId: string): Promise<void> {
    try {
      await PrismaUnitOfWork.getClient(
        this.prisma,
      ).passwordResetToken.deleteMany({
        where: {
          userId,
        },
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }
}
