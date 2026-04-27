import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { CreateCustomerUseCase } from "./create-customer";

let inMemoryCustomersRepository: InMemoryCustomersRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: CreateCustomerUseCase;

describe("Create customer", () => {
  beforeEach(() => {
    inMemoryCustomersRepository = new InMemoryCustomersRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );

    sut = new CreateCustomerUseCase(
      inMemoryCustomersRepository,
      inMemoryEstablishmentsRepository,
    );
  });

  it("should create an establishment customer", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      cpfCnpj: "529.982.247-25",
      fullName: "Maria Silva",
      phone: "11999999999",
      email: "maria@example.com",
      address: null,
      birthDate: null,
      nickname: "Maria",
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(inMemoryCustomersRepository.items[0]).toBe(result.value.customer);
    expect(result.value.customer.establishmentId).toEqual(establishment.id);
    expect(result.value.customer.cpfCnpj?.toString()).toBe("52998224725");
  });

  it("should not create a customer with duplicated cpfCnpj in the same establishment", async () => {
    const establishment = makeEstablishment();
    const existingCustomer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: "52998224725",
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(existingCustomer);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      cpfCnpj: "529.982.247-25",
      fullName: "Maria Silva",
      phone: "11999999999",
      email: "maria@example.com",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceAlreadyExistsError);
    expect(inMemoryCustomersRepository.items).toHaveLength(1);
  });

  it("should allow the same cpfCnpj in different establishments", async () => {
    const firstEstablishment = makeEstablishment();
    const secondEstablishment = makeEstablishment();
    const existingCustomer = makeCustomer({
      establishmentId: firstEstablishment.id,
      cpfCnpj: "52998224725",
    });

    await inMemoryEstablishmentsRepository.create(firstEstablishment);
    await inMemoryEstablishmentsRepository.create(secondEstablishment);
    await inMemoryCustomersRepository.create(existingCustomer);

    const result = await sut.execute({
      establishmentOwnerId: secondEstablishment.ownerId.toString(),
      cpfCnpj: "529.982.247-25",
      fullName: "Maria Silva",
      phone: "11999999999",
      email: "maria@example.com",
    });

    expect(result.isRight()).toBe(true);
    expect(inMemoryCustomersRepository.items).toHaveLength(2);
  });
});
