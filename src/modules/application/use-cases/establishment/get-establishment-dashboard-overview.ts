import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import {
  buildDashboardOverviewBuckets,
  calculatePercentPointDifference,
  calculateTrendPercent,
  getDashboardMetricBucketKey,
} from "../../services/dashboard-metrics-bucket-builder";
import { ResolvedDashboardMetricsRange } from "../../services/dashboard-metrics-range-resolver";
import { AppointmentsRepository } from "../../repositories/appointments-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import {
  EstablishmentMetricsFilters,
  findAllAppointmentsByEstablishment,
  getAppointmentNetRevenueInCents,
} from "./establishment-metrics-helpers";

type GetEstablishmentDashboardOverviewUseCaseRequest = {
  establishmentOwnerId: string;
  range: ResolvedDashboardMetricsRange;
  filters?: EstablishmentMetricsFilters;
};

type DashboardOverviewCountPoint = {
  date: string;
  label: string;
  value: number;
};

type DashboardOverviewMoneyPoint = {
  date: string;
  label: string;
  valueInCents: number;
};

type DashboardOverviewMetricSummary = {
  appointmentsCount: number;
  totalRevenueInCents: number;
  averageTicketInCents: number;
  cancellationRate: number;
};

type GetEstablishmentDashboardOverviewUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    appointments: {
      value: number;
      variationPercentage: number | null;
      points: DashboardOverviewCountPoint[];
    };
    averageTicket: {
      valueInCents: number;
      variationPercentage: number | null;
      points: DashboardOverviewMoneyPoint[];
    };
    cancellationRate: {
      value: number;
      variationInPercentagePoints: number | null;
      points: DashboardOverviewCountPoint[];
    };
    totalRevenue: {
      valueInCents: number;
      variationPercentage: number | null;
      points: DashboardOverviewMoneyPoint[];
    };
  }
>;

@Injectable()
export class GetEstablishmentDashboardOverviewUseCase {
  constructor(
    private establishmentsRepository: EstablishmentsRepository,
    private appointmentsRepository: AppointmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    range,
    filters,
  }: GetEstablishmentDashboardOverviewUseCaseRequest): Promise<GetEstablishmentDashboardOverviewUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const establishmentId = establishment.id.toString();
    const currentFilters = buildOverviewFilters(range.current, filters);
    const comparisonFilters = buildOverviewFilters(range.comparison, filters);
    const currentCancellationRateFilters = omitStatusFilter(currentFilters);
    const comparisonCancellationRateFilters =
      omitStatusFilter(comparisonFilters);

    const [
      currentAppointments,
      comparisonAppointments,
      currentCancellationRateAppointments,
      comparisonCancellationRateAppointments,
    ] = await Promise.all([
      findAllAppointmentsByEstablishment(
        this.appointmentsRepository,
        establishmentId,
        currentFilters,
      ),
      findAllAppointmentsByEstablishment(
        this.appointmentsRepository,
        establishmentId,
        comparisonFilters,
      ),
      findAllAppointmentsByEstablishment(
        this.appointmentsRepository,
        establishmentId,
        currentCancellationRateFilters,
      ),
      findAllAppointmentsByEstablishment(
        this.appointmentsRepository,
        establishmentId,
        comparisonCancellationRateFilters,
      ),
    ]);

    const currentSummary = summarizeAppointments(currentAppointments);
    const comparisonSummary = summarizeAppointments(comparisonAppointments);
    const currentCancellationRateSummary = summarizeAppointments(
      currentCancellationRateAppointments,
    );
    const comparisonCancellationRateSummary = summarizeAppointments(
      comparisonCancellationRateAppointments,
    );
    const buckets = buildDashboardOverviewBuckets(range.current);
    const pointSummaries = buildPointSummaries(currentAppointments, buckets);
    const cancellationRatePointSummaries = buildPointSummaries(
      currentCancellationRateAppointments,
      buckets,
    );

    return right({
      appointments: {
        value: currentSummary.appointmentsCount,
        variationPercentage: calculateTrendPercent(
          currentSummary.appointmentsCount,
          comparisonSummary.appointmentsCount,
        ),
        points: pointSummaries.map(({ date, label, appointmentsCount }) => ({
          date,
          label,
          value: appointmentsCount,
        })),
      },
      averageTicket: {
        valueInCents: currentSummary.averageTicketInCents,
        variationPercentage: calculateTrendPercent(
          currentSummary.averageTicketInCents,
          comparisonSummary.averageTicketInCents,
        ),
        points: pointSummaries.map(({ averageTicketInCents, date, label }) => ({
          date,
          label,
          valueInCents: averageTicketInCents,
        })),
      },
      cancellationRate: {
        value: currentCancellationRateSummary.cancellationRate,
        variationInPercentagePoints: calculatePercentPointDifference(
          currentCancellationRateSummary.cancellationRate,
          comparisonCancellationRateSummary.appointmentsCount === 0
            ? null
            : comparisonCancellationRateSummary.cancellationRate,
        ),
        points: cancellationRatePointSummaries.map(
          ({ cancellationRate, date, label }) => ({
            date,
            label,
            value: cancellationRate,
          }),
        ),
      },
      totalRevenue: {
        valueInCents: currentSummary.totalRevenueInCents,
        variationPercentage: calculateTrendPercent(
          currentSummary.totalRevenueInCents,
          comparisonSummary.totalRevenueInCents,
        ),
        points: pointSummaries.map(({ date, label, totalRevenueInCents }) => ({
          date,
          label,
          valueInCents: totalRevenueInCents,
        })),
      },
    });
  }
}

function buildOverviewFilters(
  range: ResolvedDashboardMetricsRange["current"],
  filters?: EstablishmentMetricsFilters,
): EstablishmentMetricsFilters {
  return {
    startsAt: range.startsAt,
    endsAt: range.endsAt,
    ...(filters?.categoryIds !== undefined
      ? { categoryIds: filters.categoryIds }
      : {}),
    ...(filters?.status !== undefined ? { status: filters.status } : {}),
  };
}

function omitStatusFilter(
  filters: EstablishmentMetricsFilters,
): EstablishmentMetricsFilters {
  const { status: _status, ...filtersWithoutStatus } = filters;

  return filtersWithoutStatus;
}

function summarizeAppointments(
  appointments: Awaited<ReturnType<typeof findAllAppointmentsByEstablishment>>,
): DashboardOverviewMetricSummary {
  const appointmentsCount = appointments.length;
  const totalRevenueInCents = appointments.reduce(
    (total, appointment) =>
      total + getAppointmentNetRevenueInCents(appointment),
    0,
  );
  const cancelledCount = appointments.filter(
    (appointment) => appointment.status === "CANCELLED",
  ).length;

  return {
    appointmentsCount,
    totalRevenueInCents,
    averageTicketInCents:
      appointmentsCount === 0
        ? 0
        : Math.round(totalRevenueInCents / appointmentsCount),
    cancellationRate: calculateCancellationRate(
      cancelledCount,
      appointmentsCount,
    ),
  };
}

function buildPointSummaries(
  appointments: Awaited<ReturnType<typeof findAllAppointmentsByEstablishment>>,
  buckets: ReturnType<typeof buildDashboardOverviewBuckets>,
) {
  const pointAccumulators = new Map(
    buckets.map((bucket) => [
      bucket.date,
      {
        date: bucket.date,
        label: bucket.label,
        appointmentsCount: 0,
        cancelledCount: 0,
        totalRevenueInCents: 0,
      },
    ]),
  );

  for (const appointment of appointments) {
    const bucketKey = getDashboardMetricBucketKey(
      appointment.startsAt,
      buckets,
    );

    if (!bucketKey) {
      continue;
    }

    const accumulator = pointAccumulators.get(bucketKey);

    if (!accumulator) {
      continue;
    }

    pointAccumulators.set(bucketKey, {
      ...accumulator,
      appointmentsCount: accumulator.appointmentsCount + 1,
      cancelledCount:
        accumulator.cancelledCount +
        (appointment.status === "CANCELLED" ? 1 : 0),
      totalRevenueInCents:
        accumulator.totalRevenueInCents +
        getAppointmentNetRevenueInCents(appointment),
    });
  }

  return buckets.map((bucket) =>
    toPointSummary(pointAccumulators.get(bucket.date)!),
  );
}

function toPointSummary(accumulator: {
  date: string;
  label: string;
  appointmentsCount: number;
  cancelledCount: number;
  totalRevenueInCents: number;
}) {
  return {
    date: accumulator.date,
    label: accumulator.label,
    appointmentsCount: accumulator.appointmentsCount,
    totalRevenueInCents: accumulator.totalRevenueInCents,
    averageTicketInCents:
      accumulator.appointmentsCount === 0
        ? 0
        : Math.round(
            accumulator.totalRevenueInCents / accumulator.appointmentsCount,
          ),
    cancellationRate: calculateCancellationRate(
      accumulator.cancelledCount,
      accumulator.appointmentsCount,
    ),
  };
}

function calculateCancellationRate(
  cancelledCount: number,
  appointmentsCount: number,
) {
  if (appointmentsCount === 0) {
    return 0;
  }

  return Math.round((cancelledCount / appointmentsCount) * 1000) / 10;
}
