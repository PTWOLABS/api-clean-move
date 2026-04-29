import { PaginationParams } from "../../../shared/types/pagination-params";
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
  status?: AppointmentStatus;
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
  ): Promise<Appointment[]>;
  abstract save(appointment: Appointment): Promise<void>;
}
