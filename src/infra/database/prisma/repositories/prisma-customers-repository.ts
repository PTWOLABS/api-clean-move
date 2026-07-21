import { Injectable } from "@nestjs/common";

import {
  CustomerFilters,
  CustomerMatchEvidence,
  CustomerOptionsFilters,
  CustomerOptionsResult,
  CustomersRepository,
  PaginatedCustomers,
} from "../../../../modules/application/repositories/customers-repository";
import { Prisma } from "../../../../generated/prisma/client";
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

  async findByIdAndEstablishmentIdIncludingDeleted(
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

  async findManyByIdsAndEstablishmentIdIncludingDeleted(
    ids: string[],
    establishmentId: string,
  ): Promise<Customer[]> {
    if (ids.length === 0) {
      return [];
    }

    try {
      const customers = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).customer.findMany({
        where: {
          id: { in: ids },
          establishmentId,
        },
      });

      return customers.map((customer) =>
        PrismaCustomerMapper.toDomain(customer),
      );
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

  async findManyActiveByEvidenceAndEstablishmentId(
    evidence: CustomerMatchEvidence,
    establishmentId: string,
  ): Promise<Customer[]> {
    const phone = normalizePhoneEvidence(evidence.phone);
    const email = normalizeTextEvidence(evidence.email);
    const fullName = normalizeTextEvidence(evidence.fullName);

    const or: Prisma.CustomerWhereInput[] = [
      ...(phone ? [{ phone }] : []),
      ...(email
        ? [{ email: { equals: email, mode: "insensitive" as const } }]
        : []),
      ...(fullName
        ? [
            {
              fullName: {
                equals: fullName,
                mode: "insensitive" as const,
              },
            },
          ]
        : []),
    ];

    if (or.length === 0) {
      return [];
    }

    try {
      const customers = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).customer.findMany({
        where: {
          deletedAt: null,
          establishmentId,
          OR: or,
        },
      });

      return customers.map((customer) =>
        PrismaCustomerMapper.toDomain(customer),
      );
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findManyByEstablishmentId(
    establishmentId: string,
    filters?: CustomerFilters,
  ): Promise<PaginatedCustomers> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 20;
    const search = filters?.search?.trim();
    const documentSearch = search?.replace(/\D/g, "");

    const where: Prisma.CustomerWhereInput = {
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
    };

    try {
      const client = PrismaUnitOfWork.getClient(this.prisma);

      const [totalItems, customers] = await Promise.all([
        client.customer.count({ where }),
        client.customer.findMany({
          where,
          orderBy: {
            createdAt: "asc",
          },
          skip: (page - 1) * size,
          take: size,
        }),
      ]);

      return {
        customers: customers.map((customer) =>
          PrismaCustomerMapper.toDomain(customer),
        ),
        totalItems,
      };
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findOptionsByEstablishmentId(
    establishmentId: string,
    filters?: CustomerOptionsFilters,
  ): Promise<CustomerOptionsResult> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 20;
    const search = filters?.search?.trim();

    const where: Prisma.CustomerWhereInput = {
      establishmentId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { nickname: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    try {
      const client = PrismaUnitOfWork.getClient(this.prisma);
      const [totalItems, customers] = await Promise.all([
        client.customer.count({ where }),
        client.customer.findMany({
          select: {
            id: true,
            fullName: true,
          },
          where,
          orderBy: {
            fullName: "asc",
          },
          skip: (page - 1) * size,
          take: size,
        }),
      ]);

      return {
        customers: customers.map((customer) => ({
          id: customer.id,
          label: customer.fullName,
        })),
        totalItems,
      };
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

function normalizePhoneEvidence(value: string | undefined) {
  const normalized = value?.replace(/\D/g, "");
  return normalized || undefined;
}

function normalizeTextEvidence(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}
