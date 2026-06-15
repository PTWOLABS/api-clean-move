import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { ListCustomersUseCase } from "./list-customers";

let inMemoryCustomersRepository: InMemoryCustomersRepository;
let inMemoryCustomerVehiclesRepository: InMemoryCustomerVehiclesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: ListCustomersUseCase;

describe("List customers", () => {
  beforeEach(() => {
    inMemoryCustomersRepository = new InMemoryCustomersRepository();
    inMemoryCustomerVehiclesRepository =
      new InMemoryCustomerVehiclesRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );

    sut = new ListCustomersUseCase(
      inMemoryCustomersRepository,
      inMemoryCustomerVehiclesRepository,
      inMemoryEstablishmentsRepository,
    );
  });

  it("should list active customers from the establishment", async () => {
    const establishment = makeEstablishment();
    const otherEstablishment = makeEstablishment();
    const firstCustomer = makeCustomer({
      establishmentId: establishment.id,
      fullName: "Maria Silva",
    });
    const secondCustomer = makeCustomer({
      establishmentId: establishment.id,
      fullName: "Jose Silva",
      cpfCnpj: null,
    });
    const deletedCustomer = makeCustomer({
      establishmentId: establishment.id,
      fullName: "Deleted Customer",
      cpfCnpj: null,
    });
    const otherCustomer = makeCustomer({
      establishmentId: otherEstablishment.id,
      fullName: "Other Customer",
      cpfCnpj: null,
    });

    deletedCustomer.softDelete(new Date("2026-04-27T10:00:00.000Z"));

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEstablishmentsRepository.create(otherEstablishment);
    await inMemoryCustomersRepository.create(firstCustomer);
    await inMemoryCustomersRepository.create(secondCustomer);
    await inMemoryCustomersRepository.create(deletedCustomer);
    await inMemoryCustomersRepository.create(otherCustomer);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      search: "silva",
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.customers.map((item) => item.customer)).toEqual([
      firstCustomer,
      secondCustomer,
    ]);
    expect(result.value.totalItems).toBe(2);
  });

  it("should return totalItems across all pages when paginating", async () => {
    const establishment = makeEstablishment();
    const firstCustomer = makeCustomer({
      establishmentId: establishment.id,
      fullName: "Maria Silva",
    });
    const secondCustomer = makeCustomer({
      establishmentId: establishment.id,
      fullName: "Jose Silva",
      cpfCnpj: null,
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(firstCustomer);
    await inMemoryCustomersRepository.create(secondCustomer);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      page: 1,
      size: 1,
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.customers).toHaveLength(1);
    expect(result.value.totalItems).toBe(2);
  });

  it("should include active vehicles for each listed customer", async () => {
    const establishment = makeEstablishment();
    const otherEstablishment = makeEstablishment();
    const customerWithVehicles = makeCustomer({
      establishmentId: establishment.id,
      fullName: "Maria Silva",
    });
    const customerWithoutVehicles = makeCustomer({
      establishmentId: establishment.id,
      fullName: "Jose Silva",
      cpfCnpj: null,
    });
    const otherCustomer = makeCustomer({
      establishmentId: otherEstablishment.id,
      fullName: "Other Customer",
      cpfCnpj: null,
    });
    const activeVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customerWithVehicles.id,
      plate: "ABC1D23",
    });
    const deletedVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customerWithVehicles.id,
      plate: "XYZ9Z99",
    });
    const otherEstablishmentVehicle = makeCustomerVehicle({
      establishmentId: otherEstablishment.id,
      customerId: otherCustomer.id,
      plate: "QWE1R23",
    });

    deletedVehicle.softDelete(new Date("2026-04-27T10:00:00.000Z"));

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEstablishmentsRepository.create(otherEstablishment);
    await inMemoryCustomersRepository.create(customerWithVehicles);
    await inMemoryCustomersRepository.create(customerWithoutVehicles);
    await inMemoryCustomersRepository.create(otherCustomer);
    await inMemoryCustomerVehiclesRepository.create(activeVehicle);
    await inMemoryCustomerVehiclesRepository.create(deletedVehicle);
    await inMemoryCustomerVehiclesRepository.create(otherEstablishmentVehicle);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    const maria = result.value.customers.find((item) =>
      item.customer.id.equals(customerWithVehicles.id),
    );
    const jose = result.value.customers.find((item) =>
      item.customer.id.equals(customerWithoutVehicles.id),
    );

    expect(maria?.vehicles).toEqual([activeVehicle]);
    expect(jose?.vehicles).toEqual([]);
  });

  it("should reject a missing establishment", async () => {
    const result = await sut.execute({
      establishmentOwnerId: "missing-owner",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
