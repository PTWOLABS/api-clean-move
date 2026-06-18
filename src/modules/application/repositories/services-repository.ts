import { PaginationParams } from "../../../shared/types/pagination-params";
import { Service } from "../../catalog/domain/entities/services";
import { ServicePriceSpecificationValue } from "../../catalog/domain/value-objects/service-price-specification";
export type ServiceFilters = {
  serviceName?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  isActive?: boolean;
} & PaginationParams;

export type PaginatedServices = {
  items: Service[];
  totalItems: number;
};

export type ServiceOption = {
  id: string;
  label: string;
  priceInCents: number;
  priceSpecification: ServicePriceSpecificationValue;
};

export type ServiceOptionsFilters = {
  search?: string;
  limit?: number;
};

export abstract class ServicesRepository {
  abstract create(service: Service): Promise<void>;
  abstract findManyByEstablishmentId(
    establishmentId: string,
    filters?: ServiceFilters,
  ): Promise<PaginatedServices>;
  abstract findOptionsByEstablishmentId(
    establishmentId: string,
    filters?: ServiceOptionsFilters,
  ): Promise<ServiceOption[]>;
  abstract findById(id: string): Promise<Service | null>;
  abstract findByIdIncludingSoftDeleted(id: string): Promise<Service | null>;
  abstract findByServiceIdAndEstablishmentId(
    serviceId: string,
    establishmentId: string,
  ): Promise<Service | null>;
  abstract findManyByIdsAndEstablishmentIdIncludingDeleted(
    ids: string[],
    establishmentId: string,
  ): Promise<Service[]>;
  abstract save(service: Service): Promise<void>;
  abstract findMany(filters?: ServiceFilters): Promise<PaginatedServices>;
  abstract clearCategoryFromServices(categoryId: string): Promise<number>;
}
