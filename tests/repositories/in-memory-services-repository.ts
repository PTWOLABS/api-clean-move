import {
  type PaginatedServices,
  type ServiceFilters,
  type ServiceOptionsFilters,
  type ServiceOptionsResult,
  ServicesRepository,
} from "../../src/modules/application/repositories/services-repository";
import { Service } from "../../src/modules/catalog/domain/entities/services";

function nameMatchesFilter(serviceName: string, filter: string): boolean {
  return serviceName.toLowerCase().includes(filter.trim().toLowerCase());
}

export class InMemoryServicesRepository implements ServicesRepository {
  public items: Service[] = [];

  async create(service: Service): Promise<void> {
    this.items.push(service);
  }

  async findById(id: string): Promise<Service | null> {
    const service = this.items.find((item) => item.id.toString() === id);

    if (!service || service.isDeleted()) {
      return null;
    }

    return service;
  }

  async findByIdIncludingSoftDeleted(id: string): Promise<Service | null> {
    const service = this.items.find((item) => item.id.toString() === id);

    if (!service) {
      return null;
    }

    return service;
  }

  private applyServiceFilters(
    list: Service[],
    filters?: ServiceFilters,
  ): Service[] {
    return list.filter((item) => {
      if (item.isDeleted()) {
        return false;
      }

      const trimmedName = filters?.serviceName?.trim();
      if (
        trimmedName &&
        trimmedName.length > 0 &&
        !nameMatchesFilter(item.serviceName.toString(), trimmedName)
      ) {
        return false;
      }

      if (
        filters?.categoryId &&
        item.category?.id.toString() !== filters.categoryId
      ) {
        return false;
      }

      if (
        filters?.isActive !== undefined &&
        item.isActive !== filters.isActive
      ) {
        return false;
      }

      if (
        filters?.minPrice !== undefined &&
        item.price.amountInCents < filters.minPrice
      ) {
        return false;
      }

      if (
        filters?.maxPrice !== undefined &&
        item.price.amountInCents > filters.maxPrice
      ) {
        return false;
      }

      return true;
    });
  }

  async findManyByEstablishmentId(
    establishmentId: string,
    filters?: ServiceFilters,
  ): Promise<PaginatedServices> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 20;

    const filteredServices = this.applyServiceFilters(
      this.items.filter(
        (item) => item.establishmentId.toString() === establishmentId,
      ),
      filters,
    );

    const totalItems = filteredServices.length;
    const start = (page - 1) * size;
    const end = start + size;

    return {
      items: filteredServices.slice(start, end),
      totalItems,
    };
  }

  async findOptionsByEstablishmentId(
    establishmentId: string,
    filters?: ServiceOptionsFilters,
  ): Promise<ServiceOptionsResult> {
    const size = filters?.size ?? 20;
    const search = filters?.search?.trim().toLowerCase();

    const filtered = this.items
      .slice()
      .filter((item) => item.establishmentId.toString() === establishmentId)
      .filter((item) => !item.isDeleted())
      .filter((item) => item.isActive)
      .filter((item) => {
        if (!search) {
          return true;
        }

        return item.serviceName.value.toLowerCase().includes(search);
      })
      .sort((a, b) => compareStrings(a.serviceName.value, b.serviceName.value));

    return {
      services: filtered.slice(0, size).map((service) => ({
        id: service.id.toString(),
        label: service.serviceName.value,
        priceInCents: service.priceSpecification.defaultChargePriceInCents,
        priceSpecification: service.priceSpecification.toValue(),
      })),
      totalItems: filtered.length,
    };
  }

  async findByServiceIdAndEstablishmentId(
    serviceId: string,
    establishmentId: string,
  ): Promise<Service | null> {
    const service = this.items.find(
      (item) =>
        item.id.toString() === serviceId &&
        item.establishmentId.toString() === establishmentId,
    );

    if (!service) return null;

    return service;
  }

  async findActiveByNameAndEstablishmentId(
    serviceName: string,
    establishmentId: string,
  ): Promise<Service | null> {
    const normalizedServiceName = serviceName.trim().toLowerCase();

    return (
      this.items.find(
        (item) =>
          item.establishmentId.toString() === establishmentId &&
          !item.isDeleted() &&
          item.serviceName.value.toLowerCase() === normalizedServiceName,
      ) ?? null
    );
  }

  async findManyByIdsAndEstablishmentIdIncludingDeleted(
    ids: string[],
    establishmentId: string,
  ): Promise<Service[]> {
    const idSet = new Set(ids);

    return this.items.filter(
      (item) =>
        idSet.has(item.id.toString()) &&
        item.establishmentId.toString() === establishmentId,
    );
  }

  async save(service: Service): Promise<void> {
    const serviceIndex = this.items.findIndex((item) =>
      item.id.equals(service.id),
    );

    if (serviceIndex === -1) {
      this.items.push(service);
      return;
    }

    this.items[serviceIndex] = service;
  }

  async findMany(filters?: ServiceFilters): Promise<PaginatedServices> {
    if (filters === undefined) {
      const items = this.items.filter((item) => !item.isDeleted());

      return {
        items,
        totalItems: items.length,
      };
    }

    const page = filters.page ?? 1;
    const size = filters.size ?? 20;

    const filtered = this.applyServiceFilters(this.items, filters);
    const totalItems = filtered.length;
    const start = (page - 1) * size;
    const end = start + size;

    return {
      items: filtered.slice(start, end),
      totalItems,
    };
  }

  async clearCategoryFromServices(categoryId: string): Promise<number> {
    let count = 0;

    for (const item of this.items) {
      if (item.category?.id.toString() === categoryId) {
        item.clearCategory();
        count++;
      }
    }

    return count;
  }
}

function compareStrings(a: string, b: string) {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}
