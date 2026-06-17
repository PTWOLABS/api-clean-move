import {
  AppointmentFilters,
  AppointmentListResult,
  AppointmentsRepository,
  CalendarAppointmentFilters,
  PopularServiceUsageMetrics,
  TopCustomerMetrics,
  TopCustomersFilters,
} from "../../src/modules/application/repositories/appointments-repository";
import { Customer } from "../../src/modules/customer/domain/entities/customer";
import { Appointment } from "../../src/modules/scheduling/domain/entities/appointment";
import { appointmentIntersectsRange } from "../../src/modules/scheduling/domain/services/appointment-intersects-range";

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

  private static buildVehicleDisplayName(appointment: Appointment) {
    const vehicle = appointment.vehicle;

    if (!vehicle) {
      return null;
    }

    const parts = [vehicle.brand, vehicle.model, vehicle.year]
      .filter((part) => part !== null && part !== undefined)
      .map((part) => String(part).trim())
      .filter((part) => part.length > 0);

    return parts.length > 0 ? parts.join(" ") : null;
  }

  private static getNetRevenueInCents(appointment: Appointment) {
    const gross = Appointment.totalServicesPriceInCents(appointment.services);
    const discountInCents = appointment.discountInCents?.amountInCents ?? 0;

    return Math.max(gross - discountInCents, 0);
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

  private static matchesServiceFilters(
    appointment: Appointment,
    filters?: AppointmentFilters,
  ) {
    if (
      filters?.serviceId &&
      !appointment.services.some(
        (service) => service.serviceId.toString() === filters.serviceId,
      )
    ) {
      return false;
    }

    if (
      filters?.categoryIds?.length &&
      !appointment.services.some(
        (service) =>
          service.category &&
          filters.categoryIds!.includes(service.category.id.toString()),
      )
    ) {
      return false;
    }

    return true;
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
      !appointment.services.some((service) =>
        InMemoryAppointmentsRepository.matchesText(
          service.serviceName,
          serviceName,
        ),
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
      ...appointment.services.map((service) => service.serviceName),
      appointment.vehicle?.brand,
      appointment.vehicle?.model,
      InMemoryAppointmentsRepository.buildVehicleDisplayName(appointment),
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
      .filter((item) => !item.isDeleted())
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
          !InMemoryAppointmentsRepository.matchesStatusFilter(item, filters)
        ) {
          return false;
        }

        if (
          !InMemoryAppointmentsRepository.matchesServiceFilters(item, filters)
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

  private filterDoneByEstablishmentId(
    establishmentId: string,
    filters?: TopCustomersFilters,
  ) {
    return this.items
      .slice()
      .filter((item) => item.establishmentId.toString() === establishmentId)
      .filter((item) => !item.isDeleted())
      .filter((item) => item.status === "DONE")
      .filter((item) => {
        if (filters?.startsAt && item.startsAt < filters.startsAt) {
          return false;
        }

        if (filters?.endsAt && item.startsAt > filters.endsAt) {
          return false;
        }

        return true;
      });
  }

  async create(appointment: Appointment): Promise<void> {
    this.items.push(appointment);
  }

  async findById(id: string): Promise<Appointment | null> {
    const appointment = this.items.find(
      (item) => item.id.toString() === id && !item.isDeleted(),
    );

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
        item.establishmentId.toString() === establishmentId &&
        !item.isDeleted(),
    );

    if (!appointment) {
      return null;
    }

    return appointment;
  }

  async findManyByEstablishmentIdInCalendarRange(
    establishmentId: string,
    filters: CalendarAppointmentFilters,
  ): Promise<AppointmentListResult> {
    const appointments = this.items
      .slice()
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .filter((item) => item.establishmentId.toString() === establishmentId)
      .filter((item) => !item.isDeleted())
      .filter((item) => {
        if (filters.status && item.status !== filters.status) {
          return false;
        }

        return appointmentIntersectsRange(
          item.startsAt,
          item.endsAt,
          filters.startsAt,
          filters.endsAt,
        );
      });

    return {
      appointments,
      totalItems: appointments.length,
    };
  }

  async findManyByEstablishmentId(
    establishmentId: string,
    filters?: AppointmentFilters,
  ): Promise<AppointmentListResult> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 20;
    const filteredAppointments = this.filterByEstablishmentId(
      establishmentId,
      filters,
    );

    const start = (page - 1) * size;
    const end = start + size;

    return {
      appointments: filteredAppointments.slice(start, end),
      totalItems: filteredAppointments.length,
    };
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
      for (const service of appointment.services) {
        const serviceId = service.serviceId.toString();
        const current = groupedByService.get(serviceId);

        if (!current) {
          groupedByService.set(serviceId, {
            serviceId,
            serviceName: service.serviceName,
            usageCount: 1,
          });

          continue;
        }

        groupedByService.set(serviceId, {
          ...current,
          usageCount: current.usageCount + 1,
        });
      }
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

    const totalUsages = filteredAppointments.reduce(
      (total, appointment) => total + appointment.services.length,
      0,
    );

    return {
      items,
      totalUsages,
    };
  }

  async findTopCustomersByEstablishmentId(
    establishmentId: string,
    filters?: TopCustomersFilters,
  ): Promise<TopCustomerMetrics> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 5;
    const appointments = this.filterDoneByEstablishmentId(
      establishmentId,
      filters,
    );
    const groupedByCustomer = new Map<
      string,
      {
        customerId: string;
        customerName: string;
        completedAppointmentsCount: number;
        totalSpentInCents: number;
      }
    >();

    for (const appointment of appointments) {
      const customerId = appointment.customerId.toString();
      const current = groupedByCustomer.get(customerId);

      if (!current) {
        groupedByCustomer.set(customerId, {
          customerId,
          customerName: appointment.customer.fullName,
          completedAppointmentsCount: 1,
          totalSpentInCents:
            InMemoryAppointmentsRepository.getNetRevenueInCents(appointment),
        });

        continue;
      }

      groupedByCustomer.set(customerId, {
        ...current,
        completedAppointmentsCount: current.completedAppointmentsCount + 1,
        totalSpentInCents:
          current.totalSpentInCents +
          InMemoryAppointmentsRepository.getNetRevenueInCents(appointment),
      });
    }

    const rankedCustomers = Array.from(groupedByCustomer.values()).sort(
      (a, b) => {
        if (b.completedAppointmentsCount !== a.completedAppointmentsCount) {
          return b.completedAppointmentsCount - a.completedAppointmentsCount;
        }

        if (b.totalSpentInCents !== a.totalSpentInCents) {
          return b.totalSpentInCents - a.totalSpentInCents;
        }

        const nameComparison = a.customerName.localeCompare(b.customerName);

        if (nameComparison !== 0) {
          return nameComparison;
        }

        return a.customerId.localeCompare(b.customerId);
      },
    );
    const start = (page - 1) * size;
    const end = start + size;

    return {
      items: rankedCustomers.slice(start, end),
      totalCustomers: rankedCustomers.length,
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
