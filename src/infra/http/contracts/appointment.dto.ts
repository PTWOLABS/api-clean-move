import { ServiceCategory } from "../../../modules/catalog/domain/value-objects/service-category";
import { AppointmentStatus } from "../../../modules/scheduling/domain/entities/appointment";

export type ServiceCategoryCode = ServiceCategory;

export type AppointmentServiceDTO = {
  id: string;
  name: string;
  category: ServiceCategoryCode | null;
  durationInMinutes: number | null;
  priceInCents: number;
};

export type AppointmentCustomerDTO = {
  fullName: string;
};

export type AppointmentItemDTO = {
  id: string;
  establishmentId: string;
  customerId: string;
  customer: AppointmentCustomerDTO;
  vehicleId: string | null;
  services: AppointmentServiceDTO[];
  vehicle: {
    plate: string | null;
    brand: string | null;
    model: string | null;
    color: string | null;
    year: number | null;
  } | null;
  startsAt: string;
  endsAt: string | null;
  description: string | null;
  discountInCents: number | null;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
  doneAt: string | null;
  cancelledAt: string | null;
};

export type AppointmentListDTO = {
  appointments: AppointmentItemDTO[];
};

export type AppointmentSingleResponseDTO = {
  appointment: AppointmentItemDTO;
};
