import { Injectable } from "@nestjs/common";
import { EstablishmentsRepository } from "../../../../modules/application/repositories/establishment-repository";
import { ServiceCategory } from "../../../../modules/catalog/domain/value-objects/service-category";
import { Establishment } from "../../../../modules/establishments/domain/entities/establishment";
import { PrismaUnitOfWork } from "../prisma-unit-of-work";
import { rethrowPrismaRepositoryError } from "../prisma-repository-error-handler";
import { PrismaService } from "../prisma.service";
import { PrismaEstablishmentMapper } from "../mappers/prisma-establishment-mapper";

@Injectable()
export class PrismaEstablishmentRepository implements EstablishmentsRepository {
  constructor(private prisma: PrismaService) {}

  async create(establishment: Establishment): Promise<void> {
    const data = PrismaEstablishmentMapper.toPrisma(establishment);

    try {
      await PrismaUnitOfWork.getClient(this.prisma).establishment.create({
        data,
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async save(establishment: Establishment): Promise<void> {
    const data = PrismaEstablishmentMapper.toPrismaUpdate(establishment);

    try {
      await PrismaUnitOfWork.getClient(this.prisma).establishment.update({
        where: {
          id: establishment.id.toString(),
        },
        data,
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findByCnpj(cnpj: string): Promise<Establishment | null> {
    try {
      const establishment = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).establishment.findUnique({
        where: {
          cnpj,
        },
      });

      if (!establishment) return null;

      return PrismaEstablishmentMapper.toDomain(establishment);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findById(id: string): Promise<Establishment | null> {
    try {
      const establishment = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).establishment.findUnique({
        where: {
          id,
        },
      });

      if (!establishment) {
        return null;
      }

      return PrismaEstablishmentMapper.toDomain(establishment);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findByOwnerId(ownerId: string): Promise<Establishment | null> {
    try {
      const establishment = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).establishment.findUnique({
        where: {
          ownerId,
        },
      });

      if (!establishment) {
        return null;
      }

      return PrismaEstablishmentMapper.toDomain(establishment);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findBySlug(slug: string): Promise<Establishment | null> {
    try {
      const establishment = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).establishment.findUnique({
        where: {
          slug,
        },
      });

      if (!establishment) {
        return null;
      }

      return PrismaEstablishmentMapper.toDomain(establishment);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }
  async findBySlugOrCnpj(
    slug: string,
    cnpj: string,
  ): Promise<Establishment | null> {
    try {
      const establishment = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).establishment.findFirst({
        where: {
          OR: [{ slug }, { cnpj }],
        },
      });

      if (!establishment) return null;

      return PrismaEstablishmentMapper.toDomain(establishment);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }
  async findMany(filters?: {
    establishmentName?: string;
    serviceCategory?: ServiceCategory;
  }): Promise<Establishment[]> {
    try {
      const establishments = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).establishment.findMany({
        where: {
          ...(filters?.establishmentName
            ? {
                corporateName: filters.establishmentName,
              }
            : {}),
          ...(filters?.serviceCategory
            ? {
                services: {
                  some: {
                    category: filters.serviceCategory,
                  },
                },
              }
            : {}),
        },
        orderBy: {
          corporateName: "asc",
        },
      });

      return establishments.map((establishment) =>
        PrismaEstablishmentMapper.toDomain(establishment),
      );
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }
}
