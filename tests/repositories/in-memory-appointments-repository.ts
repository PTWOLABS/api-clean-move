import {
  AppointmentFilters,
  AppointmentsRepository,
  PopularServiceUsageMetrics,
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

  private static matchesStatusFilter(
    appointment: Appointment,
    filters?: AppointmentFilters,
  ) {
    const status = filters?.status;

    if (!status) {
      return true;
    }

    if (Array.isArray(status)) {
      return status.length === 0 || status.includes(appointment.status);
    }

    return appointment.status === status;
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

  private filterByEstablishmentId(
    establishmentId: string,
    filters?: AppointmentFilters,
  ) {
    return this.items
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

        if (
          !InMemoryAppointmentsRepository.matchesStatusFilter(item, filters)
        ) {
          return false;
        }

        if (
          filters?.categories?.length &&
          (!item.service.category ||
            !filters.categories.includes(item.service.category))
        ) {
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
    const filteredAppointments = this.filterByEstablishmentId(
      establishmentId,
      filters,
    );

    const start = (page - 1) * size;
    const end = start + size;

    return filteredAppointments.slice(start, end);
  }

  async findPopularServiceUsagesByEstablishmentId(
    establishmentId: string,
    filters?: AppointmentFilters,
  ): Promise<PopularServiceUsageMetrics> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 20;
    const filteredAppointments = this.filterByEstablishmentId(
      establishmentId,
      filters,
    );
    const groupedByService = new Map<
      string,
      { serviceId: string; serviceName: string; usageCount: number }
    >();

    for (const appointment of filteredAppointments) {
      const serviceId = appointment.service.serviceId.toString();
      const current = groupedByService.get(serviceId);

      if (!current) {
        groupedByService.set(serviceId, {
          serviceId,
          serviceName: appointment.service.serviceName,
          usageCount: 1,
        });

        continue;
      }

      groupedByService.set(serviceId, {
        ...current,
        usageCount: current.usageCount + 1,
      });
    }

    const start = (page - 1) * size;
    const end = start + size;
    const items = Array.from(groupedByService.values())
      .sort((a, b) => {
        if (b.usageCount === a.usageCount) {
          const nameComparison = a.serviceName.localeCompare(b.serviceName);

          if (nameComparison !== 0) {
            return nameComparison;
          }

          return a.serviceId.localeCompare(b.serviceId);
        }

        return b.usageCount - a.usageCount;
      })
      .slice(start, end);

    return {
      items,
      totalUsages: filteredAppointments.length,
    };
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
