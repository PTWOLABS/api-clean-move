import {
  Prisma,
  ServiceCategory as PrismaServiceCategoryRecord,
} from "../../../../generated/prisma/client";
import { ServiceCategory } from "../../../../modules/catalog/domain/entities/service-category";
import { CategoryName } from "../../../../modules/catalog/domain/value-objects/category-name";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";

export class PrismaServiceCategoryMapper {
  static toDomain(raw: PrismaServiceCategoryRecord): ServiceCategory {
    return ServiceCategory.create(
      {
        establishmentId: new UniqueEntityId(raw.establishmentId),
        name: CategoryName.create(raw.name),
        deletedAt: raw.deletedAt ?? null,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPrisma(
    raw: ServiceCategory,
  ): Prisma.ServiceCategoryUncheckedCreateInput {
    return {
      id: raw.id.toString(),
      establishmentId: raw.establishmentId.toString(),
      name: raw.name.value,
      deletedAt: raw.deletedAt,
      ...(raw.createdAt ? { createdAt: raw.createdAt } : {}),
      ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
    };
  }

  static toPrismaUpdate(
    raw: ServiceCategory,
  ): Prisma.ServiceCategoryUncheckedUpdateInput {
    return {
      name: raw.name.value,
      deletedAt: raw.deletedAt,
      ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
    };
  }
}
