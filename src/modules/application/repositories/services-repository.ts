import { PaginationParams } from "../../../shared/types/pagination-params";
import { Service } from "../../catalog/domain/entities/services";
import { ServiceCategory } from "../../catalog/domain/value-objects/service-category";

export type ServiceFilters = {
  serviceName?: string;
  category?: ServiceCategory;
  minPrice?: number;
  maxPrice?: number;
  isActive?: boolean;
} & PaginationParams;

export type PaginatedServices = {
  items: Service[];
  totalItems: number;
};

export abstract class ServicesRepository {
  abstract create(service: Service): Promise<void>;
  abstract findManyByEstablishmentId(
    establishmentId: string,
    filters?: ServiceFilters,
  ): Promise<PaginatedServices>;
  abstract findById(id: string): Promise<Service | null>;
  abstract findByIdIncludingSoftDeleted(id: string): Promise<Service | null>;
  abstract findByServiceIdAndEstablishmentId(
    serviceId: string,
    establishmentId: string,
  ): Promise<Service | null>;
  abstract save(service: Service): Promise<void>;
  abstract findMany(filters?: ServiceFilters): Promise<PaginatedServices>;
}
