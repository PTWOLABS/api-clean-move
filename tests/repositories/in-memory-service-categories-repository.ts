import {
  ServiceCategoriesRepository,
  ServiceCategoryFilters,
  ServiceCategoryOptionsFilters,
  ServiceCategoryOptionsResult,
} from "../../src/modules/application/repositories/service-categories-repository";
import { ServiceCategory } from "../../src/modules/catalog/domain/entities/service-category";

export class InMemoryServiceCategoriesRepository implements ServiceCategoriesRepository {
  public items: ServiceCategory[] = [];

  async create(category: ServiceCategory): Promise<void> {
    this.items.push(category);
  }

  async createMany(categories: ServiceCategory[]): Promise<void> {
    this.items.push(...categories);
  }

  async findById(id: string): Promise<ServiceCategory | null> {
    return this.items.find((item) => item.id.toString() === id) ?? null;
  }

  async findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<ServiceCategory | null> {
    return (
      this.items.find(
        (item) =>
          item.id.toString() === id &&
          item.establishmentId.toString() === establishmentId,
      ) ?? null
    );
  }

  async findByNameAndEstablishmentId(
    name: string,
    establishmentId: string,
  ): Promise<ServiceCategory | null> {
    const normalizedName = name.trim().toLowerCase();

    return (
      this.items.find(
        (item) =>
          item.establishmentId.toString() === establishmentId &&
          !item.isDeleted() &&
          item.name.value.toLowerCase() === normalizedName,
      ) ?? null
    );
  }

  async findManyByEstablishmentId(
    establishmentId: string,
    filters?: ServiceCategoryFilters,
  ): Promise<ServiceCategory[]> {
    return this.items
      .filter((item) => item.establishmentId.toString() === establishmentId)
      .filter((item) => filters?.includeDeleted || !item.isDeleted())
      .sort((a, b) => a.name.value.localeCompare(b.name.value));
  }

  async findOptionsByEstablishmentId(
    establishmentId: string,
    filters?: ServiceCategoryOptionsFilters,
  ): Promise<ServiceCategoryOptionsResult> {
    const size = filters?.size ?? 20;
    const search = filters?.search?.trim().toLowerCase();

    const filtered = this.items
      .filter(
        (item) =>
          item.establishmentId.toString() === establishmentId &&
          !item.isDeleted(),
      )
      .filter((item) =>
        search ? item.name.value.toLowerCase().includes(search) : true,
      )
      .sort((a, b) => a.name.value.localeCompare(b.name.value));

    return {
      categories: filtered.slice(0, size).map((item) => ({
        id: item.id.toString(),
        label: item.name.value,
      })),
      totalItems: filtered.length,
    };
  }

  async save(category: ServiceCategory): Promise<void> {
    const index = this.items.findIndex(
      (item) => item.id.toString() === category.id.toString(),
    );

    if (index >= 0) {
      this.items[index] = category;
    }
  }
}
