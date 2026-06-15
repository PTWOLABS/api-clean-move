import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { Establishment } from "../../../establishments/domain/entities/establishment";
import { GetEstablishmentUseCase } from "./get-establishment";

let establishmentsRepository: InMemoryEstablishmentsRepository;
let employeesRepository: InMemoryEmployeesRepository;
let sut: GetEstablishmentUseCase;

describe("Get establishment", () => {
  beforeEach(() => {
    employeesRepository = new InMemoryEmployeesRepository();
    establishmentsRepository = new InMemoryEstablishmentsRepository(
      new InMemoryServicesRepository(),
    );
    sut = new GetEstablishmentUseCase(
      establishmentsRepository,
      employeesRepository,
    );
  });

  it("should allow establishment owner to read own establishment", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = Establishment.createOAuthDraft({
      ownerId: owner.id,
    });
    await establishmentsRepository.create(establishment);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      establishmentId: establishment.id.toString(),
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.establishment.id.equals(establishment.id)).toBe(true);
    expect(result.value.establishment.tradeName).toBeNull();
  });

  it("should allow employee to read their establishment", async () => {
    const establishment = makeEstablishment();
    await establishmentsRepository.create(establishment);

    const employeeUser = makeUser("EMPLOYEE");
    const employee = makeEmployee({
      userId: employeeUser.id,
      establishmentId: establishment.id,
    });
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: employeeUser.id.toString(), role: "EMPLOYEE" },
      establishmentId: establishment.id.toString(),
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.establishment.id.equals(establishment.id)).toBe(true);
  });

  it("should return not found when establishment id does not exist", async () => {
    const owner = makeUser("ESTABLISHMENT");

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      establishmentId: "00000000-0000-4000-8000-000000000099",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject establishment owner reading another establishment", async () => {
    const ownerA = makeUser("ESTABLISHMENT");
    const ownerB = makeUser("ESTABLISHMENT");
    const establishmentB = makeEstablishment({ ownerId: ownerB.id });
    await establishmentsRepository.create(establishmentB);

    const result = await sut.execute({
      actor: { userId: ownerA.id.toString(), role: "ESTABLISHMENT" },
      establishmentId: establishmentB.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should reject employee reading another establishment", async () => {
    const establishmentA = makeEstablishment();
    const establishmentB = makeEstablishment();
    await establishmentsRepository.create(establishmentA);
    await establishmentsRepository.create(establishmentB);

    const employeeUser = makeUser("EMPLOYEE");
    const employee = makeEmployee({
      userId: employeeUser.id,
      establishmentId: establishmentA.id,
    });
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: employeeUser.id.toString(), role: "EMPLOYEE" },
      establishmentId: establishmentB.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should reject customer role", async () => {
    const establishment = makeEstablishment();
    await establishmentsRepository.create(establishment);
    const customer = makeUser("CUSTOMER");

    const result = await sut.execute({
      actor: { userId: customer.id.toString(), role: "CUSTOMER" },
      establishmentId: establishment.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });
});
