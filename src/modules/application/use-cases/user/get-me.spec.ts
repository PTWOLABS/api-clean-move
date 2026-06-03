import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Establishment } from "../../../establishments/domain/entities/establishment";
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryUsersRepository } from "../../../../../tests/repositories/in-memory-users-repository";
import { GetMeUseCase } from "./get-me";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryEmployeesRepository: InMemoryEmployeesRepository;

let sut: GetMeUseCase;

describe("Get me", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository();
    inMemoryEmployeesRepository = new InMemoryEmployeesRepository();

    sut = new GetMeUseCase(
      inMemoryUsersRepository,
      inMemoryEstablishmentsRepository,
      inMemoryEmployeesRepository,
    );
  });

  it("should be able to get the authenticated user", async () => {
    const createdUser = makeUser("CUSTOMER");

    await inMemoryUsersRepository.create(createdUser);

    const result = await sut.execute({
      userId: createdUser.id.toString(),
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.user).toBe(createdUser);
    expect(result.value.establishmentId).toBeNull();
  });

  it("not should be able to get me with unknown user id", async () => {
    const result = await sut.execute({
      userId: "unknown-user-id",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should return establishment id for establishment owner", async () => {
    const owner = makeUser("ESTABLISHMENT");
    await inMemoryUsersRepository.create(owner);

    const establishment = Establishment.createOAuthDraft({
      ownerId: owner.id,
    });
    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({ userId: owner.id.toString() });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.establishmentId).toBe(establishment.id.toString());
  });

  it("should return establishment id for employee", async () => {
    const employeeUser = makeUser("EMPLOYEE");
    await inMemoryUsersRepository.create(employeeUser);

    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);

    const employee = makeEmployee({
      userId: employeeUser.id,
      establishmentId: establishment.id,
    });
    await inMemoryEmployeesRepository.create(employee);

    const result = await sut.execute({ userId: employeeUser.id.toString() });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.establishmentId).toBe(establishment.id.toString());
  });

  it("should return null establishment id when owner has no establishment row", async () => {
    const owner = makeUser("ESTABLISHMENT");
    await inMemoryUsersRepository.create(owner);

    const result = await sut.execute({ userId: owner.id.toString() });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.establishmentId).toBeNull();
  });
});
