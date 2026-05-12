import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { AppointmentsRepository } from "../../repositories/appointments-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import {
  EstablishmentMetricsFilters,
  filterAppointmentsByMetrics,
  findAllAppointmentsByEstablishment,
  getAppointmentNetRevenueInCents,
} from "./establishment-metrics-helpers";

type GetEstablishmentRevenueVsAppointmentsUseCaseRequest = {
  establishmentOwnerId: string;
  filters?: EstablishmentMetricsFilters;
};

type RevenueVsAppointmentsPoint = {
  period: string;
  revenueInCents: number;
  appointmentsCount: number;
};

type GetEstablishmentRevenueVsAppointmentsUseCaseResponse = Either<
  ResourceNotFoundError,
  {
    points: RevenueVsAppointmentsPoint[];
  }
>;

function formatPeriod(date: Date) {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class GetEstablishmentRevenueVsAppointmentsUseCase {
  constructor(
    private establishmentsRepository: EstablishmentsRepository,
    private appointmentsRepository: AppointmentsRepository,
  ) {}

  async execute({
    establishmentOwnerId,
    filters,
  }: GetEstablishmentRevenueVsAppointmentsUseCaseRequest): Promise<GetEstablishmentRevenueVsAppointmentsUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(establishmentOwnerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const appointments = await findAllAppointmentsByEstablishment(
      this.appointmentsRepository,
      establishment.id.toString(),
    );

    const filteredAppointments = filterAppointmentsByMetrics(
      appointments,
      filters,
    );

    const pointsMap = new Map<string, RevenueVsAppointmentsPoint>();

    for (const appointment of filteredAppointments) {
      const period = formatPeriod(appointment.startsAt);
      const currentPoint = pointsMap.get(period);
      const netRevenueInCents = getAppointmentNetRevenueInCents(appointment);

      if (!currentPoint) {
        pointsMap.set(period, {
          period,
          appointmentsCount: 1,
          revenueInCents: netRevenueInCents,
        });

        continue;
      }

      pointsMap.set(period, {
        ...currentPoint,
        appointmentsCount: currentPoint.appointmentsCount + 1,
        revenueInCents: currentPoint.revenueInCents + netRevenueInCents,
      });
    }

    const points = Array.from(pointsMap.values()).sort((a, b) =>
      a.period.localeCompare(b.period),
    );

    return right({
      points,
    });
  }
}
