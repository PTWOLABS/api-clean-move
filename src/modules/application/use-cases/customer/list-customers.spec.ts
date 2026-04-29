import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { ListCustomersUseCase } from "./list-customers";

let inMemoryCustomersRepository: InMemoryCustomersRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: ListCustomersUseCase;

describe("List customers", () => {
  beforeEach(() => {
    inMemoryCustomersRepository = new InMemoryCustomersRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );

    sut = new ListCustomersUseCase(
      inMemoryCustomersRepository,
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

    expect(result.value.customers).toEqual([firstCustomer, secondCustomer]);
  });

  it("should reject a missing establishment", async () => {
    const result = await sut.execute({
      establishmentOwnerId: "missing-owner",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
