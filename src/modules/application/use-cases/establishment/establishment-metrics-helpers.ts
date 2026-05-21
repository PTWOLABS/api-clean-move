import {
  Appointment,
  AppointmentStatus,
} from "../../../scheduling/domain/entities/appointment";
import { ServiceCategory } from "../../../catalog/domain/value-objects/service-category";
import {
  AppointmentFilters,
  AppointmentsRepository,
} from "../../repositories/appointments-repository";

export type EstablishmentMetricsFilters = {
  startsAt?: Date;
  endsAt?: Date;
  categories?: ServiceCategory[];
  status?: AppointmentStatus[];
};

const PAGE_SIZE = 20;

export async function findAllAppointmentsByEstablishment(
  appointmentsRepository: AppointmentsRepository,
  establishmentId: string,
  filters?: EstablishmentMetricsFilters,
) {
  const allAppointments: Appointment[] = [];
  let page = 1;

  while (true) {
    const appointmentFilters: AppointmentFilters = {
      ...(filters?.startsAt ? { startsAt: filters.startsAt } : {}),
      ...(filters?.endsAt ? { endsAt: filters.endsAt } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.categories ? { categories: filters.categories } : {}),
      page,
      size: PAGE_SIZE,
    };

    const appointments = await appointmentsRepository.findManyByEstablishmentId(
      establishmentId,
      appointmentFilters,
    );

    if (appointments.length === 0) {
      break;
    }

    allAppointments.push(...appointments);

    if (appointments.length < PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return allAppointments;
}

export function getAppointmentNetRevenueInCents(appointment: Appointment) {
  const discountInCents = appointment.discountInCents?.amountInCents ?? 0;
  const gross = Appointment.totalServicesPriceInCents(appointment.services);

  return Math.max(gross - discountInCents, 0);
}

export function filterAppointmentsByMetrics(
  appointments: Appointment[],
  filters?: EstablishmentMetricsFilters,
) {
  return appointments.filter((appointment) => {
    if (filters?.startsAt && appointment.startsAt < filters.startsAt) {
      return false;
    }

    if (filters?.endsAt && appointment.startsAt > filters.endsAt) {
      return false;
    }

    if (
      filters?.status?.length &&
      !filters.status.includes(appointment.status)
    ) {
      return false;
    }

    if (filters?.categories?.length) {
      const hasMatchingCategory = appointment.services.some(
        (service) =>
          service.category && filters.categories!.includes(service.category),
      );

      if (!hasMatchingCategory) {
        return false;
      }
    }

    return true;
  });
}
