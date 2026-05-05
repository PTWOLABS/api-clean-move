import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { FakeHashGenerator } from "../../../../../tests/repositories/fake-hash-generator";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { InMemoryUnitOfWork } from "../../../../../tests/repositories/in-memory-unit-of-work";
import { InMemoryUsersRepository } from "../../../../../tests/repositories/in-memory-users-repository";
import { Email } from "../../../accounts/domain/value-objects/email";
import { PersistenceError } from "../../../../shared/errors/persistence-error";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { UniqueConstraintViolationError } from "../../../../shared/errors/unique-constraint-violation-error";
import { InvalidRegisterEmployeeInputError } from "../../../employees/domain/errors/invalid-register-employee-input-error";
import { RegisterEmployeeUseCase } from "./register-employee";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryEmployeesRepository: InMemoryEmployeesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let fakeHashGenerator: FakeHashGenerator;
let inMemoryUnitOfWork: InMemoryUnitOfWork;
let sut: RegisterEmployeeUseCase;

function minorBirthDate() {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - 10);
  date.setUTCHours(0, 0, 0, 0);

  return date;
}

describe("Register employee", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryEmployeesRepository = new InMemoryEmployeesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      new InMemoryServicesRepository(),
    );
    fakeHashGenerator = new FakeHashGenerator();
    inMemoryUnitOfWork = new InMemoryUnitOfWork();

    sut = new RegisterEmployeeUseCase(
      inMemoryUsersRepository,
      inMemoryEmployeesRepository,
      inMemoryEstablishmentsRepository,
      fakeHashGenerator,
      inMemoryUnitOfWork,
    );
  });

  it("should register an employee with required fields", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      name: "Ana Silva",
      email: "ana@example.com",
      password: "strong-password",
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(inMemoryUsersRepository.items).toHaveLength(1);
    expect(inMemoryEmployeesRepository.items).toHaveLength(1);
    expect(inMemoryUsersRepository.items[0]?.role).toBe("EMPLOYEE");
    expect(inMemoryUsersRepository.items[0]?.name).toBe("Ana Silva");
    expect(inMemoryUsersRepository.items[0]?.email.toString()).toBe(
      "ana@example.com",
    );
    expect(inMemoryUsersRepository.items[0]?.hashedPassword).toBe(
      "strong-password-hashed",
    );
    expect(result.value.employee.establishmentId).toBe(establishment.id);
    expect(result.value.employee.userId).toBe(
      inMemoryUsersRepository.items[0]?.id,
    );
    expect(result.value.employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
    ]);
  });

  it("should register an employee with optional fields and extra features", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      name: "Ana Silva",
      email: "ana.optional@example.com",
      password: "strong-password",
      cpf: "529.982.247-25",
      birthDate: new Date("1995-01-01T00:00:00.000Z"),
      extraFeatures: ["update:customers", "create:appointments"],
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.employee.cpf?.toString()).toBe("52998224725");
    expect(result.value.employee.birthDate?.toString()).toBe(
      "1995-01-01T00:00:00.000Z",
    );
    expect(result.value.employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
      "create:appointments",
      "update:customers",
    ]);
  });

  it("should reject duplicate employee email", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryUsersRepository.create(
      makeUser("EMPLOYEE", {
        email: new Email("ana@example.com"),
      }),
    );

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      name: "Ana Silva",
      email: "ana@example.com",
      password: "strong-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceAlreadyExistsError);
    expect(inMemoryEmployeesRepository.items).toHaveLength(0);
  });

  it("should reject an establishment owner without establishment profile", async () => {
    const owner = makeUser("ESTABLISHMENT");

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      name: "Ana Silva",
      email: "ana@example.com",
      password: "strong-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should return unexpected domain error when establishment lookup fails", async () => {
    vi.spyOn(
      inMemoryEstablishmentsRepository,
      "findByOwnerId",
    ).mockRejectedValueOnce(new PersistenceError());

    const result = await sut.execute({
      establishmentOwnerId: "owner-id",
      name: "Ana Silva",
      email: "ana@example.com",
      password: "strong-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(UnexpectedDomainError);
    expect(inMemoryUsersRepository.items).toHaveLength(0);
    expect(inMemoryEmployeesRepository.items).toHaveLength(0);
  });

  it("should return resource already exists when persistence violates unique constraints", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    await inMemoryEstablishmentsRepository.create(establishment);
    vi.spyOn(inMemoryUsersRepository, "create").mockRejectedValueOnce(
      new UniqueConstraintViolationError(),
    );

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      name: "Ana Silva",
      email: "ana@example.com",
      password: "strong-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceAlreadyExistsError);
    expect(inMemoryEmployeesRepository.items).toHaveLength(0);
  });

  it("should return unexpected domain error when persistence fails", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    await inMemoryEstablishmentsRepository.create(establishment);
    vi.spyOn(inMemoryUsersRepository, "create").mockRejectedValueOnce(
      new PersistenceError(),
    );

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      name: "Ana Silva",
      email: "ana@example.com",
      password: "strong-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(UnexpectedDomainError);
    expect(inMemoryEmployeesRepository.items).toHaveLength(0);
  });

  it("should return unexpected domain error when password hashing fails", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    await inMemoryEstablishmentsRepository.create(establishment);
    vi.spyOn(fakeHashGenerator, "hash").mockRejectedValueOnce(
      new Error("Hash provider unavailable"),
    );

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      name: "Ana Silva",
      email: "ana@example.com",
      password: "strong-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(UnexpectedDomainError);
    expect(inMemoryUsersRepository.items).toHaveLength(0);
    expect(inMemoryEmployeesRepository.items).toHaveLength(0);
  });

  it("should persist user and employee inside unit of work", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    await inMemoryEstablishmentsRepository.create(establishment);
    const executeSpy = vi
      .spyOn(inMemoryUnitOfWork, "execute")
      .mockImplementationOnce(async (work) => {
        expect(inMemoryUsersRepository.items).toHaveLength(0);
        expect(inMemoryEmployeesRepository.items).toHaveLength(0);

        const result = await work();

        expect(inMemoryUsersRepository.items).toHaveLength(1);
        expect(inMemoryEmployeesRepository.items).toHaveLength(1);

        return result;
      });

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      name: "Ana Silva",
      email: "ana.unit-of-work@example.com",
      password: "strong-password",
    });

    expect(result.isRight()).toBe(true);
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      field: "email",
      request: {
        email: "invalid-email",
      },
    },
    {
      field: "cpf",
      request: {
        cpf: "11111111111",
      },
    },
    {
      field: "birthDate",
      request: {
        birthDate: minorBirthDate(),
      },
    },
    {
      field: "extraFeatures",
      request: {
        extraFeatures: ["read:appointments"],
      },
    },
  ])("should reject invalid $field", async ({ request }) => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: owner.id.toString(),
      name: "Ana Silva",
      email: "ana@example.com",
      password: "strong-password",
      ...request,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidRegisterEmployeeInputError);
    expect(inMemoryEmployeesRepository.items).toHaveLength(0);
  });
});
