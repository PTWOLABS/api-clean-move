import { PaginationParams } from "../../../shared/types/pagination-params";
import {
  Appointment,
  AppointmentStatus,
} from "../../scheduling/domain/entities/appointment";

export type CalendarAppointmentFilters = {
  startsAt: Date;
  endsAt: Date;
  status?: AppointmentStatus;
};

export type AppointmentFilters = {
  search?: string;
  customerId?: string;
  customerName?: string;
  customerNickname?: string;
  vehicleId?: string;
  vehiclePlate?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  serviceId?: string;
  serviceName?: string;
  status?: AppointmentStatus | AppointmentStatus[];
  categoryIds?: string[];
  startsAt?: Date;
  endsAt?: Date;
} & PaginationParams;

export type AppointmentListResult = {
  appointments: Appointment[];
  totalItems: number;
};

export type PopularServiceUsageMetric = {
  serviceId: string;
  serviceName: string;
  usageCount: number;
};

export type PopularServiceUsageMetrics = {
  items: PopularServiceUsageMetric[];
  totalUsages: number;
};

export type TopCustomerMetric = {
  customerId: string;
  customerName: string;
  completedAppointmentsCount: number;
  totalSpentInCents: number;
};

export type TopCustomerMetrics = {
  items: TopCustomerMetric[];
  totalCustomers: number;
};

export type TopCustomersFilters = {
  startsAt?: Date;
  endsAt?: Date;
} & PaginationParams;

export abstract class AppointmentsRepository {
  abstract create(appointment: Appointment): Promise<void>;
  abstract findById(id: string): Promise<Appointment | null>;
  abstract findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<Appointment | null>;
  abstract findManyByEstablishmentId(
    establishmentId: string,
    filters?: AppointmentFilters,
  ): Promise<AppointmentListResult>;
  abstract findManyByEstablishmentIdInCalendarRange(
    establishmentId: string,
    filters: CalendarAppointmentFilters,
  ): Promise<AppointmentListResult>;
  abstract findPopularServiceUsagesByEstablishmentId(
    establishmentId: string,
    filters?: AppointmentFilters,
  ): Promise<PopularServiceUsageMetrics>;
  abstract findTopCustomersByEstablishmentId(
    establishmentId: string,
    filters?: TopCustomersFilters,
  ): Promise<TopCustomerMetrics>;
  abstract save(appointment: Appointment): Promise<void>;
}
