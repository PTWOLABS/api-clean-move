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

    if (hasInvalidVehicleListFilters(filters)) {
      return { vehicles: [], totalItems: 0 };
    }

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
      .filter((item) =>
        matchesVehicleListFilters(
          item,
          filters,
          this.customersRepository?.items,
        ),
      );

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

function hasInvalidVehicleListFilters(
  filters?: EstablishmentCustomerVehicleFilters,
): boolean {
  const plate = filters?.plate?.trim();
  const year = filters?.year?.trim();

  if (year !== undefined) {
    const parsedYear = Number.parseInt(year, 10);

    if (!Number.isInteger(parsedYear)) {
      return true;
    }
  }

  if (plate !== undefined) {
    const plateSearch = plate.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    if (!plateSearch) {
      return true;
    }
  }

  return false;
}

function matchesVehicleListFilters(
  vehicle: CustomerVehicle,
  filters?: EstablishmentCustomerVehicleFilters,
  customers?: Customer[],
): boolean {
  const plate = filters?.plate?.trim();
  const name = filters?.name?.trim();
  const model = filters?.model?.trim();
  const brand = filters?.brand?.trim();
  const color = filters?.color?.trim();
  const year = filters?.year?.trim();

  if (year !== undefined) {
    const parsedYear = Number.parseInt(year, 10);

    if (vehicle.year !== parsedYear) {
      return false;
    }
  }

  if (plate !== undefined) {
    const plateSearch = plate.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    if (!(vehicle.plate?.includes(plateSearch) ?? false)) {
      return false;
    }
  }

  if (name !== undefined) {
    const fullName = customers?.find(
      (customer) => customer.id.toString() === vehicle.customerId.toString(),
    )?.fullName;
    const normalizedName = name.toLowerCase();

    if (!(fullName?.toLowerCase().includes(normalizedName) ?? false)) {
      return false;
    }
  }

  if (model !== undefined) {
    const normalizedModel = model.toLowerCase();

    if (!(vehicle.model?.toLowerCase().includes(normalizedModel) ?? false)) {
      return false;
    }
  }

  if (brand !== undefined) {
    const normalizedBrand = brand.toLowerCase();

    if (!(vehicle.brand?.toLowerCase().includes(normalizedBrand) ?? false)) {
      return false;
    }
  }

  if (color !== undefined) {
    const normalizedColor = color.toLowerCase();

    if (!(vehicle.color?.toLowerCase().includes(normalizedColor) ?? false)) {
      return false;
    }
  }

  return true;
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
