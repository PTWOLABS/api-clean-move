import { Address } from "../../../accounts/domain/value-objects/address";
import { Email } from "../../../accounts/domain/value-objects/email";
import { Phone } from "../../../accounts/domain/value-objects/phone";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { InMemoryUsersRepository } from "../../../../../tests/repositories/in-memory-users-repository";
import { UserEstablishmentResolver } from "../../services/user-establishment-resolver";
import { UpdateUserUseCase } from "./update-user";

let inMemoryUsersRepository: InMemoryUsersRepository;
let userEstablishmentResolver: UserEstablishmentResolver;

let sut: UpdateUserUseCase;

describe("Update user", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    userEstablishmentResolver = new UserEstablishmentResolver(
      new InMemoryEstablishmentsRepository(new InMemoryServicesRepository()),
      new InMemoryEmployeesRepository(),
    );

    sut = new UpdateUserUseCase(
      inMemoryUsersRepository,
      userEstablishmentResolver,
    );
  });

  it("should be able to update an existing user", async () => {
    const createdUser = makeUser("CUSTOMER", {
      name: "Old Name",
      email: new Email("old-email@example.com"),
      phone: Phone.create("11987654321"),
      address: Address.create({
        city: "city-old",
        country: "country-old",
        state: "state-old",
        street: "street-old",
        zipCode: "11111-111",
      }),
    });

    await inMemoryUsersRepository.create(createdUser);

    const result = await sut.execute({
      userId: createdUser.id.toString(),
      name: "New Name",
      email: "new-email@example.com",
      phone: "21987654321",
      address: Address.create({
        city: "city-new",
        country: "country-new",
        state: "state-new",
        street: "street-new",
        zipCode: "22222-222",
      }),
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.user.id.toString()).toBe(createdUser.id.toString());
    expect(result.value.user.name).toBe("New Name");
    expect(result.value.user.email.toString()).toBe("new-email@example.com");
    expect(result.value.user.phone!.toString()).toBe("21987654321");
    expect(result.value.user.address!.zipCode).toBe("22222-222");
    expect(result.value.establishmentId).toBeNull();
    expect(inMemoryUsersRepository.items[0]).toBe(result.value.user);
  });

  it("not should be able to update an unknown user", async () => {
    const unknownUser = makeUser("CUSTOMER");

    const result = await sut.execute({
      userId: unknownUser.id.toString(),
      name: "New Name",
      email: "new-email@example.com",
      phone: "21987654321",
      address: Address.create({
        city: "city-new",
        country: "country-new",
        state: "state-new",
        street: "street-new",
        zipCode: "22222-222",
      }),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("not should be able to update when email is already in use by another user", async () => {
    const existingUser = makeUser("CUSTOMER", {
      email: new Email("existing-email@example.com"),
    });
    const userToUpdate = makeUser("CUSTOMER", {
      email: new Email("user-to-update@example.com"),
    });

    await inMemoryUsersRepository.create(existingUser);
    await inMemoryUsersRepository.create(userToUpdate);

    const result = await sut.execute({
      userId: userToUpdate.id.toString(),
      name: "Updated User",
      email: "existing-email@example.com",
      phone: "21987654321",
      address: Address.create({
        city: "city-new",
        country: "country-new",
        state: "state-new",
        street: "street-new",
        zipCode: "22222-222",
      }),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceAlreadyExistsError);

    expect(inMemoryUsersRepository.items[0]).toBe(existingUser);
    expect(inMemoryUsersRepository.items[1]).toBe(userToUpdate);
  });
});
