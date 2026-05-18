import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import {
  buildDashboardMetricBuckets,
  calculateTrendPercent,
  getDashboardMetricBucketKey,
  ResolvedDashboardMetricGranularity,
} from "../../services/dashboard-metrics-bucket-builder";
import { ResolvedDashboardMetricsRange } from "../../services/dashboard-metrics-range-resolver";
import { AppointmentsRepository } from "../../repositories/appointments-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import {
  EstablishmentMetricsFilters,
  findAllAppointmentsByEstablishment,
  getAppointmentNetRevenueInCents,
} from "./establishment-metrics-helpers";

type GetEstablishmentRevenueVsAppointmentsUseCaseRequest = {
  establishmentOwnerId: string;
  range: ResolvedDashboardMetricsRange;
  granularity: ResolvedDashboardMetricGranularity;
  filters?: EstablishmentMetricsFilters;
};

type RevenueVsAppointmentsPoint = {
  date: string;
  label: string;
  revenueInCents: number;
  appointments: number;
};

type RevenueVsAppointmentsSummary = {
  revenueInCents: number;
  appointments: number;
  revenueTrendPercent: number | null;
  appointmentsTrendPercent: number | null;
};

type GetEstablishmentRevenueVsAppointmentsUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    points: RevenueVsAppointmentsPoint[];
    summary: RevenueVsAppointmentsSummary;
  }
>;

@Injectable()
export class GetEstablishmentRevenueVsAppointmentsUseCase {
  constructor(
    private establishmentsRepository: EstablishmentsRepository,
    private appointmentsRepository: AppointmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    range,
    granularity,
    filters,
  }: GetEstablishmentRevenueVsAppointmentsUseCaseRequest): Promise<GetEstablishmentRevenueVsAppointmentsUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const effectiveStatus = filters?.status ?? ["DONE"];
    const currentAppointments = await findAllAppointmentsByEstablishment(
      this.appointmentsRepository,
      establishment.id.toString(),
      {
        startsAt: range.current.startsAt,
        endsAt: range.current.endsAt,
        ...(filters?.categories !== undefined
          ? { categories: filters.categories }
          : {}),
        status: effectiveStatus,
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
        status: effectiveStatus,
      },
    );

    const buckets = buildDashboardMetricBuckets(range.current, granularity);
    const pointsMap = new Map(
      buckets.map((bucket) => [
        bucket.date,
        {
          date: bucket.date,
          label: bucket.label,
          appointments: 0,
          revenueInCents: 0,
        },
      ]),
    );

    for (const appointment of currentAppointments) {
      const bucketKey = getDashboardMetricBucketKey(
        appointment.startsAt,
        buckets,
      );

      if (!bucketKey) {
        continue;
      }

      const currentPoint = pointsMap.get(bucketKey);

      if (!currentPoint) {
        continue;
      }

      pointsMap.set(bucketKey, {
        ...currentPoint,
        appointments: currentPoint.appointments + 1,
        revenueInCents:
          currentPoint.revenueInCents +
          getAppointmentNetRevenueInCents(appointment),
      });
    }

    const points = buckets.map((bucket) => pointsMap.get(bucket.date)!);
    const currentRevenueInCents = points.reduce(
      (total, point) => total + point.revenueInCents,
      0,
    );
    const currentAppointmentsCount = points.reduce(
      (total, point) => total + point.appointments,
      0,
    );
    const comparisonRevenueInCents = comparisonAppointments.reduce(
      (total, appointment) =>
        total + getAppointmentNetRevenueInCents(appointment),
      0,
    );
    const comparisonAppointmentsCount = comparisonAppointments.length;

    return right({
      points,
      summary: {
        revenueInCents: currentRevenueInCents,
        appointments: currentAppointmentsCount,
        revenueTrendPercent: calculateTrendPercent(
          currentRevenueInCents,
          comparisonRevenueInCents,
        ),
        appointmentsTrendPercent: calculateTrendPercent(
          currentAppointmentsCount,
          comparisonAppointmentsCount,
        ),
      },
    });
  }
}
