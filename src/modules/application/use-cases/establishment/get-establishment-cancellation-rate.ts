import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
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
    total: number;
    byStatus: {
      scheduled: number;
      done: number;
      cancelled: number;
    };
    rates: {
      completion: number;
      cancellation: number;
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
        ...(filters?.categoryIds !== undefined
          ? { categoryIds: filters.categoryIds }
          : {}),
      },
    );
    const scheduled = currentAppointments.filter(
      (appointment) => appointment.status === "SCHEDULED",
    ).length;
    const done = currentAppointments.filter(
      (appointment) => appointment.status === "DONE",
    ).length;
    const cancelled = currentAppointments.filter(
      (appointment) => appointment.status === "CANCELLED",
    ).length;
    const total = currentAppointments.length;

    return right({
      total,
      byStatus: {
        scheduled,
        done,
        cancelled,
      },
      rates: {
        completion: calculateRate(done, total),
        cancellation: calculateRate(cancelled, total),
      },
    });
  }
}

function calculateRate(count: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Math.round((count / total) * 1000) / 10;
}
