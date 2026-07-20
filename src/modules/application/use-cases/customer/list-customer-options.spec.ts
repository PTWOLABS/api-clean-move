import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { EstablishmentScopeService } from "../../services/establishment-scope";
import { ListCustomerOptionsUseCase } from "./list-customer-options";

let inMemoryCustomersRepository: InMemoryCustomersRepository;
let inMemoryEmployeesRepository: InMemoryEmployeesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let establishmentScope: EstablishmentScopeService;
let sut: ListCustomerOptionsUseCase;

describe("List customer options", () => {
  beforeEach(() => {
    inMemoryCustomersRepository = new InMemoryCustomersRepository();
    inMemoryEmployeesRepository = new InMemoryEmployeesRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );
    establishmentScope = new EstablishmentScopeService(
      inMemoryEstablishmentsRepository,
      inMemoryEmployeesRepository,
    );

    sut = new ListCustomerOptionsUseCase(
      inMemoryCustomersRepository,
      establishmentScope,
    );
  });

  it("should list active customer options matching name or nickname", async () => {
    const establishment = makeEstablishment();
    const otherEstablishment = makeEstablishment();
    const firstCustomer = makeCustomer({
      establishmentId: establishment.id,
      fullName: "Ana Carolina",
      nickname: null,
    });
    const secondCustomer = makeCustomer({
      establishmentId: establishment.id,
      fullName: "Beatriz Souza",
      nickname: "Ana B",
      cpfCnpj: null,
    });
    const thirdCustomer = makeCustomer({
      establishmentId: establishment.id,
      fullName: "Camila Rocha",
      nickname: "Ana C",
      cpfCnpj: null,
    });
    const deletedCustomer = makeCustomer({
      establishmentId: establishment.id,
      fullName: "Ana Deleted",
      cpfCnpj: null,
    });
    const otherCustomer = makeCustomer({
      establishmentId: otherEstablishment.id,
      fullName: "Ana Outside",
      cpfCnpj: null,
    });

    deletedCustomer.softDelete(new Date("2026-05-26T10:00:00.000Z"));

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEstablishmentsRepository.create(otherEstablishment);
    await inMemoryCustomersRepository.create(firstCustomer);
    await inMemoryCustomersRepository.create(secondCustomer);
    await inMemoryCustomersRepository.create(thirdCustomer);
    await inMemoryCustomersRepository.create(deletedCustomer);
    await inMemoryCustomersRepository.create(otherCustomer);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      search: "ana",
      size: 2,
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.customers).toEqual([
      {
        id: firstCustomer.id.toString(),
        label: "Ana Carolina",
      },
      {
        id: secondCustomer.id.toString(),
        label: "Beatriz Souza",
      },
    ]);
    expect(result.value.totalItems).toBe(3);
  });

  it("should allow employee scope", async () => {
    const establishment = makeEstablishment();
    const user = makeUser("EMPLOYEE");
    const employee = makeEmployee({
      establishmentId: establishment.id,
      userId: user.id,
    });
    const customer = makeCustomer({
      establishmentId: establishment.id,
      fullName: "Maria Silva",
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEmployeesRepository.create(employee);
    await inMemoryCustomersRepository.create(customer);

    const result = await sut.execute({
      actor: { userId: user.id.toString(), role: "EMPLOYEE" },
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.customers).toEqual([
      {
        id: customer.id.toString(),
        label: "Maria Silva",
      },
    ]);
    expect(result.value.totalItems).toBe(1);
  });

  it("should reject a missing establishment", async () => {
    const result = await sut.execute({
      actor: { userId: "missing-owner", role: "ESTABLISHMENT" },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
