import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../../generated/prisma/client";
import { User } from "../../../../modules/accounts/domain/entities/user";
import { OAuthProvider } from "../../../../modules/accounts/domain/value-objects/oauth-provider";
import { UsersRepository } from "../../../../modules/application/repositories/users-repository";
import { PrismaUserMapper } from "../mappers/prisma-user-mapper";
import { PrismaUnitOfWork } from "../prisma-unit-of-work";
import { rethrowPrismaRepositoryError } from "../prisma-repository-error-handler";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private prisma: PrismaService) {}

  async create(user: User): Promise<void> {
    const data = PrismaUserMapper.toPrisma(user);

    try {
      await PrismaUnitOfWork.getClient(this.prisma).user.create({
        data,
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).user.findUnique({
        where: {
          email,
        },
        include: {
          socialAccounts: true,
        },
      });

      if (!user) return null;

      return PrismaUserMapper.toDomain(user);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findById(_userId: string): Promise<User | null> {
    try {
      const user = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).user.findUnique({
        where: {
          id: _userId,
        },
        include: {
          socialAccounts: true,
        },
      });

      if (!user) return null;

      return PrismaUserMapper.toDomain(user);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findByProviderAndSubject(
    provider: OAuthProvider,
    subjectId: string,
  ): Promise<User | null> {
    try {
      const user = await PrismaUnitOfWork.getClient(this.prisma).user.findFirst(
        {
          where: {
            socialAccounts: {
              some: {
                provider,
                subjectId,
              },
            },
          },
          include: {
            socialAccounts: true,
          },
        },
      );

      if (!user) return null;

      return PrismaUserMapper.toDomain(user);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async save(user: User): Promise<void> {
    const address =
      user.address === null
        ? Prisma.JsonNull
        : ({
            street: user.address.street,
            country: user.address.country,
            state: user.address.state,
            zipCode: user.address.zipCode,
            city: user.address.city,
            ...(user.address.complement !== null
              ? { complement: user.address.complement }
              : {}),
          } satisfies Prisma.InputJsonObject);

    try {
      await PrismaUnitOfWork.getClient(this.prisma).$transaction([
        PrismaUnitOfWork.getClient(this.prisma).socialAccount.deleteMany({
          where: {
            userId: user.id.toString(),
          },
        }),
        PrismaUnitOfWork.getClient(this.prisma).user.update({
          where: {
            id: user.id.toString(),
          },
          data: {
            name: user.name,
            email: user.email.toString(),
            hashedPassword: user.hashedPassword,
            role: user.role,
            phone: user.phone?.toString() ?? null,
            address,
            socialAccounts: {
              create: user.socialAccounts.map((socialAccount) => ({
                provider: socialAccount.provider,
                subjectId: socialAccount.subjectId,
              })),
            },
          },
        }),
      ]);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }
}
