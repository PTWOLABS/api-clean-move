import {
  Prisma,
  Service as PrismaServiceRecord,
} from "../../../../generated/prisma/client";
import { Service } from "../../../../modules/catalog/domain/entities/services";
import { EstimatedDuration } from "../../../../modules/catalog/domain/value-objects/estimated-duration";
import { Money } from "../../../../modules/catalog/domain/value-objects/money";
import { ServiceName } from "../../../../modules/catalog/domain/value-objects/service-name";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";

export class PrismaServiceMapper {
  static toDomain(raw: PrismaServiceRecord): Service {
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
        category: raw.category ?? undefined,
        estimatedDuration: hasEstimatedDuration
          ? EstimatedDuration.create({
              minInMinutes: raw.estimatedDurationMinInMinutes!,
              maxInMinutes: raw.estimatedDurationMaxInMinutes,
            })
          : undefined,
        price: Money.create(raw.priceInCents),
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
      category: raw.category ?? null,
      estimatedDurationMinInMinutes:
        raw.estimatedDuration?.minInMinutes ?? null,
      estimatedDurationMaxInMinutes:
        raw.estimatedDuration?.maxInMinutes ?? null,
      priceInCents: raw.price.amountInCents,
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
      category: raw.category ?? null,
      estimatedDurationMinInMinutes:
        raw.estimatedDuration?.minInMinutes ?? null,
      estimatedDurationMaxInMinutes:
        raw.estimatedDuration?.maxInMinutes ?? null,
      priceInCents: raw.price.amountInCents,
      isActive: raw.isActive,
      deletedAt: raw.deletedAt,
      ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
    };
  }
}
