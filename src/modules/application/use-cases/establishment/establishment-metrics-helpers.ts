import { AppointmentStatus } from "../../../scheduling/domain/entities/appointment";
import { ServiceCategory } from "../../../catalog/domain/value-objects/service-category";
import { AppointmentsRepository } from "../../repositories/appointments-repository";
import { ServicesRepository } from "../../repositories/services-repository";

export type EstablishmentMetricsFilters = {
  startsAt?: Date;
  endsAt?: Date;
  categories?: ServiceCategory[];
  status?: AppointmentStatus[];
};

const PAGE_SIZE = 100;

export async function findAllServicesByEstablishment(
  servicesRepository: ServicesRepository,
  establishmentId: string,
) {
  const allServices = [];
  let page = 1;

  while (true) {
    const services = await servicesRepository.findManyByEstablishmentId(
      establishmentId,
      {
        page,
        size: PAGE_SIZE,
      },
    );

    if (services.length === 0) {
      break;
    }

    allServices.push(...services);

    if (services.length < PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return allServices;
}

export async function findAllAppointmentsByEstablishment(
  appointmentsRepository: AppointmentsRepository,
  establishmentId: string,
) {
  const allAppointments = [];
  let page = 1;

  while (true) {
    const appointments = await appointmentsRepository.findManyByEstablishmentId(
      establishmentId,
      {
        page,
        size: PAGE_SIZE,
      },
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

export function filterAppointmentsByMetrics(
  appointments: Awaited<ReturnType<typeof findAllAppointmentsByEstablishment>>,
  servicesById: Map<string, ServiceCategory | undefined>,
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
      const serviceCategory = servicesById.get(
        appointment.service.serviceId.toString(),
      );

      if (!serviceCategory || !filters.categories.includes(serviceCategory)) {
        return false;
      }
    }

    return true;
  });
}
