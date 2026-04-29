import { CustomerVehicle } from "../../../modules/customer/domain/entities/customer-vehicle";

export class CustomerVehiclePresenter {
  static toHTTP(vehicle: CustomerVehicle) {
    return {
      id: vehicle.id.toString(),
      establishmentId: vehicle.establishmentId.toString(),
      customerId: vehicle.customerId.toString(),
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      color: vehicle.color,
      year: vehicle.year,
      notes: vehicle.notes,
      deletedAt: vehicle.deletedAt?.toISOString() ?? null,
      createdAt: vehicle.createdAt?.toISOString() ?? null,
      updatedAt: vehicle.updatedAt?.toISOString() ?? null,
    };
  }
}
