import { PaginationParams } from "../../../shared/types/pagination-params";
import { CustomerVehicle } from "../../customer/domain/entities/customer-vehicle";

export type CustomerVehicleFilters = {
  includeDeleted?: boolean;
} & PaginationParams;

export const VEHICLE_LIST_SEARCH_TYPES = [
  "plate",
  "name",
  "model",
  "brand",
  "color",
  "year",
] as const;

export type VehicleListSearchType =
  (typeof VEHICLE_LIST_SEARCH_TYPES)[number];

export type EstablishmentCustomerVehicleFilters = {
  customerId?: string;
  search?: string;
  searchType?: VehicleListSearchType;
} & PaginationParams;

export type CustomerVehicleOption = {
  id: string;
  label: string;
};

export type CustomerVehicleOptionsFilters = {
  search?: string;
  customerId?: string;
  limit?: number;
};

export type PaginatedCustomerVehicles = {
  vehicles: CustomerVehicle[];
  totalItems: number;
};

export abstract class CustomerVehiclesRepository {
  abstract create(vehicle: CustomerVehicle): Promise<void>;
  abstract findById(id: string): Promise<CustomerVehicle | null>;
  abstract findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<CustomerVehicle | null>;
  abstract findByIdAndCustomerIdAndEstablishmentId(
    id: string,
    customerId: string,
    establishmentId: string,
  ): Promise<CustomerVehicle | null>;
  abstract findActiveByPlateAndEstablishmentId(
    plate: string,
    establishmentId: string,
  ): Promise<CustomerVehicle | null>;
  abstract findManyByCustomerIdAndEstablishmentId(
    customerId: string,
    establishmentId: string,
    filters?: CustomerVehicleFilters,
  ): Promise<PaginatedCustomerVehicles>;
  abstract findManyByEstablishmentId(
    establishmentId: string,
    filters?: EstablishmentCustomerVehicleFilters,
  ): Promise<PaginatedCustomerVehicles>;
  abstract findAllActiveByCustomerIdAndEstablishmentId(
    customerId: string,
    establishmentId: string,
  ): Promise<CustomerVehicle[]>;
  abstract findAllActiveByCustomerIdsAndEstablishmentId(
    customerIds: string[],
    establishmentId: string,
  ): Promise<CustomerVehicle[]>;
  abstract findOptionsByEstablishmentId(
    establishmentId: string,
    filters?: CustomerVehicleOptionsFilters,
  ): Promise<CustomerVehicleOption[]>;
  abstract save(vehicle: CustomerVehicle): Promise<void>;
}
