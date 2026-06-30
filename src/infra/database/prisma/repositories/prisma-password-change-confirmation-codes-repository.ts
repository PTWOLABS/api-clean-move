import { Injectable } from "@nestjs/common";

import { PasswordChangeConfirmationCode } from "../../../../modules/accounts/domain/entities/password-change-confirmation-code";
import { PasswordChangeConfirmationCodesRepository } from "../../../../modules/application/repositories/password-change-confirmation-codes-repository";
import { PrismaPasswordChangeConfirmationCodeMapper } from "../mappers/prisma-password-change-confirmation-code-mapper";
import { PrismaUnitOfWork } from "../prisma-unit-of-work";
import { rethrowPrismaRepositoryError } from "../prisma-repository-error-handler";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaPasswordChangeConfirmationCodesRepository implements PasswordChangeConfirmationCodesRepository {
  constructor(private prisma: PrismaService) {}

  async upsert(code: PasswordChangeConfirmationCode): Promise<void> {
    const data = PrismaPasswordChangeConfirmationCodeMapper.toPrisma(code);

    try {
      await PrismaUnitOfWork.getClient(
        this.prisma,
      ).passwordChangeConfirmationCode.upsert({
        where: {
          userId: code.userId.toString(),
        },
        create: data,
        update: {
          hashedCode: data.hashedCode,
          pendingPasswordHash: data.pendingPasswordHash,
          failedAttempts: code.failedAttempts,
          expiresAt: data.expiresAt,
        },
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findByUserId(
    userId: string,
  ): Promise<PasswordChangeConfirmationCode | null> {
    try {
      const code = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).passwordChangeConfirmationCode.findUnique({
        where: {
          userId,
        },
      });

      if (!code) {
        return null;
      }

      return PrismaPasswordChangeConfirmationCodeMapper.toDomain(code);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async deleteByUserId(userId: string): Promise<void> {
    try {
      await PrismaUnitOfWork.getClient(
        this.prisma,
      ).passwordChangeConfirmationCode.deleteMany({
        where: {
          userId,
        },
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }
}
