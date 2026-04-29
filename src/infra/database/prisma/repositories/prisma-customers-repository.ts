import { Injectable } from "@nestjs/common";

import {
  CustomerFilters,
  CustomersRepository,
} from "../../../../modules/application/repositories/customers-repository";
import { Customer } from "../../../../modules/customer/domain/entities/customer";
import { CustomerDocument } from "../../../../modules/customer/domain/value-objects/customer-document";
import { PrismaCustomerMapper } from "../mappers/prisma-customer-mapper";
import { rethrowPrismaRepositoryError } from "../prisma-repository-error-handler";
import { PrismaUnitOfWork } from "../prisma-unit-of-work";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaCustomersRepository implements CustomersRepository {
  constructor(private prisma: PrismaService) {}

  async create(customer: Customer): Promise<void> {
    const data = PrismaCustomerMapper.toPrisma(customer);

    try {
      await PrismaUnitOfWork.getClient(this.prisma).customer.create({
        data,
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findById(id: string): Promise<Customer | null> {
    try {
      const customer = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).customer.findUnique({
        where: {
          id,
        },
      });

      if (!customer) {
        return null;
      }

      return PrismaCustomerMapper.toDomain(customer);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<Customer | null> {
    try {
      const customer = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).customer.findFirst({
        where: {
          id,
          establishmentId,
        },
      });

      if (!customer) {
        return null;
      }

      return PrismaCustomerMapper.toDomain(customer);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findActiveByCpfCnpjAndEstablishmentId(
    cpfCnpj: string,
    establishmentId: string,
  ): Promise<Customer | null> {
    const normalizedDocument = CustomerDocument.create(cpfCnpj).toString();

    try {
      const customer = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).customer.findFirst({
        where: {
          cpfCnpj: normalizedDocument,
          establishmentId,
          deletedAt: null,
        },
      });

      if (!customer) {
        return null;
      }

      return PrismaCustomerMapper.toDomain(customer);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findManyByEstablishmentId(
    establishmentId: string,
    filters?: CustomerFilters,
  ): Promise<Customer[]> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 20;
    const search = filters?.search?.trim();
    const documentSearch = search?.replace(/\D/g, "");

    try {
      const customers = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).customer.findMany({
        where: {
          establishmentId,
          ...(filters?.includeDeleted ? {} : { deletedAt: null }),
          ...(search
            ? {
                OR: [
                  { fullName: { contains: search, mode: "insensitive" } },
                  { phone: { contains: search } },
                  { email: { contains: search, mode: "insensitive" } },
                  ...(documentSearch
                    ? [{ cpfCnpj: { contains: documentSearch } }]
                    : []),
                ],
              }
            : {}),
        },
        orderBy: {
          createdAt: "asc",
        },
        skip: (page - 1) * size,
        take: size,
      });

      return customers.map((customer) =>
        PrismaCustomerMapper.toDomain(customer),
      );
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async save(customer: Customer): Promise<void> {
    const data = PrismaCustomerMapper.toPrismaUpdate(customer);

    try {
      await PrismaUnitOfWork.getClient(this.prisma).customer.update({
        where: {
          id: customer.id.toString(),
        },
        data,
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }
}
