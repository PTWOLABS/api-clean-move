import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { DeleteCustomerVehicleUseCase } from "./delete-customer-vehicle";

let inMemoryCustomersRepository: InMemoryCustomersRepository;
let inMemoryCustomerVehiclesRepository: InMemoryCustomerVehiclesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: DeleteCustomerVehicleUseCase;

describe("Delete customer vehicle", () => {
  beforeEach(() => {
    inMemoryCustomersRepository = new InMemoryCustomersRepository();
    inMemoryCustomerVehiclesRepository =
      new InMemoryCustomerVehiclesRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );

    sut = new DeleteCustomerVehicleUseCase(
      inMemoryCustomerVehiclesRepository,
      inMemoryCustomersRepository,
      inMemoryEstablishmentsRepository,
    );
  });

  it("should soft-delete a customer vehicle", async () => {
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
    expect(vehicle.deletedAt).toBeInstanceOf(Date);
    expect(vehicle.isDeleted()).toBe(true);
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
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
