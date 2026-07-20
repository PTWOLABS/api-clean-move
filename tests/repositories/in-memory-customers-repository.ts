import {
  CustomerFilters,
  CustomerMatchEvidence,
  CustomerOptionsFilters,
  CustomersRepository,
  PaginatedCustomers,
} from "../../src/modules/application/repositories/customers-repository";
import { Customer } from "../../src/modules/customer/domain/entities/customer";
import { CustomerDocument } from "../../src/modules/customer/domain/value-objects/customer-document";

export class InMemoryCustomersRepository implements CustomersRepository {
  public items: Customer[] = [];

  async create(customer: Customer): Promise<void> {
    this.items.push(customer);
  }

  async findById(id: string): Promise<Customer | null> {
    const customer = this.items.find((item) => item.id.toString() === id);

    if (!customer) return null;

    return customer;
  }

  async findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<Customer | null> {
    const customer = this.items.find(
      (item) =>
        item.id.toString() === id &&
        item.establishmentId.toString() === establishmentId,
    );

    if (!customer) return null;

    return customer;
  }

  async findByIdAndEstablishmentIdIncludingDeleted(
    id: string,
    establishmentId: string,
  ): Promise<Customer | null> {
    return this.findByIdAndEstablishmentId(id, establishmentId);
  }

  async findManyByIdsAndEstablishmentIdIncludingDeleted(
    ids: string[],
    establishmentId: string,
  ): Promise<Customer[]> {
    const idSet = new Set(ids);

    return this.items.filter(
      (item) =>
        idSet.has(item.id.toString()) &&
        item.establishmentId.toString() === establishmentId,
    );
  }

  async findActiveByCpfCnpjAndEstablishmentId(
    cpfCnpj: string,
    establishmentId: string,
  ): Promise<Customer | null> {
    const normalizedDocument = CustomerDocument.create(cpfCnpj).toString();

    const customer = this.items.find(
      (item) =>
        item.cpfCnpj?.toString() === normalizedDocument &&
        item.establishmentId.toString() === establishmentId &&
        !item.isDeleted(),
    );

    if (!customer) return null;

    return customer;
  }

  async findManyActiveByEvidenceAndEstablishmentId(
    evidence: CustomerMatchEvidence,
    establishmentId: string,
  ): Promise<Customer[]> {
    const phone = normalizePhone(evidence.phone);
    const email = normalizeText(evidence.email)?.toLowerCase();
    const fullName = normalizeText(evidence.fullName)?.toLowerCase();

    if (!phone && !email && !fullName) {
      return [];
    }

    return this.items.filter((item) => {
      if (
        item.establishmentId.toString() !== establishmentId ||
        item.isDeleted()
      ) {
        return false;
      }

      return (
        Boolean(phone && item.phone?.toString() === phone) ||
        Boolean(email && item.email?.toString().toLowerCase() === email) ||
        Boolean(fullName && item.fullName.toLowerCase() === fullName)
      );
    });
  }

  async findManyByEstablishmentId(
    establishmentId: string,
    filters?: CustomerFilters,
  ): Promise<PaginatedCustomers> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 20;
    const search = filters?.search?.trim().toLowerCase();
    const documentSearch = search?.replace(/\D/g, "");

    const filteredCustomers = this.items
      .slice()
      .sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime())
      .filter((item) => item.establishmentId.toString() === establishmentId)
      .filter((item) => filters?.includeDeleted || !item.isDeleted())
      .filter((item) => {
        if (!search) {
          return true;
        }

        const fullName = item.fullName.toLowerCase();
        const phone = item.phone?.toString() ?? "";
        const email = item.email?.toString().toLowerCase() ?? "";
        const cpfCnpj = item.cpfCnpj?.toString() ?? "";

        return (
          fullName.includes(search) ||
          phone.includes(search) ||
          email.includes(search) ||
          Boolean(documentSearch && cpfCnpj.includes(documentSearch))
        );
      });

    const totalItems = filteredCustomers.length;
    const start = (page - 1) * size;
    const end = start + size;

    return {
      customers: filteredCustomers.slice(start, end),
      totalItems,
    };
  }

  async findOptionsByEstablishmentId(
    establishmentId: string,
    filters?: CustomerOptionsFilters,
  ) {
    const size = filters?.size ?? 20;
    const search = filters?.search?.trim().toLowerCase();

    const filtered = this.items
      .slice()
      .filter((item) => item.establishmentId.toString() === establishmentId)
      .filter((item) => !item.isDeleted())
      .filter((item) => {
        if (!search) {
          return true;
        }

        return (
          item.fullName.toLowerCase().includes(search) ||
          (item.nickname?.toLowerCase().includes(search) ?? false)
        );
      })
      .sort((a, b) => compareStrings(a.fullName, b.fullName));

    return {
      customers: filtered.slice(0, size).map((customer) => ({
        id: customer.id.toString(),
        label: customer.fullName,
      })),
      totalItems: filtered.length,
    };
  }

  async save(customer: Customer): Promise<void> {
    const customerIndex = this.items.findIndex((item) =>
      item.id.equals(customer.id),
    );

    if (customerIndex === -1) {
      this.items.push(customer);
      return;
    }

    this.items[customerIndex] = customer;
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

function normalizePhone(value: string | undefined) {
  const normalized = value?.replace(/\D/g, "");
  return normalized || undefined;
}

function normalizeText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}
