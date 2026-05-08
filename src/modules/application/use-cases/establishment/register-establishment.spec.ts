import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { FakeHashGenerator } from "../../../../../tests/repositories/fake-hash-generator";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { InMemoryUnitOfWork } from "../../../../../tests/repositories/in-memory-unit-of-work";
import { InMemoryUsersRepository } from "../../../../../tests/repositories/in-memory-users-repository";
import { Email } from "../../../accounts/domain/value-objects/email";
import { InvalidRegisterEstablishmentInputError } from "../../../establishments/domain/errors/invalid-register-establishment-input-error";
import { Cnpj } from "../../../establishments/domain/value-objects/cnpj";
import { RegisterEstablishmentUseCase } from "./register-establishment";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let fakeHashGenerator: FakeHashGenerator;
let inMemoryUnitOfWork: InMemoryUnitOfWork;

let sut: RegisterEstablishmentUseCase;

describe("Register an establishment", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      new InMemoryServicesRepository(),
    );
    fakeHashGenerator = new FakeHashGenerator();
    inMemoryUnitOfWork = new InMemoryUnitOfWork();

    sut = new RegisterEstablishmentUseCase(
      inMemoryUsersRepository,
      inMemoryEstablishmentsRepository,
      fakeHashGenerator,
      inMemoryUnitOfWork,
    );
  });

  it("should be able to register an establishment with valid data", async () => {
    const result = await sut.execute({
      name: "Jon Doe",
      address: {
        city: "city-1",
        country: "country-1",
        state: "state-1",
        street: "street-1",
        zipCode: "11111-111",
      },
      cnpj: "37.158.666/0001-82",
      tradeName: "Valid Establishment",
      legalBusinessName: "SOCIAL REASON TEST LTDA",
      email: "jondoe@example.com",
      password: "jondoe@123",
      phone: "11987654321",
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(inMemoryEstablishmentsRepository.items[0]).toBe(
      result.value.establishment,
    );
    expect(inMemoryUsersRepository.items[0]?.id).toBe(
      result.value.establishment.ownerId,
    );
    expect(inMemoryUsersRepository.items[0]?.hashedPassword).toBe(
      "jondoe@123-hashed",
    );
    expect(result.value.establishment.slug.value).toEqual(
      "valid-establishment",
    );
  });

  it("not should be able to register an establishment with duplicated email", async () => {
    const createdUser = makeUser("ESTABLISHMENT", {
      email: new Email("jondoe@example.com"),
    });

    await inMemoryUsersRepository.create(createdUser);

    const result = await sut.execute({
      name: "UserWithTheSameEmail",
      address: {
        city: "city-1",
        country: "country-1",
        state: "state-1",
        street: "street-1",
        zipCode: "11111-111",
      },
      cnpj: "03823548000120",
      tradeName: "Establishment-2",
      legalBusinessName: "SOCIAL REASON TEST LTDA 2",
      email: "jondoe@example.com",
      password: "jondoe@123",
      phone: "11987654321",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceAlreadyExistsError);

    expect(inMemoryUsersRepository.items).toHaveLength(1);
    expect(inMemoryUsersRepository.items[0]).toBe(createdUser);
    expect(inMemoryEstablishmentsRepository.items).toHaveLength(0);
  });

  it("should persist the custom slug passed to the use case", async () => {
    const result = await sut.execute({
      name: "Jon Doe",
      address: {
        city: "city-1",
        country: "country-1",
        state: "state-1",
        street: "street-1",
        zipCode: "11111-111",
      },
      cnpj: "41.437.902/0001-77",
      tradeName: "Valid Establishment",
      legalBusinessName: "SOCIAL REASON TEST LTDA",
      email: "custom-slug@example.com",
      password: "jondoe@123",
      phone: "11987654321",
      slug: "custom-establishment-slug",
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.establishment.slug.value).toBe(
      "custom-establishment-slug",
    );
  });

  it("not should be able to register an establishment with duplicated cnpj", async () => {
    const createdEstablishment = makeEstablishment({
      cnpj: Cnpj.create("41437902000177"),
    });

    await inMemoryEstablishmentsRepository.create(createdEstablishment);

    const result = await sut.execute({
      name: "EstablishmentWithTheSameCnpj",
      address: {
        city: "city-1",
        country: "country-1",
        state: "state-1",
        street: "street-1",
        zipCode: "11111-111",
      },
      cnpj: "41.437.902/0001-77",
      tradeName: "Establishment-2",
      legalBusinessName: "SOCIAL REASON TEST LTDA",
      email: "jondoe@example.com",
      password: "jondoe@123",
      phone: "11987654321",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceAlreadyExistsError);

    expect(inMemoryEstablishmentsRepository.items[0]).toBe(
      createdEstablishment,
    );
    expect(inMemoryEstablishmentsRepository.items).toHaveLength(1);

    expect(inMemoryUsersRepository.items).toHaveLength(0);
  });

  it("not should be able to register an establishment with invalid email", async () => {
    const result = await sut.execute({
      name: "Jon Doe",
      address: {
        city: "city-1",
        country: "country-1",
        state: "state-1",
        street: "street-1",
        zipCode: "11111-111",
      },
      cnpj: "18472512000116",
      tradeName: "Establishment-1",
      legalBusinessName: "SOCIAL REASON TEST LTDA",
      email: "invalid-format",
      password: "jondoe@123",
      phone: "11987654321",
    });

    expect(result.isLeft()).toBe(true);

    if (result.isRight()) {
      throw new Error("Expected invalid establishment input.");
    }

    expect(result.value).toBeInstanceOf(InvalidRegisterEstablishmentInputError);
    expect(result.value.message).toBe("Invalid email address: invalid-format");
    expect(inMemoryUsersRepository.items).toHaveLength(0);
    expect(inMemoryEstablishmentsRepository.items).toHaveLength(0);
  });

  it("not should be able to register an establishment with invalid cnpj", async () => {
    const result = await sut.execute({
      name: "Jon Doe",
      address: {
        city: "city-1",
        country: "country-1",
        state: "state-1",
        street: "street-1",
        zipCode: "11111-111",
      },
      cnpj: "05027115000191",
      tradeName: "Establishment-1",
      legalBusinessName: "SOCIAL REASON TEST LTDA",
      email: "validemail@example.com",
      password: "jondoe@123",
      phone: "11987654321",
    });

    expect(result.isLeft()).toBe(true);

    if (result.isRight()) {
      throw new Error("Expected invalid establishment input.");
    }

    expect(result.value).toBeInstanceOf(InvalidRegisterEstablishmentInputError);
    expect(result.value.message).toBe("Invalid CNPJ: 05027115000191");
    expect(inMemoryUsersRepository.items).toHaveLength(0);
    expect(inMemoryEstablishmentsRepository.items).toHaveLength(0);
  });
});
