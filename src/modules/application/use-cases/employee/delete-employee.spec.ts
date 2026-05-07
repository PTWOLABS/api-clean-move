import { randomUUID } from "node:crypto";
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { DeleteEmployeeUseCase } from "./delete-employee";

let employeesRepository: InMemoryEmployeesRepository;
let establishmentsRepository: InMemoryEstablishmentsRepository;
let sut: DeleteEmployeeUseCase;

describe("Delete employee", () => {
  beforeEach(() => {
    employeesRepository = new InMemoryEmployeesRepository();
    establishmentsRepository = new InMemoryEstablishmentsRepository(
      new InMemoryServicesRepository(),
    );
    sut = new DeleteEmployeeUseCase(
      employeesRepository,
      establishmentsRepository,
    );
  });

  it("should soft-delete an employee and remove session features", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const employee = makeEmployee({
      establishmentId: establishment.id,
      extraFeatures: ["update:employees:self"],
    });
    const saveSpy = vi.spyOn(employeesRepository, "save");
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(employee);

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      employeeId: employee.id.toString(),
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.employee.deletedAt).toBeInstanceOf(Date);
    expect(result.value.employee.features).not.toContain(
      "create:sessions:self",
    );
    expect(result.value.employee.features).not.toContain("read:sessions:self");
    expect(result.value.employee.features).toContain("update:employees:self");
    expect(saveSpy).toHaveBeenCalledWith(employee);
  });

  it("should hide employees from another establishment", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const otherEmployee = makeEmployee();
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(otherEmployee);

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      employeeId: otherEmployee.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should treat already deleted employees as not found", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const employee = makeEmployee({ establishmentId: establishment.id });
    employee.softDelete(new Date("2026-05-05T10:00:00.000Z"));
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(employee);

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      employeeId: employee.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should treat missing employees as not found", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    await establishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      employeeId: randomUUID(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
