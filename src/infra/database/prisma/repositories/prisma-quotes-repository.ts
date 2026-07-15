import { Injectable } from "@nestjs/common";

import {
  QuoteFilters,
  QuoteListResult,
  QuotesRepository,
} from "../../../../modules/application/repositories/quotes-repository";
import { Quote } from "../../../../modules/quotes/domain/entities/quote";
import { Prisma } from "../../../../generated/prisma/client";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { getSaoPauloDayBounds } from "../../../../shared/utils/get-sao-paulo-day-bounds";
import { PrismaQuoteMapper } from "../mappers/prisma-quote-mapper";
import { rethrowPrismaRepositoryError } from "../prisma-repository-error-handler";
import { PrismaUnitOfWork } from "../prisma-unit-of-work";
import { PrismaService } from "../prisma.service";

const quoteInclude = {
  services: {
    orderBy: {
      position: "asc" as const,
    },
  },
  paymentOptions: {
    orderBy: {
      position: "asc" as const,
    },
  },
} satisfies Prisma.QuoteInclude;

@Injectable()
export class PrismaQuotesRepository implements QuotesRepository {
  constructor(private prisma: PrismaService) {}

  private static normalizeTextFilter(value?: string): string | undefined {
    const normalized = value?.trim();

    return normalized || undefined;
  }

  private static normalizePlateFilter(value?: string): string | undefined {
    const normalized = value?.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    return normalized || undefined;
  }

  private static containsInsensitive(value: string) {
    return {
      contains: value,
      mode: "insensitive" as const,
    };
  }

  private static buildCreatedAtWhere(createdAt?: Date) {
    if (!createdAt) {
      return {};
    }

    const startOfDay = new Date(createdAt);
    startOfDay.setHours(0, 0, 0, 0);

    const nextDay = new Date(startOfDay);
    nextDay.setDate(startOfDay.getDate() + 1);

    return {
      createdAt: {
        gte: startOfDay,
        lt: nextDay,
      },
    };
  }

  private static withStatusWhere(
    where: Prisma.QuoteWhereInput,
    statusWhere: Prisma.QuoteWhereInput,
  ): Prisma.QuoteWhereInput {
    return {
      AND: [where, statusWhere],
    };
  }

  private static buildOrderBy(filters?: QuoteFilters) {
    return {
      createdAt: filters?.sort === "oldest" ? "asc" : "desc",
    } satisfies Prisma.QuoteOrderByWithRelationInput;
  }

  private static buildTextWhere(
    filters?: QuoteFilters,
  ): Pick<Prisma.QuoteWhereInput, "AND"> {
    const and: Prisma.QuoteWhereInput[] = [];
    const search = PrismaQuotesRepository.normalizeTextFilter(filters?.search);
    const normalizedSearchPlate =
      PrismaQuotesRepository.normalizePlateFilter(search);
    const customerName = PrismaQuotesRepository.normalizeTextFilter(
      filters?.customerName,
    );
    const serviceName = PrismaQuotesRepository.normalizeTextFilter(
      filters?.serviceName,
    );
    const vehiclePlate = PrismaQuotesRepository.normalizePlateFilter(
      filters?.vehiclePlate,
    );

    if (customerName) {
      and.push({
        customerName: PrismaQuotesRepository.containsInsensitive(customerName),
      });
    }

    if (serviceName) {
      and.push({
        services: {
          some: {
            serviceName:
              PrismaQuotesRepository.containsInsensitive(serviceName),
          },
        },
      });
    }

    if (vehiclePlate) {
      and.push({
        vehiclePlate: PrismaQuotesRepository.containsInsensitive(vehiclePlate),
      });
    }

    if (search) {
      const searchOr: Prisma.QuoteWhereInput[] = [
        {
          customerName: PrismaQuotesRepository.containsInsensitive(search),
        },
        {
          customerPhone: PrismaQuotesRepository.containsInsensitive(search),
        },
        {
          customerCpfCnpj: PrismaQuotesRepository.containsInsensitive(search),
        },
        {
          vehicleBrand: PrismaQuotesRepository.containsInsensitive(search),
        },
        {
          vehicleModel: PrismaQuotesRepository.containsInsensitive(search),
        },
        {
          services: {
            some: {
              serviceName: PrismaQuotesRepository.containsInsensitive(search),
            },
          },
        },
      ];

      if (normalizedSearchPlate) {
        searchOr.push({
          vehiclePlate: PrismaQuotesRepository.containsInsensitive(
            normalizedSearchPlate,
          ),
        });
      }

      and.push({
        OR: searchOr,
      });
    }

    return and.length > 0 ? { AND: and } : {};
  }

  private static buildWhere(
    establishmentId: string,
    filters?: QuoteFilters,
  ): Prisma.QuoteWhereInput {
    const and: Prisma.QuoteWhereInput[] = [];

    if (filters?.serviceId) {
      and.push({
        services: {
          some: {
            serviceId: filters.serviceId,
          },
        },
      });
    }

    if (filters?.expiresFrom || filters?.expiresTo) {
      and.push({
        expiresAt: {
          ...(filters.expiresFrom ? { gte: filters.expiresFrom } : {}),
          ...(filters.expiresTo ? { lte: filters.expiresTo } : {}),
        },
      });
    }

    const textWhere = PrismaQuotesRepository.buildTextWhere(filters);
    if (Array.isArray(textWhere.AND)) {
      and.push(...textWhere.AND);
    } else if (textWhere.AND) {
      and.push(textWhere.AND);
    }

    return {
      establishmentId,
      ...(filters?.customerId ? { customerId: filters.customerId } : {}),
      ...(filters?.vehicleId ? { vehicleId: filters.vehicleId } : {}),
      ...(filters?.converted !== undefined
        ? {
            convertedAppointmentId: filters.converted ? { not: null } : null,
          }
        : {}),
      ...PrismaQuotesRepository.buildCreatedAtWhere(filters?.createdAt),
      ...(and.length > 0 ? { AND: and } : {}),
    };
  }

  async create(quote: Quote): Promise<void> {
    const data = PrismaQuoteMapper.toPrisma(quote);

    try {
      await PrismaUnitOfWork.getClient(this.prisma).quote.create({
        data,
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findById(id: string): Promise<Quote | null> {
    try {
      const quote = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).quote.findUnique({
        where: {
          id,
        },
        include: quoteInclude,
      });

      if (!quote) {
        return null;
      }

      return PrismaQuoteMapper.toDomain(quote);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<Quote | null> {
    try {
      const quote = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).quote.findFirst({
        where: {
          id,
          establishmentId,
        },
        include: quoteInclude,
      });

      if (!quote) {
        return null;
      }

      return PrismaQuoteMapper.toDomain(quote);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findManyByEstablishmentId(
    establishmentId: string,
    filters?: QuoteFilters,
    referenceDate = new Date(),
  ): Promise<QuoteListResult> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 20;
    const where = PrismaQuotesRepository.buildWhere(establishmentId, filters);
    const { todayStart, tomorrowStart } = getSaoPauloDayBounds(referenceDate);

    try {
      const client = PrismaUnitOfWork.getClient(this.prisma);
      const [totalItems, quotes, approved, expiresToday, expired, valid] =
        await Promise.all([
          client.quote.count({ where }),
          client.quote.findMany({
            where,
            include: quoteInclude,
            orderBy: PrismaQuotesRepository.buildOrderBy(filters),
            skip: (page - 1) * size,
            take: size,
          }),
          client.quote.count({
            where: PrismaQuotesRepository.withStatusWhere(where, {
              convertedAppointmentId: {
                not: null,
              },
            }),
          }),
          client.quote.count({
            where: PrismaQuotesRepository.withStatusWhere(where, {
              convertedAppointmentId: null,
              expiresAt: {
                gte: todayStart,
                lt: tomorrowStart,
              },
            }),
          }),
          client.quote.count({
            where: PrismaQuotesRepository.withStatusWhere(where, {
              convertedAppointmentId: null,
              expiresAt: {
                lt: todayStart,
              },
            }),
          }),
          client.quote.count({
            where: PrismaQuotesRepository.withStatusWhere(where, {
              convertedAppointmentId: null,
              OR: [
                {
                  expiresAt: null,
                },
                {
                  expiresAt: {
                    gte: tomorrowStart,
                  },
                },
              ],
            }),
          }),
        ]);

      return {
        quotes: quotes.map((quote) => PrismaQuoteMapper.toDomain(quote)),
        totalItems,
        summary: {
          valid,
          expiresToday,
          approved,
          expired,
        },
      };
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async save(quote: Quote): Promise<void> {
    const data = PrismaQuoteMapper.toPrismaResolutionUpdate(quote);

    try {
      await PrismaUnitOfWork.getClient(this.prisma).quote.update({
        where: {
          id: quote.id.toString(),
        },
        data,
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async markAsConverted(
    quote: Quote,
    appointmentId: UniqueEntityId,
    convertedAt: Date,
  ): Promise<boolean> {
    try {
      const result = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).quote.updateMany({
        where: {
          id: quote.id.toString(),
          convertedAppointmentId: null,
        },
        data: {
          convertedAppointmentId: appointmentId.toString(),
          convertedAt,
          updatedAt: convertedAt,
        },
      });

      if (result.count === 0) {
        return false;
      }

      quote.markAsConverted(appointmentId, convertedAt);

      return true;
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }
}
