import { Injectable } from "@nestjs/common";

import {
  AppointmentFilters,
  AppointmentListResult,
  AppointmentsRepository,
  CalendarAppointmentFilters,
  PopularServiceUsageMetrics,
  TopCustomerMetrics,
  TopCustomersFilters,
} from "../../../../modules/application/repositories/appointments-repository";
import { Appointment } from "../../../../modules/scheduling/domain/entities/appointment";
import { Prisma } from "../../../../generated/prisma/client";
import { PrismaAppointmentMapper } from "../mappers/prisma-appointment-mapper";
import { rethrowPrismaRepositoryError } from "../prisma-repository-error-handler";
import { PrismaUnitOfWork } from "../prisma-unit-of-work";
import { PrismaService } from "../prisma.service";

const bookedServicesInclude = {
  bookedServices: {
    orderBy: {
      position: "asc" as const,
    },
  },
} satisfies Prisma.AppointmentInclude;

@Injectable()
export class PrismaAppointmentsRepository implements AppointmentsRepository {
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

  private static buildVehicleDisplaySearchWhere(
    search: string,
  ): Prisma.AppointmentWhereInput {
    const terms = search
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length > 0);

    if (terms.length === 0) {
      return {};
    }

    return {
      AND: terms.map((term) => ({
        OR: [
          {
            vehicleBrand:
              PrismaAppointmentsRepository.containsInsensitive(term),
          },
          {
            vehicleModel:
              PrismaAppointmentsRepository.containsInsensitive(term),
          },
          ...(Number.isInteger(Number(term))
            ? [
                {
                  vehicleYear: Number(term),
                },
              ]
            : []),
        ],
      })),
    };
  }

  private static getNetRevenueInCents(appointment: Appointment) {
    const gross = Appointment.totalServicesPriceInCents(appointment.services);
    const discountInCents = appointment.discountInCents?.amountInCents ?? 0;

    return Math.max(gross - discountInCents, 0);
  }

  private static buildStatusWhere(status?: AppointmentFilters["status"]) {
    if (!status) {
      return {};
    }

    if (Array.isArray(status)) {
      return status.length > 0 ? { status: { in: status } } : {};
    }

    return { status };
  }

  private static buildTextWhere(
    filters?: AppointmentFilters,
  ): Pick<Prisma.AppointmentWhereInput, "AND"> {
    const and: Prisma.AppointmentWhereInput[] = [];
    const search = PrismaAppointmentsRepository.normalizeTextFilter(
      filters?.search,
    );
    const normalizedSearchPlate =
      PrismaAppointmentsRepository.normalizePlateFilter(search);
    const customerName = PrismaAppointmentsRepository.normalizeTextFilter(
      filters?.customerName,
    );
    const customerNickname = PrismaAppointmentsRepository.normalizeTextFilter(
      filters?.customerNickname,
    );
    const serviceName = PrismaAppointmentsRepository.normalizeTextFilter(
      filters?.serviceName,
    );
    const vehiclePlate = PrismaAppointmentsRepository.normalizePlateFilter(
      filters?.vehiclePlate,
    );
    const vehicleBrand = PrismaAppointmentsRepository.normalizeTextFilter(
      filters?.vehicleBrand,
    );
    const vehicleModel = PrismaAppointmentsRepository.normalizeTextFilter(
      filters?.vehicleModel,
    );

    if (customerName) {
      and.push({
        customer: {
          fullName:
            PrismaAppointmentsRepository.containsInsensitive(customerName),
        },
      });
    }

    if (customerNickname) {
      and.push({
        customer: {
          nickname:
            PrismaAppointmentsRepository.containsInsensitive(customerNickname),
        },
      });
    }

    if (serviceName) {
      and.push({
        bookedServices: {
          some: {
            serviceName:
              PrismaAppointmentsRepository.containsInsensitive(serviceName),
          },
        },
      });
    }

    if (vehiclePlate) {
      and.push({
        vehiclePlate:
          PrismaAppointmentsRepository.containsInsensitive(vehiclePlate),
      });
    }

    if (vehicleBrand) {
      and.push({
        vehicleBrand:
          PrismaAppointmentsRepository.containsInsensitive(vehicleBrand),
      });
    }

    if (vehicleModel) {
      and.push({
        vehicleModel:
          PrismaAppointmentsRepository.containsInsensitive(vehicleModel),
      });
    }

    if (search) {
      const vehicleDisplayWhere =
        PrismaAppointmentsRepository.buildVehicleDisplaySearchWhere(search);
      const searchOr: Prisma.AppointmentWhereInput[] = [
        {
          bookedServices: {
            some: {
              serviceName:
                PrismaAppointmentsRepository.containsInsensitive(search),
            },
          },
        },
        {
          vehicleBrand:
            PrismaAppointmentsRepository.containsInsensitive(search),
        },
        {
          vehicleModel:
            PrismaAppointmentsRepository.containsInsensitive(search),
        },
        ...(Object.keys(vehicleDisplayWhere).length > 0
          ? [vehicleDisplayWhere]
          : []),
        {
          customer: {
            fullName: PrismaAppointmentsRepository.containsInsensitive(search),
          },
        },
        {
          customer: {
            nickname: PrismaAppointmentsRepository.containsInsensitive(search),
          },
        },
      ];

      if (normalizedSearchPlate) {
        searchOr.push({
          vehiclePlate: PrismaAppointmentsRepository.containsInsensitive(
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
    filters?: AppointmentFilters,
  ): Prisma.AppointmentWhereInput {
    return {
      establishmentId,
      ...(filters?.customerId ? { customerId: filters.customerId } : {}),
      ...(filters?.vehicleId ? { vehicleId: filters.vehicleId } : {}),
      ...(filters?.serviceId
        ? {
            bookedServices: {
              some: {
                serviceId: filters.serviceId,
              },
            },
          }
        : {}),
      ...PrismaAppointmentsRepository.buildStatusWhere(filters?.status),
      ...(filters?.categoryIds?.length
        ? {
            bookedServices: {
              some: {
                serviceCategoryId: { in: filters.categoryIds },
              },
            },
          }
        : {}),
      ...(filters?.startsAt || filters?.endsAt
        ? {
            startsAt: {
              ...(filters.startsAt ? { gte: filters.startsAt } : {}),
              ...(filters.endsAt ? { lte: filters.endsAt } : {}),
            },
          }
        : {}),
      ...PrismaAppointmentsRepository.buildTextWhere(filters),
    };
  }

  private static buildBookedServiceWhere(
    establishmentId: string,
    filters?: AppointmentFilters,
  ): Prisma.AppointmentBookedServiceWhereInput {
    return {
      appointment: PrismaAppointmentsRepository.buildWhere(
        establishmentId,
        filters,
      ),
    };
  }

  async create(appointment: Appointment): Promise<void> {
    const data = PrismaAppointmentMapper.toPrisma(appointment);

    try {
      await PrismaUnitOfWork.getClient(this.prisma).appointment.create({
        data,
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findById(id: string): Promise<Appointment | null> {
    try {
      const appointment = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).appointment.findUnique({
        where: {
          id,
        },
        include: bookedServicesInclude,
      });

      if (!appointment) {
        return null;
      }

      return PrismaAppointmentMapper.toDomain(appointment);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<Appointment | null> {
    try {
      const appointment = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).appointment.findFirst({
        where: {
          id,
          establishmentId,
        },
        include: bookedServicesInclude,
      });

      if (!appointment) {
        return null;
      }

      return PrismaAppointmentMapper.toDomain(appointment);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  private static buildCalendarWhere(
    establishmentId: string,
    filters: CalendarAppointmentFilters,
  ): Prisma.AppointmentWhereInput {
    return {
      establishmentId,
      startsAt: {
        lt: filters.endsAt,
      },
      OR: [
        {
          endsAt: {
            gt: filters.startsAt,
          },
        },
        {
          endsAt: null,
          startsAt: {
            gt: filters.startsAt,
            lt: filters.endsAt,
          },
        },
      ],
      ...PrismaAppointmentsRepository.buildStatusWhere(filters.status),
    };
  }

  async findManyByEstablishmentIdInCalendarRange(
    establishmentId: string,
    filters: CalendarAppointmentFilters,
  ): Promise<AppointmentListResult> {
    const where = PrismaAppointmentsRepository.buildCalendarWhere(
      establishmentId,
      filters,
    );

    try {
      const client = PrismaUnitOfWork.getClient(this.prisma);
      const [totalItems, appointments] = await Promise.all([
        client.appointment.count({ where }),
        client.appointment.findMany({
          where,
          include: bookedServicesInclude,
          orderBy: {
            startsAt: "asc",
          },
        }),
      ]);

      return {
        appointments: appointments.map((appointment) =>
          PrismaAppointmentMapper.toDomain(appointment),
        ),
        totalItems,
      };
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findManyByEstablishmentId(
    establishmentId: string,
    filters?: AppointmentFilters,
  ): Promise<AppointmentListResult> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 20;
    const where = PrismaAppointmentsRepository.buildWhere(
      establishmentId,
      filters,
    );

    try {
      const client = PrismaUnitOfWork.getClient(this.prisma);
      const [totalItems, appointments] = await Promise.all([
        client.appointment.count({ where }),
        client.appointment.findMany({
          where,
          include: bookedServicesInclude,
          orderBy: {
            startsAt: "asc",
          },
          skip: (page - 1) * size,
          take: size,
        }),
      ]);

      return {
        appointments: appointments.map((appointment) =>
          PrismaAppointmentMapper.toDomain(appointment),
        ),
        totalItems,
      };
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findPopularServiceUsagesByEstablishmentId(
    establishmentId: string,
    filters?: AppointmentFilters,
  ): Promise<PopularServiceUsageMetrics> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 20;
    const where = PrismaAppointmentsRepository.buildBookedServiceWhere(
      establishmentId,
      filters,
    );

    try {
      const client = PrismaUnitOfWork.getClient(this.prisma);

      const [totalUsages, popularServices] = await Promise.all([
        client.appointmentBookedService.count({ where }),
        client.appointmentBookedService.groupBy({
          by: ["serviceId", "serviceName"],
          where,
          _count: {
            _all: true,
          },
          orderBy: [
            {
              _count: {
                serviceId: "desc",
              },
            },
            {
              serviceName: "asc",
            },
            {
              serviceId: "asc",
            },
          ],
          skip: (page - 1) * size,
          take: size,
        }),
      ]);

      return {
        items: popularServices.map((service) => ({
          serviceId: service.serviceId,
          serviceName: service.serviceName,
          usageCount: service._count._all,
        })),
        totalUsages,
      };
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findTopCustomersByEstablishmentId(
    establishmentId: string,
    filters?: TopCustomersFilters,
  ): Promise<TopCustomerMetrics> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 5;

    try {
      const appointments = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).appointment.findMany({
        where: PrismaAppointmentsRepository.buildWhere(establishmentId, {
          ...(filters?.startsAt ? { startsAt: filters.startsAt } : {}),
          ...(filters?.endsAt ? { endsAt: filters.endsAt } : {}),
          status: "DONE",
        }),
        include: bookedServicesInclude,
        orderBy: {
          startsAt: "asc",
        },
      });
      const groupedByCustomer = new Map<
        string,
        {
          customerId: string;
          customerName: string;
          completedAppointmentsCount: number;
          totalSpentInCents: number;
        }
      >();

      for (const appointmentRecord of appointments) {
        const appointment = PrismaAppointmentMapper.toDomain(appointmentRecord);
        const customerId = appointment.customerId.toString();
        const current = groupedByCustomer.get(customerId);

        if (!current) {
          groupedByCustomer.set(customerId, {
            customerId,
            customerName: appointment.customer.fullName,
            completedAppointmentsCount: 1,
            totalSpentInCents:
              PrismaAppointmentsRepository.getNetRevenueInCents(appointment),
          });

          continue;
        }

        groupedByCustomer.set(customerId, {
          ...current,
          completedAppointmentsCount: current.completedAppointmentsCount + 1,
          totalSpentInCents:
            current.totalSpentInCents +
            PrismaAppointmentsRepository.getNetRevenueInCents(appointment),
        });
      }

      const rankedCustomers = Array.from(groupedByCustomer.values()).sort(
        (a, b) => {
          if (b.completedAppointmentsCount !== a.completedAppointmentsCount) {
            return b.completedAppointmentsCount - a.completedAppointmentsCount;
          }

          if (b.totalSpentInCents !== a.totalSpentInCents) {
            return b.totalSpentInCents - a.totalSpentInCents;
          }

          const nameComparison = a.customerName.localeCompare(b.customerName);

          if (nameComparison !== 0) {
            return nameComparison;
          }

          return a.customerId.localeCompare(b.customerId);
        },
      );
      const start = (page - 1) * size;
      const end = start + size;

      return {
        items: rankedCustomers.slice(start, end),
        totalCustomers: rankedCustomers.length,
      };
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async save(appointment: Appointment): Promise<void> {
    const data = PrismaAppointmentMapper.toPrismaUpdate(appointment);

    try {
      await PrismaUnitOfWork.getClient(this.prisma).appointment.update({
        where: {
          id: appointment.id.toString(),
        },
        data,
      });
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }
}
