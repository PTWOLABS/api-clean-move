import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { GetCustomerVehicleUseCase } from "./get-customer-vehicle";

let inMemoryCustomersRepository: InMemoryCustomersRepository;
let inMemoryCustomerVehiclesRepository: InMemoryCustomerVehiclesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: GetCustomerVehicleUseCase;

describe("Get customer vehicle", () => {
  beforeEach(() => {
    inMemoryCustomersRepository = new InMemoryCustomersRepository();
    inMemoryCustomerVehiclesRepository =
      new InMemoryCustomerVehiclesRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );

    sut = new GetCustomerVehicleUseCase(
      inMemoryCustomerVehiclesRepository,
      inMemoryCustomersRepository,
      inMemoryEstablishmentsRepository,
    );
  });

  it("should get an active vehicle from an active customer", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryCustomerVehiclesRepository.create(vehicle);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      customerId: customer.id.toString(),
      vehicleId: vehicle.id.toString(),
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.vehicle).toEqual(vehicle);
  });

  it("should reject vehicles from another customer", async () => {
    const establishment = makeEstablishment();
    const firstCustomer = makeCustomer({ establishmentId: establishment.id });
    const secondCustomer = makeCustomer({ establishmentId: establishment.id });
    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: firstCustomer.id,
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(firstCustomer);
    await inMemoryCustomersRepository.create(secondCustomer);
    await inMemoryCustomerVehiclesRepository.create(vehicle);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      customerId: secondCustomer.id.toString(),
      vehicleId: vehicle.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject deleted customers and deleted vehicles", async () => {
    const establishment = makeEstablishment();
    const deletedCustomer = makeCustomer({
      establishmentId: establishment.id,
    });
    const customer = makeCustomer({ establishmentId: establishment.id });
    const deletedVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
    });

    deletedCustomer.softDelete(new Date("2026-07-01T10:00:00.000Z"));
    deletedVehicle.softDelete(new Date("2026-07-01T10:00:00.000Z"));

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(deletedCustomer);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryCustomerVehiclesRepository.create(deletedVehicle);

    const deletedCustomerResult = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      customerId: deletedCustomer.id.toString(),
      vehicleId: deletedVehicle.id.toString(),
    });
    const deletedVehicleResult = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      customerId: customer.id.toString(),
      vehicleId: deletedVehicle.id.toString(),
    });

    expect(deletedCustomerResult.isLeft()).toBe(true);
    expect(deletedCustomerResult.value).toBeInstanceOf(ResourceNotFoundError);
    expect(deletedVehicleResult.isLeft()).toBe(true);
    expect(deletedVehicleResult.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
