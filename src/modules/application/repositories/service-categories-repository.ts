import { ServiceCategory } from "../../catalog/domain/entities/service-category";

export type ServiceCategoryOption = {
  id: string;
  label: string;
};

export type ServiceCategoryOptionsFilters = {
  search?: string;
  limit?: number;
};

export type ServiceCategoryFilters = {
  includeDeleted?: boolean;
};

export abstract class ServiceCategoriesRepository {
  abstract create(category: ServiceCategory): Promise<void>;
  abstract createMany(categories: ServiceCategory[]): Promise<void>;
  abstract findById(id: string): Promise<ServiceCategory | null>;
  abstract findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<ServiceCategory | null>;
  abstract findByNameAndEstablishmentId(
    name: string,
    establishmentId: string,
  ): Promise<ServiceCategory | null>;
  abstract findManyByEstablishmentId(
    establishmentId: string,
    filters?: ServiceCategoryFilters,
  ): Promise<ServiceCategory[]>;
  abstract findOptionsByEstablishmentId(
    establishmentId: string,
    filters?: ServiceCategoryOptionsFilters,
  ): Promise<ServiceCategoryOption[]>;
  abstract countActiveServicesByCategoryId(categoryId: string): Promise<number>;
  abstract save(category: ServiceCategory): Promise<void>;
}
