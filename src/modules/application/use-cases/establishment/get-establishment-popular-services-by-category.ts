import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { ResolvedDashboardMetricsRange } from "../../services/dashboard-metrics-range-resolver";
import { AppointmentsRepository } from "../../repositories/appointments-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import { EstablishmentMetricsFilters } from "./establishment-metrics-helpers";

type GetEstablishmentPopularServicesByCategoryUseCaseRequest = {
  establishmentOwnerId: string;
  range: ResolvedDashboardMetricsRange;
  pagination?: {
    page: number;
    size: number;
  };
  filters?: EstablishmentMetricsFilters;
};

type PopularServiceByCategoryItem = {
  id: string;
  name: string;
  completedCount: number;
  percent: number;
};

type GetEstablishmentPopularServicesByCategoryUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    popularServices: PopularServiceByCategoryItem[];
    totalServices: number;
  }
>;

@Injectable()
export class GetEstablishmentPopularServicesByCategoryUseCase {
  constructor(
    private establishmentsRepository: EstablishmentsRepository,
    private appointmentsRepository: AppointmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    range,
    pagination,
    filters,
  }: GetEstablishmentPopularServicesByCategoryUseCaseRequest): Promise<GetEstablishmentPopularServicesByCategoryUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const page = pagination?.page ?? 1;
    const size = pagination?.size ?? 5;

    const appointments =
      await this.appointmentsRepository.findManyByEstablishmentId(
        establishment.id.toString(),
        {
          startsAt: range.current.startsAt,
          endsAt: range.current.endsAt,
          ...(filters?.categories !== undefined
            ? { categories: filters.categories }
            : {}),
          status: filters?.status ?? ["DONE"],
          page,
          size,
        },
      );

    const totalServices = appointments.length;

    if (totalServices === 0) {
      return right({
        popularServices: [],
        totalServices: 0,
      });
    }

    const groupedByService = new Map<
      string,
      Omit<PopularServiceByCategoryItem, "percent">
    >();

    for (const appointment of appointments) {
      const serviceId = appointment.service.serviceId.toString();
      const current = groupedByService.get(serviceId);

      if (!current) {
        groupedByService.set(serviceId, {
          id: serviceId,
          name: appointment.service.serviceName,
          completedCount: 1,
        });

        continue;
      }

      groupedByService.set(serviceId, {
        ...current,
        completedCount: current.completedCount + 1,
      });
    }

    const popularServices = Array.from(groupedByService.values())
      .sort((a, b) => {
        if (b.completedCount === a.completedCount) {
          const nameComparison = a.name.localeCompare(b.name);

          if (nameComparison !== 0) {
            return nameComparison;
          }

          return a.id.localeCompare(b.id);
        }

        return b.completedCount - a.completedCount;
      })
      .map((service) => ({
        ...service,
        percent: Math.round((service.completedCount / totalServices) * 100),
      }));

    return right({
      popularServices,
      totalServices,
    });
  }
}
