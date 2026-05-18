import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { ResolvedDashboardMetricsRange } from "../../services/dashboard-metrics-range-resolver";
import { AppointmentsRepository } from "../../repositories/appointments-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import { EstablishmentMetricsFilters } from "./establishment-metrics-helpers";

const DEFAULT_POPULAR_SERVICES_STATUS_FILTER = ["SCHEDULED", "DONE"] as const;

type GetEstablishmentPopularServicesUseCaseRequest = {
  establishmentOwnerId: string;
  range: ResolvedDashboardMetricsRange;
  pagination?: {
    page: number;
    size: number;
  };
  filters?: EstablishmentMetricsFilters;
};

type PopularServiceItem = {
  id: string;
  name: string;
  completedCount: number;
  percent: number;
};

type GetEstablishmentPopularServicesUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    popularServices: PopularServiceItem[];
    totalServices: number;
  }
>;

@Injectable()
export class GetEstablishmentPopularServicesUseCase {
  constructor(
    private establishmentsRepository: EstablishmentsRepository,
    private appointmentsRepository: AppointmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    range,
    pagination,
    filters,
  }: GetEstablishmentPopularServicesUseCaseRequest): Promise<GetEstablishmentPopularServicesUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const page = pagination?.page ?? 1;
    const size = pagination?.size ?? 5;

    const { items, totalUsages } =
      await this.appointmentsRepository.findPopularServiceUsagesByEstablishmentId(
        establishment.id.toString(),
        {
          startsAt: range.current.startsAt,
          endsAt: range.current.endsAt,
          ...(filters?.categories !== undefined
            ? { categories: filters.categories }
            : {}),
          status: filters?.status ?? [
            ...DEFAULT_POPULAR_SERVICES_STATUS_FILTER,
          ],
          page,
          size,
        },
      );

    const totalServices = totalUsages;

    if (totalServices === 0) {
      return right({
        popularServices: [],
        totalServices: 0,
      });
    }

    const popularServices = items.map((service) => ({
      id: service.serviceId,
      name: service.serviceName,
      completedCount: service.usageCount,
      percent: Math.round((service.usageCount / totalServices) * 100),
    }));

    return right({
      popularServices,
      totalServices,
    });
  }
}
