import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { InMemoryUnitOfWork } from "../../../../../tests/repositories/in-memory-unit-of-work";
import { DeleteCustomerUseCase } from "./delete-customer";

let inMemoryCustomersRepository: InMemoryCustomersRepository;
let inMemoryCustomerVehiclesRepository: InMemoryCustomerVehiclesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let inMemoryUnitOfWork: InMemoryUnitOfWork;
let sut: DeleteCustomerUseCase;

describe("Delete customer", () => {
  beforeEach(() => {
    inMemoryCustomersRepository = new InMemoryCustomersRepository();
    inMemoryCustomerVehiclesRepository =
      new InMemoryCustomerVehiclesRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );
    inMemoryUnitOfWork = new InMemoryUnitOfWork();

    sut = new DeleteCustomerUseCase(
      inMemoryCustomersRepository,
      inMemoryCustomerVehiclesRepository,
      inMemoryEstablishmentsRepository,
      inMemoryUnitOfWork,
    );
  });

  it("should soft-delete an establishment customer and its active vehicles", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const activeVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
      plate: "ABC1D23",
    });
    const anotherVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      plate: "XYZ9A87",
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryCustomerVehiclesRepository.create(activeVehicle);
    await inMemoryCustomerVehiclesRepository.create(anotherVehicle);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      customerId: customer.id.toString(),
    });

    expect(result.isRight()).toBe(true);
    expect(customer.deletedAt).toBeInstanceOf(Date);
    expect(customer.isDeleted()).toBe(true);
    expect(activeVehicle.deletedAt).toBeInstanceOf(Date);
    expect(activeVehicle.deletedAt).toEqual(customer.deletedAt);
    expect(activeVehicle.isDeleted()).toBe(true);
    expect(anotherVehicle.deletedAt).toBeNull();

    await expect(
      inMemoryCustomerVehiclesRepository.findActiveByPlateAndEstablishmentId(
        "ABC1D23",
        establishment.id.toString(),
      ),
    ).resolves.toBeNull();
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
});
