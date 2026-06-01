import { Injectable } from "@nestjs/common";

import {
  CustomerVehicleFilters,
  CustomerVehicleOption,
  CustomerVehicleOptionsFilters,
  CustomerVehiclesRepository,
  EstablishmentCustomerVehicleFilters,
  PaginatedCustomerVehicles,
} from "../../../../modules/application/repositories/customer-vehicles-repository";
import { Prisma } from "../../../../generated/prisma/client";
import { CustomerVehicle } from "../../../../modules/customer/domain/entities/customer-vehicle";
import { PrismaCustomerVehicleMapper } from "../mappers/prisma-customer-vehicle-mapper";
import { rethrowPrismaRepositoryError } from "../prisma-repository-error-handler";
import { PrismaUnitOfWork } from "../prisma-unit-of-work";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaCustomerVehiclesRepository implements CustomerVehiclesRepository {
  constructor(private prisma: PrismaService) {}

  async create(vehicle: CustomerVehicle): Promise<void> {
    const data = PrismaCustomerVehicleMapper.toPrisma(vehicle);

    try {
      await PrismaUnitOfWork.getClient(this.prisma).customerVehicle.create({
        data,
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findById(id: string): Promise<CustomerVehicle | null> {
    try {
      const vehicle = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).customerVehicle.findUnique({
        where: {
          id,
        },
      });

      if (!vehicle) {
        return null;
      }

      return PrismaCustomerVehicleMapper.toDomain(vehicle);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<CustomerVehicle | null> {
    try {
      const vehicle = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).customerVehicle.findFirst({
        where: {
          id,
          establishmentId,
        },
      });

      if (!vehicle) {
        return null;
      }

      return PrismaCustomerVehicleMapper.toDomain(vehicle);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findByIdAndCustomerIdAndEstablishmentId(
    id: string,
    customerId: string,
    establishmentId: string,
  ): Promise<CustomerVehicle | null> {
    try {
      const vehicle = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).customerVehicle.findFirst({
        where: {
          id,
          customerId,
          establishmentId,
        },
      });

      if (!vehicle) {
        return null;
      }

      return PrismaCustomerVehicleMapper.toDomain(vehicle);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findActiveByPlateAndEstablishmentId(
    plate: string,
    establishmentId: string,
  ): Promise<CustomerVehicle | null> {
    const normalizedPlate = plate.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    try {
      const vehicle = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).customerVehicle.findFirst({
        where: {
          plate: normalizedPlate,
          establishmentId,
          deletedAt: null,
        },
      });

      if (!vehicle) {
        return null;
      }

      return PrismaCustomerVehicleMapper.toDomain(vehicle);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findManyByCustomerIdAndEstablishmentId(
    customerId: string,
    establishmentId: string,
    filters?: CustomerVehicleFilters,
  ): Promise<PaginatedCustomerVehicles> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 20;

    const where: Prisma.CustomerVehicleWhereInput = {
      customerId,
      establishmentId,
      ...(filters?.includeDeleted ? {} : { deletedAt: null }),
    };

    try {
      const client = PrismaUnitOfWork.getClient(this.prisma);

      const [totalItems, vehicles] = await Promise.all([
        client.customerVehicle.count({ where }),
        client.customerVehicle.findMany({
          where,
          orderBy: {
            createdAt: "asc",
          },
          skip: (page - 1) * size,
          take: size,
        }),
      ]);

      return {
        vehicles: vehicles.map((vehicle) =>
          PrismaCustomerVehicleMapper.toDomain(vehicle),
        ),
        totalItems,
      };
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findManyByEstablishmentId(
    establishmentId: string,
    filters?: EstablishmentCustomerVehicleFilters,
  ): Promise<PaginatedCustomerVehicles> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 20;
    const customerName = filters?.customerName?.trim();

    const where: Prisma.CustomerVehicleWhereInput = {
      establishmentId,
      deletedAt: null,
      ...(filters?.customerId ? { customerId: filters.customerId } : {}),
      ...(customerName
        ? {
            customer: {
              fullName: { contains: customerName, mode: "insensitive" },
            },
          }
        : {}),
    };

    try {
      const client = PrismaUnitOfWork.getClient(this.prisma);

      const [totalItems, vehicles] = await Promise.all([
        client.customerVehicle.count({ where }),
        client.customerVehicle.findMany({
          where,
          orderBy: {
            createdAt: "asc",
          },
          skip: (page - 1) * size,
          take: size,
        }),
      ]);

      return {
        vehicles: vehicles.map((vehicle) =>
          PrismaCustomerVehicleMapper.toDomain(vehicle),
        ),
        totalItems,
      };
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findAllActiveByCustomerIdAndEstablishmentId(
    customerId: string,
    establishmentId: string,
  ): Promise<CustomerVehicle[]> {
    try {
      const vehicles = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).customerVehicle.findMany({
        where: {
          customerId,
          establishmentId,
          deletedAt: null,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      return vehicles.map((vehicle) =>
        PrismaCustomerVehicleMapper.toDomain(vehicle),
      );
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findAllActiveByCustomerIdsAndEstablishmentId(
    customerIds: string[],
    establishmentId: string,
  ): Promise<CustomerVehicle[]> {
    if (customerIds.length === 0) {
      return [];
    }

    try {
      const vehicles = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).customerVehicle.findMany({
        where: {
          customerId: { in: customerIds },
          establishmentId,
          deletedAt: null,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      return vehicles.map((vehicle) =>
        PrismaCustomerVehicleMapper.toDomain(vehicle),
      );
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findOptionsByEstablishmentId(
    establishmentId: string,
    filters?: CustomerVehicleOptionsFilters,
  ): Promise<CustomerVehicleOption[]> {
    const limit = filters?.limit ?? 20;
    const search = filters?.search?.trim();
    const plateSearch = search?.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    try {
      const vehicles = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).customerVehicle.findMany({
        select: {
          id: true,
          model: true,
        },
        where: {
          establishmentId,
          deletedAt: null,
          ...(filters?.customerId ? { customerId: filters.customerId } : {}),
          ...(search
            ? {
                OR: [
                  ...(plateSearch
                    ? [{ plate: { contains: plateSearch } }]
                    : []),
                  { model: { contains: search, mode: "insensitive" } },
                  { brand: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: [{ model: "asc" }, { plate: "asc" }],
        take: limit,
      });

      return vehicles.map((vehicle) => ({
        id: vehicle.id,
        label: vehicle.model ?? "",
      }));
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async save(vehicle: CustomerVehicle): Promise<void> {
    const data = PrismaCustomerVehicleMapper.toPrismaUpdate(vehicle);

    try {
      await PrismaUnitOfWork.getClient(this.prisma).customerVehicle.update({
        where: {
          id: vehicle.id.toString(),
        },
        data,
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }
}
