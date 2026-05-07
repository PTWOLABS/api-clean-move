import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { InvalidRegisterEmployeeInputError } from "../../../employees/domain/errors/invalid-register-employee-input-error";
import { UpdateEmployeeUseCase } from "./update-employee";

let employeesRepository: InMemoryEmployeesRepository;
let establishmentsRepository: InMemoryEstablishmentsRepository;
let sut: UpdateEmployeeUseCase;

describe("Update employee", () => {
  beforeEach(() => {
    employeesRepository = new InMemoryEmployeesRepository();
    establishmentsRepository = new InMemoryEstablishmentsRepository(
      new InMemoryServicesRepository(),
    );
    sut = new UpdateEmployeeUseCase(
      employeesRepository,
      establishmentsRepository,
    );
  });

  it("should allow an establishment to update employee data and features", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const employee = makeEmployee({ establishmentId: establishment.id });
    const saveSpy = vi.spyOn(employeesRepository, "save");
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      employeeId: employee.id.toString(),
      name: " Beatriz Souza ",
      birthDate: new Date("1995-01-01T00:00:00.000Z"),
      extraFeatures: ["update:employees:self"],
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.employee.name).toBe("Beatriz Souza");
    expect(result.value.employee.birthDate?.toString()).toBe(
      "1995-01-01T00:00:00.000Z",
    );
    expect(result.value.employee.features).toContain("update:employees:self");
    expect(result.value.employee.features).toContain("read:sessions:self");
    expect(saveSpy).toHaveBeenCalledWith(employee);
  });

  it("should allow an employee to update only their own name and birth date", async () => {
    const employeeUser = makeUser("EMPLOYEE");
    const employee = makeEmployee({
      userId: employeeUser.id,
      extraFeatures: ["update:employees:self"],
    });
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: employeeUser.id.toString(), role: "EMPLOYEE" },
      employeeId: employee.id.toString(),
      name: " Beatriz Souza ",
      birthDate: null,
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.employee.name).toBe("Beatriz Souza");
    expect(result.value.employee.birthDate).toBeNull();
  });

  it("should reject employee self-update without update feature", async () => {
    const employeeUser = makeUser("EMPLOYEE");
    const employee = makeEmployee({ userId: employeeUser.id });
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: employeeUser.id.toString(), role: "EMPLOYEE" },
      employeeId: employee.id.toString(),
      name: "Blocked",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should reject employee feature updates from self actor", async () => {
    const employeeUser = makeUser("EMPLOYEE");
    const employee = makeEmployee({
      userId: employeeUser.id,
      extraFeatures: ["update:employees:self"],
    });
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: employeeUser.id.toString(), role: "EMPLOYEE" },
      employeeId: employee.id.toString(),
      extraFeatures: ["delete:customers"],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should reject employee self-update for another employee id as not found", async () => {
    const employeeUser = makeUser("EMPLOYEE");
    const employee = makeEmployee({
      userId: employeeUser.id,
      extraFeatures: ["update:employees:self"],
    });
    const otherEmployee = makeEmployee();
    await employeesRepository.create(employee);
    await employeesRepository.create(otherEmployee);

    const result = await sut.execute({
      actor: { userId: employeeUser.id.toString(), role: "EMPLOYEE" },
      employeeId: otherEmployee.id.toString(),
      name: "Blocked",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject unsupported roles", async () => {
    const result = await sut.execute({
      actor: { userId: "customer-id", role: "CUSTOMER" },
      employeeId: "employee-id",
      name: "Blocked",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should hide cross-establishment employees", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const otherEmployee = makeEmployee();
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(otherEmployee);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      employeeId: otherEmployee.id.toString(),
      name: "Blocked",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should treat deleted employees as not found", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const employee = makeEmployee({ establishmentId: establishment.id });
    employee.softDelete(new Date("2026-05-05T10:00:00.000Z"));
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      employeeId: employee.id.toString(),
      name: "Blocked",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject invalid employee data", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const employee = makeEmployee({ establishmentId: establishment.id });
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      employeeId: employee.id.toString(),
      name: "   ",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidRegisterEmployeeInputError);
  });

  it("should reject invalid employee birth date", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const employee = makeEmployee({ establishmentId: establishment.id });
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      employeeId: employee.id.toString(),
      birthDate: new Date("3000-01-01T00:00:00.000Z"),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidRegisterEmployeeInputError);
  });

  it("should reject invalid employee features", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const employee = makeEmployee({ establishmentId: establishment.id });
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      employeeId: employee.id.toString(),
      extraFeatures: ["approve:payments"],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidRegisterEmployeeInputError);
  });
});
