import {
  AppointmentFilters,
  AppointmentsRepository,
} from "../../src/modules/application/repositories/appointments-repository";
import { Appointment } from "../../src/modules/scheduling/domain/entities/appointment";

export class InMemoryAppointmentsRepository implements AppointmentsRepository {
  public items: Appointment[] = [];

  async create(appointment: Appointment): Promise<void> {
    this.items.push(appointment);
  }

  async findById(id: string): Promise<Appointment | null> {
    const appointment = this.items.find((item) => item.id.toString() === id);

    if (!appointment) {
      return null;
    }

    return appointment;
  }

  async findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<Appointment | null> {
    const appointment = this.items.find(
      (item) =>
        item.id.toString() === id &&
        item.establishmentId.toString() === establishmentId,
    );

    if (!appointment) {
      return null;
    }

    return appointment;
  }

  async findManyByEstablishmentId(
    establishmentId: string,
    filters?: AppointmentFilters,
  ): Promise<Appointment[]> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 20;

    const filteredAppointments = this.items
      .slice()
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .filter((item) => item.establishmentId.toString() === establishmentId)
      .filter((item) => {
        if (
          filters?.customerId &&
          item.customerId.toString() !== filters.customerId
        ) {
          return false;
        }

        if (
          filters?.vehicleId &&
          item.vehicleId?.toString() !== filters.vehicleId
        ) {
          return false;
        }

        if (
          filters?.serviceId &&
          item.service.serviceId.toString() !== filters.serviceId
        ) {
          return false;
        }

        if (filters?.status && item.status !== filters.status) {
          return false;
        }

        if (filters?.startsAt && item.startsAt < filters.startsAt) {
          return false;
        }

        if (filters?.endsAt && item.startsAt > filters.endsAt) {
          return false;
        }

        return true;
      });

    const start = (page - 1) * size;
    const end = start + size;

    return filteredAppointments.slice(start, end);
  }

  async save(appointment: Appointment): Promise<void> {
    const appointmentIndex = this.items.findIndex((item) =>
      item.id.equals(appointment.id),
    );

    if (appointmentIndex === -1) {
      this.items.push(appointment);
      return;
    }

    this.items[appointmentIndex] = appointment;
  }
}
