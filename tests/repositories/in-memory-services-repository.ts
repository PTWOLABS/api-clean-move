import {
  type PaginatedServices,
  type ServiceFilters,
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
      const trimmedName = filters?.serviceName?.trim();
      if (
        trimmedName &&
        trimmedName.length > 0 &&
        !nameMatchesFilter(item.serviceName.toString(), trimmedName)
      ) {
        return false;
      }

      if (filters?.category && item.category !== filters.category) {
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
      const items = [...this.items];

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
}
