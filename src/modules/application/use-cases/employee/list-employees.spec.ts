import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { ListEmployeesUseCase } from "./list-employees";

let employeesRepository: InMemoryEmployeesRepository;
let establishmentsRepository: InMemoryEstablishmentsRepository;
let sut: ListEmployeesUseCase;

describe("List employees", () => {
  beforeEach(() => {
    employeesRepository = new InMemoryEmployeesRepository();
    establishmentsRepository = new InMemoryEstablishmentsRepository(
      new InMemoryServicesRepository(),
    );
    sut = new ListEmployeesUseCase(
      employeesRepository,
      establishmentsRepository,
    );
  });

  it("should list active employees by establishment and filter by name", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const ana = makeEmployee({
      establishmentId: establishment.id,
      name: "Ana Silva",
    });
    const bia = makeEmployee({
      establishmentId: establishment.id,
      name: "Beatriz Souza",
    });
    const deleted = makeEmployee({
      establishmentId: establishment.id,
      name: "Ana Deleted",
    });
    const other = makeEmployee({ name: "Ana Other" });
    deleted.softDelete(new Date("2026-05-05T10:00:00.000Z"));
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(ana);
    await employeesRepository.create(bia);
    await employeesRepository.create(deleted);
    await employeesRepository.create(other);

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      name: "ana",
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(
      result.value.employees.map((employee) => employee.id.toString()),
    ).toEqual([ana.id.toString()]);
  });

  it("should list active employees by establishment without a name filter", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const ana = makeEmployee({
      establishmentId: establishment.id,
      name: "Ana Silva",
    });
    const bia = makeEmployee({
      establishmentId: establishment.id,
      name: "Beatriz Souza",
    });
    const deleted = makeEmployee({
      establishmentId: establishment.id,
      name: "Deleted Employee",
    });
    const other = makeEmployee({ name: "Other Employee" });
    deleted.softDelete(new Date("2026-05-05T10:00:00.000Z"));
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(ana);
    await employeesRepository.create(bia);
    await employeesRepository.create(deleted);
    await employeesRepository.create(other);

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(
      result.value.employees.map((employee) => employee.id.toString()),
    ).toEqual([ana.id.toString(), bia.id.toString()]);
  });

  it("should reject establishment user without establishment profile", async () => {
    const owner = makeUser("ESTABLISHMENT");

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
