import { Either, left, right } from "../../../../shared/either";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { AppointmentsRepository } from "../../repositories/appointments-repository";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import { ServicesRepository } from "../../repositories/services-repository";
import {
  EstablishmentMetricsFilters,
  filterAppointmentsByMetrics,
  findAllAppointmentsByEstablishment,
  findAllServicesByEstablishment,
} from "./establishment-metrics-helpers";

type GetEstablishmentRevenueVsAppointmentsUseCaseRequest = {
  establishmentId: string;
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

export class GetEstablishmentRevenueVsAppointmentsUseCase {
  constructor(
    private establishmentsRepository: EstablishmentsRepository,
    private appointmentsRepository: AppointmentsRepository,
    private servicesRepository: ServicesRepository,
  ) {}

  async execute({
    establishmentId,
    filters,
  }: GetEstablishmentRevenueVsAppointmentsUseCaseRequest): Promise<GetEstablishmentRevenueVsAppointmentsUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findById(establishmentId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    const services = await findAllServicesByEstablishment(
      this.servicesRepository,
      establishmentId,
    );

    const servicesById = new Map(
      services.map((service) => [service.id.toString(), service.category]),
    );

    const appointments = await findAllAppointmentsByEstablishment(
      this.appointmentsRepository,
      establishmentId,
    );

    const filteredAppointments = filterAppointmentsByMetrics(
      appointments,
      servicesById,
      filters,
    );

    const pointsMap = new Map<string, RevenueVsAppointmentsPoint>();

    for (const appointment of filteredAppointments) {
      const period = formatPeriod(appointment.startsAt);
      const currentPoint = pointsMap.get(period);

      if (!currentPoint) {
        pointsMap.set(period, {
          period,
          appointmentsCount: 1,
          revenueInCents: appointment.service.priceInCents,
        });

        continue;
      }

      pointsMap.set(period, {
        ...currentPoint,
        appointmentsCount: currentPoint.appointmentsCount + 1,
        revenueInCents:
          currentPoint.revenueInCents + appointment.service.priceInCents,
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
