import { Injectable } from "@nestjs/common";

import {
  AppointmentFilters,
  AppointmentsRepository,
} from "../../../../modules/application/repositories/appointments-repository";
import { Appointment } from "../../../../modules/scheduling/domain/entities/appointment";
import { Prisma } from "../../../../generated/prisma/client";
import { PrismaAppointmentMapper } from "../mappers/prisma-appointment-mapper";
import { rethrowPrismaRepositoryError } from "../prisma-repository-error-handler";
import { PrismaUnitOfWork } from "../prisma-unit-of-work";
import { PrismaService } from "../prisma.service";

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
        bookedServiceName:
          PrismaAppointmentsRepository.containsInsensitive(serviceName),
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
      const searchOr: Prisma.AppointmentWhereInput[] = [
        {
          bookedServiceName:
            PrismaAppointmentsRepository.containsInsensitive(search),
        },
        {
          vehicleBrand:
            PrismaAppointmentsRepository.containsInsensitive(search),
        },
        {
          vehicleModel:
            PrismaAppointmentsRepository.containsInsensitive(search),
        },
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
      });

      if (!appointment) {
        return null;
      }

      return PrismaAppointmentMapper.toDomain(appointment);
    } catch (error) {
      rethrowPrismaRepositoryError(error);
    }
  }

  async findManyByEstablishmentId(
    establishmentId: string,
    filters?: AppointmentFilters,
  ): Promise<Appointment[]> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 20;

    try {
      const appointments = await PrismaUnitOfWork.getClient(
        this.prisma,
      ).appointment.findMany({
        where: {
          establishmentId,
          ...(filters?.customerId ? { customerId: filters.customerId } : {}),
          ...(filters?.vehicleId ? { vehicleId: filters.vehicleId } : {}),
          ...(filters?.serviceId ? { bookedServiceId: filters.serviceId } : {}),
          ...PrismaAppointmentsRepository.buildStatusWhere(filters?.status),
          ...(filters?.categories?.length
            ? { bookedServiceCategory: { in: filters.categories } }
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
        },
        orderBy: {
          startsAt: "asc",
        },
        skip: (page - 1) * size,
        take: size,
      });

      return appointments.map((appointment) =>
        PrismaAppointmentMapper.toDomain(appointment),
      );
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
