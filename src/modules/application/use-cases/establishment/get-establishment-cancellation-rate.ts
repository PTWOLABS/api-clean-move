import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { calculatePercentPointDifference } from "../../services/dashboard-metrics-bucket-builder";
import { ResolvedDashboardMetricsRange } from "../../services/dashboard-metrics-range-resolver";
import { AppointmentsRepository } from "../../repositories/appointments-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import {
  EstablishmentMetricsFilters,
  findAllAppointmentsByEstablishment,
} from "./establishment-metrics-helpers";

type GetEstablishmentCancellationRateUseCaseRequest = {
  establishmentOwnerId: string;
  range: ResolvedDashboardMetricsRange;
  filters?: EstablishmentMetricsFilters;
};

type GetEstablishmentCancellationRateUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    appointmentsCount: number;
    cancellationRate: {
      currentPercent: number;
      comparisonPercentPoints: number | null;
    };
  }
>;

@Injectable()
export class GetEstablishmentCancellationRateUseCase {
  constructor(
    private establishmentsRepository: EstablishmentsRepository,
    private appointmentsRepository: AppointmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    range,
    filters,
  }: GetEstablishmentCancellationRateUseCaseRequest): Promise<GetEstablishmentCancellationRateUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const currentAppointments = await findAllAppointmentsByEstablishment(
      this.appointmentsRepository,
      establishment.id.toString(),
      {
        startsAt: range.current.startsAt,
        endsAt: range.current.endsAt,
        ...(filters?.categories !== undefined
          ? { categories: filters.categories }
          : {}),
      },
    );
    const comparisonAppointments = await findAllAppointmentsByEstablishment(
      this.appointmentsRepository,
      establishment.id.toString(),
      {
        startsAt: range.comparison.startsAt,
        endsAt: range.comparison.endsAt,
        ...(filters?.categories !== undefined
          ? { categories: filters.categories }
          : {}),
      },
    );

    const currentPercent = calculateCancellationPercent(currentAppointments);
    const previousPercent =
      comparisonAppointments.length === 0
        ? null
        : calculateCancellationPercent(comparisonAppointments);

    return right({
      appointmentsCount: currentAppointments.length,
      cancellationRate: {
        currentPercent,
        comparisonPercentPoints: calculatePercentPointDifference(
          currentPercent,
          previousPercent,
        ),
      },
    });
  }
}

function calculateCancellationPercent(
  appointments: Awaited<ReturnType<typeof findAllAppointmentsByEstablishment>>,
) {
  if (appointments.length === 0) {
    return 0;
  }

  const cancelledCount = appointments.filter(
    (appointment) => appointment.status === "CANCELLED",
  ).length;

  return Math.round((cancelledCount / appointments.length) * 1000) / 10;
}
