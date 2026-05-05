import {
  CustomerVehicle as PrismaCustomerVehicle,
  Prisma,
} from "../../../../generated/prisma/client";
import { CustomerVehicle } from "../../../../modules/customer/domain/entities/customer-vehicle";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";

export class PrismaCustomerVehicleMapper {
  static toDomain(raw: PrismaCustomerVehicle): CustomerVehicle {
    return CustomerVehicle.create(
      {
        establishmentId: new UniqueEntityId(raw.establishmentId),
        customerId: new UniqueEntityId(raw.customerId),
        imageUrl: raw.imageUrl,
        plate: raw.plate,
        brand: raw.brand,
        model: raw.model,
        color: raw.color,
        year: raw.year,
        notes: raw.notes,
        deletedAt: raw.deletedAt,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPrisma(
    raw: CustomerVehicle,
  ): Prisma.CustomerVehicleUncheckedCreateInput {
    return {
      id: raw.id.toString(),
      establishmentId: raw.establishmentId.toString(),
      customerId: raw.customerId.toString(),
      imageUrl: raw.imageUrl,
      plate: raw.plate,
      brand: raw.brand,
      model: raw.model,
      color: raw.color,
      year: raw.year,
      notes: raw.notes,
      deletedAt: raw.deletedAt,
      ...(raw.createdAt ? { createdAt: raw.createdAt } : {}),
      ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
    };
  }

  static toPrismaUpdate(
    raw: CustomerVehicle,
  ): Prisma.CustomerVehicleUncheckedUpdateInput {
    return {
      imageUrl: raw.imageUrl,
      plate: raw.plate,
      brand: raw.brand,
      model: raw.model,
      color: raw.color,
      year: raw.year,
      notes: raw.notes,
      deletedAt: raw.deletedAt,
      ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
    };
  }
}
