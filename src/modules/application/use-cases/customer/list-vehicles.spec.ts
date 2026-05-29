import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { ListVehiclesUseCase } from "./list-vehicles";

let inMemoryCustomersRepository: InMemoryCustomersRepository;
let inMemoryCustomerVehiclesRepository: InMemoryCustomerVehiclesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: ListVehiclesUseCase;

describe("List vehicles", () => {
  beforeEach(() => {
    inMemoryCustomersRepository = new InMemoryCustomersRepository();
    inMemoryCustomerVehiclesRepository = new InMemoryCustomerVehiclesRepository(
      inMemoryCustomersRepository,
    );
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );

    sut = new ListVehiclesUseCase(
      inMemoryCustomerVehiclesRepository,
      inMemoryCustomersRepository,
      inMemoryEstablishmentsRepository,
    );
  });

  it("should list active vehicles from the establishment", async () => {
    const establishment = makeEstablishment();
    const firstCustomer = makeCustomer({
      establishmentId: establishment.id,
      fullName: "Maria Silva",
    });
    const secondCustomer = makeCustomer({
      establishmentId: establishment.id,
      fullName: "Joao Santos",
    });
    const firstVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: firstCustomer.id,
      plate: "ABC1D23",
    });
    const secondVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: secondCustomer.id,
      plate: "XYZ9A87",
    });
    const deletedVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: firstCustomer.id,
      plate: "DEF4G56",
    });

    deletedVehicle.softDelete(new Date("2026-04-27T10:00:00.000Z"));

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(firstCustomer);
    await inMemoryCustomersRepository.create(secondCustomer);
    await inMemoryCustomerVehiclesRepository.create(firstVehicle);
    await inMemoryCustomerVehiclesRepository.create(secondVehicle);
    await inMemoryCustomerVehiclesRepository.create(deletedVehicle);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.vehicles).toEqual(
      expect.arrayContaining([firstVehicle, secondVehicle]),
    );
    expect(result.value.vehicles).toHaveLength(2);
    expect(result.value.totalItems).toBe(2);
  });

  it("should filter vehicles by customer id", async () => {
    const establishment = makeEstablishment();
    const firstCustomer = makeCustomer({ establishmentId: establishment.id });
    const secondCustomer = makeCustomer({ establishmentId: establishment.id });
    const firstVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: firstCustomer.id,
      plate: "ABC1D23",
    });
    const secondVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: secondCustomer.id,
      plate: "XYZ9A87",
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(firstCustomer);
    await inMemoryCustomersRepository.create(secondCustomer);
    await inMemoryCustomerVehiclesRepository.create(firstVehicle);
    await inMemoryCustomerVehiclesRepository.create(secondVehicle);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      customerId: firstCustomer.id.toString(),
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.vehicles).toEqual([firstVehicle]);
    expect(result.value.totalItems).toBe(1);
  });

  it("should filter vehicles by customer name", async () => {
    const establishment = makeEstablishment();
    const maria = makeCustomer({
      establishmentId: establishment.id,
      fullName: "Maria Silva",
    });
    const joao = makeCustomer({
      establishmentId: establishment.id,
      fullName: "Joao Santos",
    });
    const mariaVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: maria.id,
      plate: "ABC1D23",
    });
    const joaoVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: joao.id,
      plate: "XYZ9A87",
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(maria);
    await inMemoryCustomersRepository.create(joao);
    await inMemoryCustomerVehiclesRepository.create(mariaVehicle);
    await inMemoryCustomerVehiclesRepository.create(joaoVehicle);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      customerName: "maria",
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.vehicles).toEqual([mariaVehicle]);
    expect(result.value.totalItems).toBe(1);
  });

  it("should return totalItems across all pages when paginating", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const firstVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
      plate: "ABC1D23",
    });
    const secondVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
      plate: "XYZ9A87",
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryCustomerVehiclesRepository.create(firstVehicle);
    await inMemoryCustomerVehiclesRepository.create(secondVehicle);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      page: 1,
      size: 1,
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.vehicles).toHaveLength(1);
    expect(result.value.totalItems).toBe(2);
  });

  it("should reject customers outside the establishment", async () => {
    const firstEstablishment = makeEstablishment();
    const secondEstablishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: firstEstablishment.id });

    await inMemoryEstablishmentsRepository.create(firstEstablishment);
    await inMemoryEstablishmentsRepository.create(secondEstablishment);
    await inMemoryCustomersRepository.create(customer);

    const result = await sut.execute({
      establishmentOwnerId: secondEstablishment.ownerId.toString(),
      customerId: customer.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject when establishment does not exist", async () => {
    const establishment = makeEstablishment();

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
