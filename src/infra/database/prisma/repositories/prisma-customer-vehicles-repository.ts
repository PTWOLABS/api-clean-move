import { Injectable } from "@nestjs/common";

import {
  CustomerVehicleFilters,
  CustomerVehiclesRepository,
} from "../../../../modules/application/repositories/customer-vehicles-repository";
import { CustomerVehicle } from "../../../../modules/customer/domain/entities/customer-vehicle";
import { PrismaCustomerVehicleMapper } from "../mappers/prisma-customer-vehicle-mapper";
import { rethrowPrismaRepositoryError } from "../prisma-repository-error-handler";
import { PrismaUnitOfWork } from "../prisma-unit-of-work";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaCustomerVehiclesRepository
  implements CustomerVehiclesRepository
{
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
  ): Promise<CustomerVehicle[]> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 20;

    try {
      const vehicles = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).customerVehicle.findMany({
        where: {
          customerId,
          establishmentId,
          ...(filters?.includeDeleted ? {} : { deletedAt: null }),
        },
        orderBy: {
          createdAt: "asc",
        },
        skip: (page - 1) * size,
        take: size,
      });

      return vehicles.map((vehicle) =>
        PrismaCustomerVehicleMapper.toDomain(vehicle),
      );
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
