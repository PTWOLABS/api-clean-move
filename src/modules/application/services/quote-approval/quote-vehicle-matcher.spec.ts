import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { makeQuote } from "../../../../../tests/factories/quote-factory";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { QuoteVehicleMatcher } from "./quote-vehicle-matcher";

let customerVehiclesRepository: InMemoryCustomerVehiclesRepository;
let sut: QuoteVehicleMatcher;

describe("Quote vehicle matcher", () => {
  beforeEach(() => {
    customerVehiclesRepository = new InMemoryCustomerVehiclesRepository();
    sut = new QuoteVehicleMatcher(customerVehiclesRepository);
  });

  it("should resolve quotes without a vehicle snapshot", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const quote = makeQuote({
      establishmentId,
      vehicle: null,
    });

    const analysis = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
      resolvedCustomerId: null,
    });

    expect(analysis).toEqual({
      status: "NONE",
      requiresResolution: false,
      candidateVehicleId: null,
      candidateCustomerId: null,
      allowedActions: [],
    });
  });

  it("should classify vehicle snapshots without a candidate as snapshot-only", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const quote = makeQuote({
      establishmentId,
      vehicle: {
        plate: null,
        brand: "Honda",
        model: "HR-V",
        color: "Branco",
        year: 2025,
      },
    });

    const analysis = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
      resolvedCustomerId: null,
    });

    expect(analysis).toEqual({
      status: "SNAPSHOT_ONLY",
      requiresResolution: true,
      candidateVehicleId: null,
      candidateCustomerId: null,
      allowedActions: ["CREATE_FROM_SNAPSHOT", "KEEP_SNAPSHOT_ONLY"],
    });
  });

  it("should classify exact plate matches as candidates", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({ establishmentId });
    const vehicle = makeCustomerVehicle({
      establishmentId,
      customerId: customer.id,
      plate: "ABC1D23",
    });
    const quote = makeQuote({
      establishmentId,
      vehicle: {
        plate: "abc-1d23",
        brand: "Honda",
        model: "HR-V",
        color: "Branco",
        year: 2025,
      },
    });

    await customerVehiclesRepository.create(vehicle);

    const analysis = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
      resolvedCustomerId: null,
    });

    expect(analysis).toMatchObject({
      status: "CANDIDATE_FOUND",
      requiresResolution: true,
      candidateVehicleId: vehicle.id.toString(),
      candidateCustomerId: customer.id.toString(),
      allowedActions: ["EDIT_SNAPSHOT_PLATE", "KEEP_SNAPSHOT_ONLY"],
    });
  });

  it("should allow linking a plate candidate owned by the resolved customer", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({ establishmentId });
    const vehicle = makeCustomerVehicle({
      establishmentId,
      customerId: customer.id,
      plate: "ABC1D23",
    });
    const quote = makeQuote({
      establishmentId,
      vehicle: {
        plate: "ABC1D23",
        brand: "Honda",
        model: "HR-V",
        color: "Branco",
        year: 2025,
      },
    });

    await customerVehiclesRepository.create(vehicle);

    const analysis = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
      resolvedCustomerId: customer.id.toString(),
    });

    expect(analysis).toMatchObject({
      status: "CANDIDATE_FOUND",
      requiresResolution: true,
      candidateVehicleId: vehicle.id.toString(),
      candidateCustomerId: customer.id.toString(),
      allowedActions: ["LINK_EXISTING", "KEEP_SNAPSHOT_ONLY"],
    });
  });

  it("should detect plate ownership conflicts", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const resolvedCustomer = makeCustomer({ establishmentId });
    const otherCustomer = makeCustomer({ establishmentId });
    const vehicle = makeCustomerVehicle({
      establishmentId,
      customerId: otherCustomer.id,
      plate: "ABC1D23",
    });
    const quote = makeQuote({
      establishmentId,
      vehicle: {
        plate: "ABC1D23",
        brand: "Honda",
        model: "HR-V",
        color: "Branco",
        year: 2025,
      },
    });

    await customerVehiclesRepository.create(vehicle);

    const wrongOwner = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
      resolvedCustomerId: resolvedCustomer.id.toString(),
    });

    expect(wrongOwner).toMatchObject({
      status: "OWNERSHIP_CONFLICT",
      requiresResolution: true,
      allowedActions: ["EDIT_SNAPSHOT_PLATE", "KEEP_SNAPSHOT_ONLY"],
    });
  });

  it("should resolve linked active vehicles even when the current vehicle changed", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({ establishmentId });
    const vehicle = makeCustomerVehicle({
      establishmentId,
      customerId: customer.id,
      plate: "ABC1D23",
      brand: "Toyota",
      model: "Corolla",
    });
    const quote = makeQuote({
      establishmentId,
      vehicleId: vehicle.id,
      vehicle: {
        plate: "ABC1D23",
        brand: "Honda",
        model: "HR-V",
        color: "Branco",
        year: 2025,
      },
    });

    await customerVehiclesRepository.create(vehicle);

    const changedLinkedVehicle = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
      resolvedCustomerId: customer.id.toString(),
    });

    expect(changedLinkedVehicle).toMatchObject({
      status: "RESOLVED",
      requiresResolution: false,
    });
  });

  it("should require resolution when the linked vehicle is deleted", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({ establishmentId });
    const vehicle = makeCustomerVehicle({
      establishmentId,
      customerId: customer.id,
      plate: "ABC1D23",
    });
    vehicle.softDelete(new Date("2026-07-13T10:00:00.000Z"));
    const quote = makeQuote({
      establishmentId,
      vehicleId: vehicle.id,
    });

    await customerVehiclesRepository.create(vehicle);

    const analysis = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
      resolvedCustomerId: customer.id.toString(),
    });

    expect(analysis).toMatchObject({
      status: "LINKED_RESOURCE_DELETED",
      requiresResolution: true,
      candidateVehicleId: null,
      candidateCustomerId: null,
      allowedActions: ["CREATE_FROM_SNAPSHOT", "KEEP_SNAPSHOT_ONLY"],
    });
  });
});
