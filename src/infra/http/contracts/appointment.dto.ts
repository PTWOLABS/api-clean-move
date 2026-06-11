import { AppointmentStatus } from "../../../modules/scheduling/domain/entities/appointment";

export type ServiceCategoryDTO = {
  id: string;
  name: string;
};

export type AppointmentServiceDTO = {
  id: string;
  name: string;
  category: ServiceCategoryDTO | null;
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
    displayName: string | null;
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
  totalItems: number;
};

export type AppointmentSingleResponseDTO = {
  appointment: AppointmentItemDTO;
};
