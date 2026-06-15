import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { Establishment } from "../../../establishments/domain/entities/establishment";
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { InMemoryUsersRepository } from "../../../../../tests/repositories/in-memory-users-repository";
import { UserEstablishmentResolver } from "../../services/user-establishment-resolver";
import { GetMeUseCase } from "./get-me";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryEmployeesRepository: InMemoryEmployeesRepository;
let userEstablishmentResolver: UserEstablishmentResolver;

let sut: GetMeUseCase;

describe("Get me", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      new InMemoryServicesRepository(),
    );
    inMemoryEmployeesRepository = new InMemoryEmployeesRepository();

    userEstablishmentResolver = new UserEstablishmentResolver(
      inMemoryEstablishmentsRepository,
      inMemoryEmployeesRepository,
    );

    sut = new GetMeUseCase(inMemoryUsersRepository, userEstablishmentResolver);
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
    expect(result.value.onboardingCompletedAt).toBeNull();
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
    expect(result.value.onboardingCompletedAt).toBeNull();
  });

  it("should return onboarding completion date for establishment owner", async () => {
    const onboardingCompletedAt = new Date("2026-06-11T12:00:00.000Z");
    const owner = makeUser("ESTABLISHMENT");
    await inMemoryUsersRepository.create(owner);

    const establishment = makeEstablishment({
      ownerId: owner.id,
      onboardingCompletedAt,
    });
    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({ userId: owner.id.toString() });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.establishmentId).toBe(establishment.id.toString());
    expect(result.value.onboardingCompletedAt).toBe(onboardingCompletedAt);
  });

  it("should return establishment id for employee", async () => {
    const onboardingCompletedAt = new Date("2026-06-11T12:00:00.000Z");
    const employeeUser = makeUser("EMPLOYEE");
    await inMemoryUsersRepository.create(employeeUser);

    const establishment = makeEstablishment({
      onboardingCompletedAt,
    });
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
    expect(result.value.onboardingCompletedAt).toBe(onboardingCompletedAt);
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
    expect(result.value.onboardingCompletedAt).toBeNull();
  });
});
