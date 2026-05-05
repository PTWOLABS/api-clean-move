import { Injectable } from "@nestjs/common";

import { EmployeesRepository } from "../../../../modules/application/repositories/employees-repository";
import { Employee } from "../../../../modules/employees/domain/entities/employee";
import { PrismaEmployeeMapper } from "../mappers/prisma-employee-mapper";
import { rethrowPrismaRepositoryError } from "../prisma-repository-error-handler";
import { PrismaUnitOfWork } from "../prisma-unit-of-work";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaEmployeesRepository implements EmployeesRepository {
  constructor(private prisma: PrismaService) {}

  async create(employee: Employee): Promise<void> {
    const data = PrismaEmployeeMapper.toPrisma(employee);

    try {
      await PrismaUnitOfWork.getClient(this.prisma).employee.create({
        data,
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findByUserId(userId: string): Promise<Employee | null> {
    try {
      const employee = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).employee.findUnique({
        where: {
          userId,
        },
      });

      if (!employee) {
        return null;
      }

      return PrismaEmployeeMapper.toDomain(employee);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<Employee | null> {
    try {
      const employee = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).employee.findFirst({
        where: {
          id,
          establishmentId,
        },
      });

      if (!employee) {
        return null;
      }

      return PrismaEmployeeMapper.toDomain(employee);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async save(employee: Employee): Promise<void> {
    const data = PrismaEmployeeMapper.toPrismaUpdate(employee);

    try {
      await PrismaUnitOfWork.getClient(this.prisma).employee.update({
        where: {
          id: employee.id.toString(),
        },
        data,
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }
}
