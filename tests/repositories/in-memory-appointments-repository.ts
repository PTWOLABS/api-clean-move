import {
  AppointmentFilters,
  AppointmentsRepository,
} from "../../src/modules/application/repositories/appointments-repository";
import { Customer } from "../../src/modules/customer/domain/entities/customer";
import { Appointment } from "../../src/modules/scheduling/domain/entities/appointment";

type AppointmentCustomerSearchData = {
  fullName?: string | null;
  nickname?: string | null;
};

export class InMemoryAppointmentsRepository implements AppointmentsRepository {
  public items: Appointment[] = [];

  constructor(
    private readonly customersRepository?: {
      items: Customer[];
    },
  ) {}

  private static normalizeTextFilter(value?: string): string | undefined {
    const normalized = value?.trim();

    return normalized || undefined;
  }

  private static normalizePlateFilter(value?: string): string | undefined {
    const normalized = value?.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    return normalized || undefined;
  }

  private static matchesText(value: string | null | undefined, filter: string) {
    return value?.toLowerCase().includes(filter.toLowerCase()) ?? false;
  }

  private getCustomerSearchData(
    customerId: string,
  ): AppointmentCustomerSearchData | undefined {
    const customer = this.customersRepository?.items.find(
      (item) => item.id.toString() === customerId,
    );

    if (!customer) {
      return undefined;
    }

    return {
      fullName: customer.fullName,
      nickname: customer.nickname,
    };
  }

  private matchesTextFilters(
    appointment: Appointment,
    filters?: AppointmentFilters,
  ) {
    const search = InMemoryAppointmentsRepository.normalizeTextFilter(
      filters?.search,
    );
    const normalizedSearchPlate =
      InMemoryAppointmentsRepository.normalizePlateFilter(search);
    const customerName = InMemoryAppointmentsRepository.normalizeTextFilter(
      filters?.customerName,
    );
    const customerNickname = InMemoryAppointmentsRepository.normalizeTextFilter(
      filters?.customerNickname,
    );
    const serviceName = InMemoryAppointmentsRepository.normalizeTextFilter(
      filters?.serviceName,
    );
    const vehiclePlate = InMemoryAppointmentsRepository.normalizePlateFilter(
      filters?.vehiclePlate,
    );
    const vehicleBrand = InMemoryAppointmentsRepository.normalizeTextFilter(
      filters?.vehicleBrand,
    );
    const vehicleModel = InMemoryAppointmentsRepository.normalizeTextFilter(
      filters?.vehicleModel,
    );
    const customerSearchData = this.getCustomerSearchData(
      appointment.customerId.toString(),
    );

    if (
      customerName &&
      !InMemoryAppointmentsRepository.matchesText(
        customerSearchData?.fullName,
        customerName,
      )
    ) {
      return false;
    }

    if (
      customerNickname &&
      !InMemoryAppointmentsRepository.matchesText(
        customerSearchData?.nickname,
        customerNickname,
      )
    ) {
      return false;
    }

    if (
      serviceName &&
      !InMemoryAppointmentsRepository.matchesText(
        appointment.service.serviceName,
        serviceName,
      )
    ) {
      return false;
    }

    if (
      vehiclePlate &&
      !InMemoryAppointmentsRepository.matchesText(
        appointment.vehicle?.plate,
        vehiclePlate,
      )
    ) {
      return false;
    }

    if (
      vehicleBrand &&
      !InMemoryAppointmentsRepository.matchesText(
        appointment.vehicle?.brand,
        vehicleBrand,
      )
    ) {
      return false;
    }

    if (
      vehicleModel &&
      !InMemoryAppointmentsRepository.matchesText(
        appointment.vehicle?.model,
        vehicleModel,
      )
    ) {
      return false;
    }

    if (!search) {
      return true;
    }

    const searchableValues = [
      appointment.service.serviceName,
      appointment.vehicle?.brand,
      appointment.vehicle?.model,
      customerSearchData?.fullName,
      customerSearchData?.nickname,
      normalizedSearchPlate ? appointment.vehicle?.plate : null,
    ];

    return searchableValues.some((value) =>
      InMemoryAppointmentsRepository.matchesText(
        value,
        value === appointment.vehicle?.plate && normalizedSearchPlate
          ? normalizedSearchPlate
          : search,
      ),
    );
  }

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

        return this.matchesTextFilters(item, filters);
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
