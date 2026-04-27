import {
  CustomerVehicleFilters,
  CustomerVehiclesRepository,
} from "../../src/modules/application/repositories/customer-vehicles-repository";
import { CustomerVehicle } from "../../src/modules/customer/domain/entities/customer-vehicle";

export class InMemoryCustomerVehiclesRepository
  implements CustomerVehiclesRepository
{
  public items: CustomerVehicle[] = [];

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
  ): Promise<CustomerVehicle[]> {
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

    const start = (page - 1) * size;
    const end = start + size;

    return filteredVehicles.slice(start, end);
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
