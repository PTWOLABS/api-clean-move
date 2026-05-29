import {
  CustomerVehicleFilters,
  CustomerVehicleOptionsFilters,
  CustomerVehiclesRepository,
  EstablishmentCustomerVehicleFilters,
  PaginatedCustomerVehicles,
} from "../../src/modules/application/repositories/customer-vehicles-repository";
import { Customer } from "../../src/modules/customer/domain/entities/customer";
import { CustomerVehicle } from "../../src/modules/customer/domain/entities/customer-vehicle";

export class InMemoryCustomerVehiclesRepository implements CustomerVehiclesRepository {
  public items: CustomerVehicle[] = [];

  constructor(
    private readonly customersRepository?: {
      items: Customer[];
    },
  ) {}

  async create(vehicle: CustomerVehicle): Promise<void> {
    this.items.push(vehicle);
  }

  async findById(id: string): Promise<CustomerVehicle | null> {
    const vehicle = this.items.find((item) => item.id.toString() === id);

    if (!vehicle) return null;

    return vehicle;
  }

  async findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<CustomerVehicle | null> {
    const vehicle = this.items.find(
      (item) =>
        item.id.toString() === id &&
        item.establishmentId.toString() === establishmentId,
    );

    if (!vehicle) return null;

    return vehicle;
  }

  async findByIdAndCustomerIdAndEstablishmentId(
    id: string,
    customerId: string,
    establishmentId: string,
  ): Promise<CustomerVehicle | null> {
    const vehicle = this.items.find(
      (item) =>
        item.id.toString() === id &&
        item.customerId.toString() === customerId &&
        item.establishmentId.toString() === establishmentId,
    );

    if (!vehicle) return null;

    return vehicle;
  }

  async findActiveByPlateAndEstablishmentId(
    plate: string,
    establishmentId: string,
  ): Promise<CustomerVehicle | null> {
    const normalizedPlate = plate.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    const vehicle = this.items.find(
      (item) =>
        item.plate === normalizedPlate &&
        item.establishmentId.toString() === establishmentId &&
        !item.isDeleted(),
    );

    if (!vehicle) return null;

    return vehicle;
  }

  async findManyByCustomerIdAndEstablishmentId(
    customerId: string,
    establishmentId: string,
    filters?: CustomerVehicleFilters,
  ): Promise<PaginatedCustomerVehicles> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 20;

    const filteredVehicles = this.items
      .slice()
      .sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime())
      .filter(
        (item) =>
          item.customerId.toString() === customerId &&
          item.establishmentId.toString() === establishmentId,
      )
      .filter((item) => filters?.includeDeleted || !item.isDeleted());

    const totalItems = filteredVehicles.length;
    const start = (page - 1) * size;
    const end = start + size;

    return {
      vehicles: filteredVehicles.slice(start, end),
      totalItems,
    };
  }

  async findManyByEstablishmentId(
    establishmentId: string,
    filters?: EstablishmentCustomerVehicleFilters,
  ): Promise<PaginatedCustomerVehicles> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 20;
    const customerName = filters?.customerName?.trim().toLowerCase();

    const filteredVehicles = this.items
      .slice()
      .sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime())
      .filter((item) => item.establishmentId.toString() === establishmentId)
      .filter((item) => !item.isDeleted())
      .filter((item) =>
        filters?.customerId
          ? item.customerId.toString() === filters.customerId
          : true,
      )
      .filter((item) => {
        if (!customerName) {
          return true;
        }

        const fullName = this.customersRepository?.items.find(
          (customer) => customer.id.toString() === item.customerId.toString(),
        )?.fullName;

        return fullName?.toLowerCase().includes(customerName) ?? false;
      });

    const totalItems = filteredVehicles.length;
    const start = (page - 1) * size;
    const end = start + size;

    return {
      vehicles: filteredVehicles.slice(start, end),
      totalItems,
    };
  }

  async findAllActiveByCustomerIdAndEstablishmentId(
    customerId: string,
    establishmentId: string,
  ) {
    return this.items
      .slice()
      .sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime())
      .filter(
        (item) =>
          item.customerId.toString() === customerId &&
          item.establishmentId.toString() === establishmentId &&
          !item.isDeleted(),
      );
  }

  async findAllActiveByCustomerIdsAndEstablishmentId(
    customerIds: string[],
    establishmentId: string,
  ) {
    if (customerIds.length === 0) {
      return [];
    }

    const customerIdSet = new Set(customerIds);

    return this.items
      .slice()
      .sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime())
      .filter(
        (item) =>
          customerIdSet.has(item.customerId.toString()) &&
          item.establishmentId.toString() === establishmentId &&
          !item.isDeleted(),
      );
  }

  async findOptionsByEstablishmentId(
    establishmentId: string,
    filters?: CustomerVehicleOptionsFilters,
  ) {
    const limit = filters?.limit ?? 20;
    const search = filters?.search?.trim().toLowerCase();
    const plateSearch = filters?.search
      ?.replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();

    return this.items
      .slice()
      .filter((item) => item.establishmentId.toString() === establishmentId)
      .filter((item) => !item.isDeleted())
      .filter((item) =>
        filters?.customerId
          ? item.customerId.toString() === filters.customerId
          : true,
      )
      .filter((item) => {
        if (!search) {
          return true;
        }

        return (
          (plateSearch
            ? (item.plate?.includes(plateSearch) ?? false)
            : false) ||
          (item.model?.toLowerCase().includes(search) ?? false) ||
          (item.brand?.toLowerCase().includes(search) ?? false)
        );
      })
      .sort((a, b) => {
        const byModel = compareStrings(a.model ?? "", b.model ?? "");

        if (byModel !== 0) {
          return byModel;
        }

        return compareStrings(a.plate ?? "", b.plate ?? "");
      })
      .slice(0, limit)
      .map((vehicle) => ({
        id: vehicle.id.toString(),
        label: vehicle.model ?? "",
      }));
  }

  async save(vehicle: CustomerVehicle): Promise<void> {
    const vehicleIndex = this.items.findIndex((item) =>
      item.id.equals(vehicle.id),
    );

    if (vehicleIndex === -1) {
      this.items.push(vehicle);
      return;
    }

    this.items[vehicleIndex] = vehicle;
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
