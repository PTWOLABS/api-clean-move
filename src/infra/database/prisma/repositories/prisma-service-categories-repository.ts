import { Injectable } from "@nestjs/common";

import { Prisma } from "../../../../generated/prisma/client";
import {
  ServiceCategoriesRepository,
  ServiceCategoryFilters,
  ServiceCategoryOption,
  ServiceCategoryOptionsFilters,
} from "../../../../modules/application/repositories/service-categories-repository";
import { ServiceCategory } from "../../../../modules/catalog/domain/entities/service-category";
import { PrismaServiceCategoryMapper } from "../mappers/prisma-service-category-mapper";
import { rethrowPrismaRepositoryError } from "../prisma-repository-error-handler";
import { PrismaUnitOfWork } from "../prisma-unit-of-work";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaServiceCategoriesRepository implements ServiceCategoriesRepository {
  constructor(private prisma: PrismaService) {}

  async create(category: ServiceCategory): Promise<void> {
    const data = PrismaServiceCategoryMapper.toPrisma(category);

    try {
      await PrismaUnitOfWork.getClient(this.prisma).serviceCategory.create({
        data,
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async createMany(categories: ServiceCategory[]): Promise<void> {
    if (categories.length === 0) {
      return;
    }

    try {
      await PrismaUnitOfWork.getClient(this.prisma).serviceCategory.createMany({
        data: categories.map((category) =>
          PrismaServiceCategoryMapper.toPrisma(category),
        ),
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findById(id: string): Promise<ServiceCategory | null> {
    try {
      const category = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).serviceCategory.findUnique({
        where: { id },
      });

      if (!category) {
        return null;
      }

      return PrismaServiceCategoryMapper.toDomain(category);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<ServiceCategory | null> {
    try {
      const category = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).serviceCategory.findFirst({
        where: { id, establishmentId },
      });

      if (!category) {
        return null;
      }

      return PrismaServiceCategoryMapper.toDomain(category);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findByNameAndEstablishmentId(
    name: string,
    establishmentId: string,
  ): Promise<ServiceCategory | null> {
    try {
      const category = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).serviceCategory.findFirst({
        where: {
          establishmentId,
          name: {
            equals: name.trim(),
            mode: "insensitive",
          },
          deletedAt: null,
        },
      });

      if (!category) {
        return null;
      }

      return PrismaServiceCategoryMapper.toDomain(category);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findManyByEstablishmentId(
    establishmentId: string,
    filters?: ServiceCategoryFilters,
  ): Promise<ServiceCategory[]> {
    try {
      const categories = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).serviceCategory.findMany({
        where: {
          establishmentId,
          ...(filters?.includeDeleted ? {} : { deletedAt: null }),
        },
        orderBy: { name: "asc" },
      });

      return categories.map((category) =>
        PrismaServiceCategoryMapper.toDomain(category),
      );
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findOptionsByEstablishmentId(
    establishmentId: string,
    filters?: ServiceCategoryOptionsFilters,
  ): Promise<ServiceCategoryOption[]> {
    const limit = filters?.limit ?? 20;
    const search = filters?.search?.trim();

    const where: Prisma.ServiceCategoryWhereInput = {
      establishmentId,
      deletedAt: null,
      ...(search
        ? {
            name: {
              contains: search,
              mode: "insensitive",
            },
          }
        : {}),
    };

    try {
      const categories = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).serviceCategory.findMany({
        where,
        orderBy: { name: "asc" },
        take: limit,
        select: {
          id: true,
          name: true,
        },
      });

      return categories.map((category) => ({
        id: category.id,
        label: category.name,
      }));
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async countActiveServicesByCategoryId(categoryId: string): Promise<number> {
    try {
      return await PrismaUnitOfWork.getClient(this.prisma).service.count({
        where: {
          categoryId,
          deletedAt: null,
          isActive: true,
        },
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async save(category: ServiceCategory): Promise<void> {
    const data = PrismaServiceCategoryMapper.toPrismaUpdate(category);

    try {
      await PrismaUnitOfWork.getClient(this.prisma).serviceCategory.update({
        where: { id: category.id.toString() },
        data,
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }
}
