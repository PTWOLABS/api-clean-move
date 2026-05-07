import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { InvalidCustomerInputError } from "../errors/invalid-customer-input-error";
import { CustomerVehicle } from "./customer-vehicle";

describe("CustomerVehicle", () => {
  it("should create a vehicle for a customer and establishment", () => {
    const vehicle = CustomerVehicle.create({
      establishmentId: new UniqueEntityId("establishment-1"),
      customerId: new UniqueEntityId("customer-1"),
      plate: "ABC1D23",
      brand: "Toyota",
      model: "Corolla",
      color: "Prata",
      year: 2022,
      notes: "Veiculo principal",
    });

    expect(vehicle.establishmentId.toString()).toBe("establishment-1");
    expect(vehicle.customerId.toString()).toBe("customer-1");
    expect(vehicle.plate).toBe("ABC1D23");
    expect(vehicle.deletedAt).toBeNull();
  });

  it("should soft-delete a vehicle", () => {
    const vehicle = CustomerVehicle.create({
      establishmentId: new UniqueEntityId("establishment-1"),
      customerId: new UniqueEntityId("customer-1"),
      plate: null,
      brand: null,
      model: null,
      color: null,
      year: null,
      notes: null,
    });

    const deletedAt = new Date("2026-04-27T10:00:00.000Z");
    vehicle.softDelete(deletedAt);

    expect(vehicle.deletedAt).toEqual(deletedAt);
    expect(vehicle.isDeleted()).toBe(true);
  });

  it("should reject plates with a length different than seven chars", () => {
    expect(() =>
      CustomerVehicle.create({
        establishmentId: new UniqueEntityId("establishment-1"),
        customerId: new UniqueEntityId("customer-1"),
        plate: "ABC123",
        brand: null,
        model: null,
        color: null,
        year: null,
        notes: null,
      }),
    ).toThrow(InvalidCustomerInputError);

    expect(() =>
      CustomerVehicle.create({
        establishmentId: new UniqueEntityId("establishment-1"),
        customerId: new UniqueEntityId("customer-1"),
        plate: "ABC12345",
        brand: null,
        model: null,
        color: null,
        year: null,
        notes: null,
      }),
    ).toThrow(InvalidCustomerInputError);
  });

  it("should update image URL", () => {
    const vehicle = CustomerVehicle.create({
      establishmentId: new UniqueEntityId("establishment-1"),
      customerId: new UniqueEntityId("customer-1"),
      plate: null,
      brand: null,
      model: null,
      color: null,
      year: null,
      notes: null,
    });

    vehicle.update({ imageUrl: "  https://cdn.example.com/v.png  " });

    expect(vehicle.imageUrl).toBe("https://cdn.example.com/v.png");
  });
});
