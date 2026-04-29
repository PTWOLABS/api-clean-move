import { PaginationParams } from "../../../shared/types/pagination-params";
import { CustomerVehicle } from "../../customer/domain/entities/customer-vehicle";

export type CustomerVehicleFilters = {
  includeDeleted?: boolean;
} & PaginationParams;

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
  ): Promise<CustomerVehicle[]>;
  abstract save(vehicle: CustomerVehicle): Promise<void>;
}
