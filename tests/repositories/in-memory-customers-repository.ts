import {
  CustomerFilters,
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
    const limit = filters?.limit ?? 20;
    const search = filters?.search?.trim().toLowerCase();

    return this.items
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
      .sort((a, b) => compareStrings(a.fullName, b.fullName))
      .slice(0, limit)
      .map((customer) => ({
        id: customer.id.toString(),
        label: customer.fullName,
      }));
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
