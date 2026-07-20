import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { EstablishmentScopeService } from "../../services/establishment-scope";
import { ListCustomerVehicleOptionsUseCase } from "./list-customer-vehicle-options";

let inMemoryCustomersRepository: InMemoryCustomersRepository;
let inMemoryCustomerVehiclesRepository: InMemoryCustomerVehiclesRepository;
let inMemoryEmployeesRepository: InMemoryEmployeesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let establishmentScope: EstablishmentScopeService;
let sut: ListCustomerVehicleOptionsUseCase;

describe("List customer vehicle options", () => {
  beforeEach(() => {
    inMemoryCustomersRepository = new InMemoryCustomersRepository();
    inMemoryCustomerVehiclesRepository =
      new InMemoryCustomerVehiclesRepository();
    inMemoryEmployeesRepository = new InMemoryEmployeesRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );
    establishmentScope = new EstablishmentScopeService(
      inMemoryEstablishmentsRepository,
      inMemoryEmployeesRepository,
    );

    sut = new ListCustomerVehicleOptionsUseCase(
      inMemoryCustomerVehiclesRepository,
      inMemoryCustomersRepository,
      establishmentScope,
    );
  });

  it("should list active vehicle options matching plate, model, or brand", async () => {
    const establishment = makeEstablishment();
    const otherEstablishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const otherCustomer = makeCustomer({ establishmentId: establishment.id });
    const firstVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
      plate: "ABC1D23",
      brand: "Volkswagen",
      model: "Gol Trend",
    });
    const secondVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
      plate: "DEF4G56",
      brand: "Chevrolet",
      model: "Onix",
    });
    const thirdVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: otherCustomer.id,
      plate: "GHI7J89",
      brand: "Volkswagen",
      model: "Polo",
    });
    const deletedVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
      plate: "JKL1M23",
      brand: "Volkswagen",
      model: "Virtus",
    });
    const otherVehicle = makeCustomerVehicle({
      establishmentId: otherEstablishment.id,
      customerId: customer.id,
      plate: "MNO4P56",
      brand: "Volkswagen",
      model: "Nivus",
    });

    deletedVehicle.softDelete(new Date("2026-05-26T10:00:00.000Z"));

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEstablishmentsRepository.create(otherEstablishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryCustomersRepository.create(otherCustomer);
    await inMemoryCustomerVehiclesRepository.create(firstVehicle);
    await inMemoryCustomerVehiclesRepository.create(secondVehicle);
    await inMemoryCustomerVehiclesRepository.create(thirdVehicle);
    await inMemoryCustomerVehiclesRepository.create(deletedVehicle);
    await inMemoryCustomerVehiclesRepository.create(otherVehicle);

    const brandResult = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      search: "volks",
      customerId: customer.id.toString(),
      size: 1,
    });
    const plateResult = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      search: "abc-1d",
    });
    const modelResult = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      search: "oni",
    });

    expect(brandResult.isRight()).toBe(true);
    expect(plateResult.isRight()).toBe(true);
    expect(modelResult.isRight()).toBe(true);

    if (brandResult.isLeft()) throw brandResult.value;
    if (plateResult.isLeft()) throw plateResult.value;
    if (modelResult.isLeft()) throw modelResult.value;

    expect(brandResult.value.vehicles).toEqual([
      {
        id: firstVehicle.id.toString(),
        label: "Gol Trend",
      },
    ]);
    expect(brandResult.value.totalItems).toBe(1);
    expect(plateResult.value.vehicles).toEqual([
      {
        id: firstVehicle.id.toString(),
        label: "Gol Trend",
      },
    ]);
    expect(plateResult.value.totalItems).toBe(1);
    expect(modelResult.value.vehicles).toEqual([
      {
        id: secondVehicle.id.toString(),
        label: "Onix",
      },
    ]);
    expect(modelResult.value.totalItems).toBe(1);

    const pageResult = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      search: "volks",
      page: 2,
      size: 1,
    });

    expect(pageResult.isRight()).toBe(true);

    if (pageResult.isLeft()) {
      throw pageResult.value;
    }

    expect(pageResult.value.vehicles).toEqual([
      {
        id: thirdVehicle.id.toString(),
        label: "Polo",
      },
    ]);
    expect(pageResult.value.totalItems).toBe(2);
  });

  it("should allow employee scope", async () => {
    const establishment = makeEstablishment();
    const user = makeUser("EMPLOYEE");
    const employee = makeEmployee({
      establishmentId: establishment.id,
      userId: user.id,
    });
    const customer = makeCustomer({ establishmentId: establishment.id });
    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
      model: "Corolla",
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEmployeesRepository.create(employee);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryCustomerVehiclesRepository.create(vehicle);

    const result = await sut.execute({
      actor: { userId: user.id.toString(), role: "EMPLOYEE" },
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.vehicles).toEqual([
      {
        id: vehicle.id.toString(),
        label: "Corolla",
      },
    ]);
    expect(result.value.totalItems).toBe(1);
  });

  it("should reject missing establishment and invalid customer scope", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const deletedCustomer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    deletedCustomer.softDelete(new Date("2026-05-26T10:00:00.000Z"));

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryCustomersRepository.create(deletedCustomer);

    const missingEstablishmentResult = await sut.execute({
      actor: { userId: "missing-owner", role: "ESTABLISHMENT" },
    });
    const missingCustomerResult = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      customerId: "missing-customer",
    });
    const deletedCustomerResult = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      customerId: deletedCustomer.id.toString(),
    });

    expect(missingEstablishmentResult.isLeft()).toBe(true);
    expect(missingEstablishmentResult.value).toBeInstanceOf(
      ResourceNotFoundError,
    );
    expect(missingCustomerResult.isLeft()).toBe(true);
    expect(missingCustomerResult.value).toBeInstanceOf(ResourceNotFoundError);
    expect(deletedCustomerResult.isLeft()).toBe(true);
    expect(deletedCustomerResult.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
