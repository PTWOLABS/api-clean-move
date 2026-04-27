import {
  CustomerFilters,
  CustomersRepository,
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
  ): Promise<Customer[]> {
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
        const phone = item.phone.toString();
        const email = item.email.toString().toLowerCase();
        const cpfCnpj = item.cpfCnpj?.toString() ?? "";

        return (
          fullName.includes(search) ||
          phone.includes(search) ||
          email.includes(search) ||
          Boolean(documentSearch && cpfCnpj.includes(documentSearch))
        );
      });

    const start = (page - 1) * size;
    const end = start + size;

    return filteredCustomers.slice(start, end);
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
