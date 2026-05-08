import { EstablishmentsRepository } from "../../src/modules/application/repositories/establishment-repository";
import { ServiceCategory } from "../../src/modules/catalog/domain/value-objects/service-category";
import { Establishment } from "../../src/modules/establishments/domain/entities/establishment";
import { InMemoryServicesRepository } from "./in-memory-services-repository";

export class InMemoryEstablishmentsRepository implements EstablishmentsRepository {
  constructor(private servicesRepository: InMemoryServicesRepository) {}

  public items: Establishment[] = [];

  async create(data: Establishment): Promise<void> {
    this.items.push(data);
  }

  async save(establishment: Establishment): Promise<void> {
    const index = this.items.findIndex((item) =>
      item.id.equals(establishment.id),
    );

    if (index === -1) {
      throw new Error("Establishment not found.");
    }

    this.items[index] = establishment;
  }

  async findByCnpj(cnpj: string): Promise<Establishment | null> {
    const establishment = this.items.find(
      (item) => item.cnpj.toString() === cnpj,
    );

    if (!establishment) {
      return null;
    }

    return establishment;
  }

  async findById(id: string): Promise<Establishment | null> {
    const establishment = this.items.find((item) => item.id.toString() === id);

    if (!establishment) {
      return null;
    }

    return establishment;
  }

  async findByOwnerId(ownerId: string): Promise<Establishment | null> {
    const establishment = this.items.find(
      (item) => item.ownerId.toString() === ownerId,
    );

    if (!establishment) {
      return null;
    }

    return establishment;
  }

  async findBySlug(slug: string): Promise<Establishment | null> {
    const establishment = this.items.find((item) => item.slug.value === slug);

    if (!establishment) {
      return null;
    }

    return establishment;
  }

  async findBySlugOrCnpj(slug: string, cnpj: string) {
    const establishment = this.items.find(
      (item) => item.slug.value === slug || item.cnpj.value === cnpj,
    );

    if (!establishment) return null;

    return establishment;
  }

  async findMany(filters?: {
    establishmentName?: string;
    serviceCategory?: ServiceCategory;
  }): Promise<Establishment[]> {
    if (!filters) {
      return this.items;
    }

    let establishments = this.items;

    if (filters.serviceCategory) {
      const establishmentIdsWithCategory = new Set(
        (await this.servicesRepository.findMany())
          .filter((service) => service.category === filters.serviceCategory)
          .map((service) => service.establishmentId.toString()),
      );

      establishments = establishments.filter((item) =>
        establishmentIdsWithCategory.has(item.id.toString()),
      );
    }

    if (filters.establishmentName) {
      establishments = establishments.filter(
        (item) => item.tradeName === filters.establishmentName,
      );
    }

    return establishments;
  }
}
