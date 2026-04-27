import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { UpdateCustomerVehicleUseCase } from "./update-customer-vehicle";

let inMemoryCustomersRepository: InMemoryCustomersRepository;
let inMemoryCustomerVehiclesRepository: InMemoryCustomerVehiclesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: UpdateCustomerVehicleUseCase;

describe("Update customer vehicle", () => {
  beforeEach(() => {
    inMemoryCustomersRepository = new InMemoryCustomersRepository();
    inMemoryCustomerVehiclesRepository =
      new InMemoryCustomerVehiclesRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );

    sut = new UpdateCustomerVehicleUseCase(
      inMemoryCustomerVehiclesRepository,
      inMemoryCustomersRepository,
      inMemoryEstablishmentsRepository,
    );
  });

  it("should update a customer vehicle", async () => {
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
      plate: "xyz-9a87",
      brand: "Honda",
      model: "Civic",
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.vehicle.plate).toBe("XYZ9A87");
    expect(result.value.vehicle.brand).toBe("Honda");
    expect(result.value.vehicle.model).toBe("Civic");
  });

  it("should reject a vehicle from another customer", async () => {
    const establishment = makeEstablishment();
    const firstCustomer = makeCustomer({ establishmentId: establishment.id });
    const secondCustomer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
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
      brand: "Honda",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject a duplicated active plate in the same establishment", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const existingVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
      plate: "ABC1D23",
    });
    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
      plate: "XYZ9A87",
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryCustomerVehiclesRepository.create(existingVehicle);
    await inMemoryCustomerVehiclesRepository.create(vehicle);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      customerId: customer.id.toString(),
      vehicleId: vehicle.id.toString(),
      plate: "abc-1d23",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceAlreadyExistsError);
  });
});
