import {
  Prisma,
  Service as PrismaServiceRecord,
  ServiceCategory as PrismaServiceCategoryRecord,
} from "../../../../generated/prisma/client";
import { Service } from "../../../../modules/catalog/domain/entities/services";
import { EstimatedDuration } from "../../../../modules/catalog/domain/value-objects/estimated-duration";
import { ServicePriceSpecification } from "../../../../modules/catalog/domain/value-objects/service-price-specification";
import { ServiceName } from "../../../../modules/catalog/domain/value-objects/service-name";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";

type PrismaServiceWithCategory = PrismaServiceRecord & {
  category?: PrismaServiceCategoryRecord | null;
};

type PrismaServicePriceFields = Pick<
  PrismaServiceRecord,
  "priceInCents" | "priceRangeMaxInCents" | "priceSpecificationType"
>;

type PrismaServicePricePersistence = Pick<
  Prisma.ServiceUncheckedCreateInput,
  "priceInCents" | "priceRangeMaxInCents" | "priceSpecificationType"
>;

function mapPriceSpecificationFromPrisma(
  raw: PrismaServicePriceFields,
): ServicePriceSpecification {
  switch (raw.priceSpecificationType) {
    case "FIXED":
      return ServicePriceSpecification.create({
        type: "FIXED",
        fixedPriceInCents: raw.priceInCents,
      });
    case "STARTING_AT":
      return ServicePriceSpecification.create({
        type: "STARTING_AT",
        minPriceInCents: raw.priceInCents,
      });
    case "RANGE": {
      const maxPriceInCents = raw.priceRangeMaxInCents;

      if (maxPriceInCents === null) {
        throw new Error(
          "Invalid service record: priceRangeMaxInCents is required for range pricing.",
        );
      }

      return ServicePriceSpecification.create({
        type: "RANGE",
        minPriceInCents: raw.priceInCents,
        maxPriceInCents,
      });
    }
  }
}

function mapPriceSpecificationToPrisma(
  priceSpecification: ServicePriceSpecification,
): PrismaServicePricePersistence {
  return {
    priceInCents: priceSpecification.defaultChargePriceInCents,
    priceSpecificationType: priceSpecification.type,
    priceRangeMaxInCents: priceSpecification.maxPriceInCents ?? null,
  };
}

export class PrismaServiceMapper {
  static toDomain(raw: PrismaServiceWithCategory): Service {
    const hasEstimatedDuration =
      raw.estimatedDurationMinInMinutes !== null ||
      raw.estimatedDurationMaxInMinutes !== null;

    if (
      raw.estimatedDurationMinInMinutes === null &&
      raw.estimatedDurationMaxInMinutes !== null
    ) {
      throw new Error(
        "Invalid service record: estimatedDurationMaxInMinutes requires estimatedDurationMinInMinutes.",
      );
    }

    return Service.create(
      {
        establishmentId: new UniqueEntityId(raw.establishmentId),
        serviceName: ServiceName.create(raw.serviceName),
        description: raw.description ?? undefined,
        category:
          raw.categoryId && raw.category
            ? {
                id: new UniqueEntityId(raw.category.id),
                name: raw.category.name,
              }
            : undefined,
        estimatedDuration: hasEstimatedDuration
          ? EstimatedDuration.create({
              minInMinutes: raw.estimatedDurationMinInMinutes!,
              maxInMinutes: raw.estimatedDurationMaxInMinutes,
            })
          : undefined,
        priceSpecification: mapPriceSpecificationFromPrisma(raw),
        isActive: raw.isActive,
        deletedAt: raw.deletedAt ?? null,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPrisma(raw: Service): Prisma.ServiceUncheckedCreateInput {
    return {
      id: raw.id.toString(),
      establishmentId: raw.establishmentId.toString(),
      serviceName: raw.serviceName.value,
      description: raw.description ?? null,
      categoryId: raw.categoryId?.toString() ?? null,
      estimatedDurationMinInMinutes:
        raw.estimatedDuration?.minInMinutes ?? null,
      estimatedDurationMaxInMinutes:
        raw.estimatedDuration?.maxInMinutes ?? null,
      ...mapPriceSpecificationToPrisma(raw.priceSpecification),
      isActive: raw.isActive,
      deletedAt: raw.deletedAt,
      ...(raw.createdAt ? { createdAt: raw.createdAt } : {}),
      ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
    };
  }

  static toPrismaUpdate(raw: Service): Prisma.ServiceUncheckedUpdateInput {
    return {
      serviceName: raw.serviceName.value,
      description: raw.description ?? null,
      categoryId: raw.categoryId?.toString() ?? null,
      estimatedDurationMinInMinutes:
        raw.estimatedDuration?.minInMinutes ?? null,
      estimatedDurationMaxInMinutes:
        raw.estimatedDuration?.maxInMinutes ?? null,
      ...mapPriceSpecificationToPrisma(raw.priceSpecification),
      isActive: raw.isActive,
      deletedAt: raw.deletedAt,
      ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
    };
  }
}
