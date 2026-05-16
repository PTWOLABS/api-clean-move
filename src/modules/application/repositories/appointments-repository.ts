import { PaginationParams } from "../../../shared/types/pagination-params";
import { ServiceCategory } from "../../catalog/domain/value-objects/service-category";
import {
  Appointment,
  AppointmentStatus,
} from "../../scheduling/domain/entities/appointment";

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
  categories?: ServiceCategory[];
  startsAt?: Date;
  endsAt?: Date;
} & PaginationParams;

export type PopularServiceUsageMetric = {
  serviceId: string;
  serviceName: string;
  usageCount: number;
};

export type PopularServiceUsageMetrics = {
  items: PopularServiceUsageMetric[];
  totalUsages: number;
};

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
  ): Promise<Appointment[]>;
  abstract findPopularServiceUsagesByEstablishmentId(
    establishmentId: string,
    filters?: AppointmentFilters,
  ): Promise<PopularServiceUsageMetrics>;
  abstract save(appointment: Appointment): Promise<void>;
}
