import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Employee } from "../../../employees/domain/entities/employee";
import { GetEmployeeUseCase } from "./get-employee";

let employeesRepository: InMemoryEmployeesRepository;
let establishmentsRepository: InMemoryEstablishmentsRepository;
let sut: GetEmployeeUseCase;

describe("Get employee", () => {
  beforeEach(() => {
    employeesRepository = new InMemoryEmployeesRepository();
    establishmentsRepository = new InMemoryEstablishmentsRepository(
      new InMemoryServicesRepository(),
    );
    sut = new GetEmployeeUseCase(employeesRepository, establishmentsRepository);
  });

  it("should allow establishment to get owned employee", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const employee = makeEmployee({ establishmentId: establishment.id });
    await establishmentsRepository.create(establishment);
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      employeeId: employee.id.toString(),
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.employee.id.equals(employee.id)).toBe(true);
  });

  it("should allow employee to get itself", async () => {
    const user = makeUser("EMPLOYEE");
    const employee = makeEmployee({ userId: user.id });
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: user.id.toString(), role: "EMPLOYEE" },
      employeeId: employee.id.toString(),
    });

    expect(result.isRight()).toBe(true);
  });

  it("should reject employee without read self feature", async () => {
    const user = makeUser("EMPLOYEE");
    const employee = Employee.restore({
      establishmentId: new UniqueEntityId(),
      userId: user.id,
      profileImageUrl: null,
      name: user.name,
      cpf: null,
      birthDate: null,
      features: [
        "read:appointments",
        "read:services",
        "read:customers",
        "create:sessions:self",
        "read:sessions:self",
      ],
      deletedAt: null,
      createdAt: new Date("2026-05-05T10:00:00.000Z"),
      updatedAt: new Date("2026-05-05T10:00:00.000Z"),
    });
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: user.id.toString(), role: "EMPLOYEE" },
      employeeId: employee.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should treat deleted self employee as not found", async () => {
    const user = makeUser("EMPLOYEE");
    const employee = makeEmployee({ userId: user.id });
    employee.softDelete(new Date("2026-05-05T10:00:00.000Z"));
    await employeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: user.id.toString(), role: "EMPLOYEE" },
      employeeId: employee.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject employee getting another employee", async () => {
    const user = makeUser("EMPLOYEE");
    const employee = makeEmployee({ userId: user.id });
    const otherEmployee = makeEmployee();
    await employeesRepository.create(employee);
    await employeesRepository.create(otherEmployee);

    const result = await sut.execute({
      actor: { userId: user.id.toString(), role: "EMPLOYEE" },
      employeeId: otherEmployee.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject unsupported roles", async () => {
    const result = await sut.execute({
      actor: { userId: "customer-id", role: "CUSTOMER" },
      employeeId: "employee-id",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });
});
