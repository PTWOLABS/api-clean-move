import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { UpdateCustomerUseCase } from "./update-customer";

let inMemoryCustomersRepository: InMemoryCustomersRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: UpdateCustomerUseCase;

describe("Update customer", () => {
  beforeEach(() => {
    inMemoryCustomersRepository = new InMemoryCustomersRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );

    sut = new UpdateCustomerUseCase(
      inMemoryCustomersRepository,
      inMemoryEstablishmentsRepository,
    );
  });

  it("should update an establishment customer", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      customerId: customer.id.toString(),
      fullName: "Maria Oliveira",
      phone: "11988888888",
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.customer.fullName).toBe("Maria Oliveira");
    expect(result.value.customer.phone.toString()).toBe("11988888888");
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
      fullName: "Maria Oliveira",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not update a customer to a duplicated cpfCnpj in the same establishment", async () => {
    const establishment = makeEstablishment();
    const existingCustomer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: "52998224725",
    });
    const customer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: "81936265000106",
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(existingCustomer);
    await inMemoryCustomersRepository.create(customer);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      customerId: customer.id.toString(),
      cpfCnpj: "529.982.247-25",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceAlreadyExistsError);
  });
});
