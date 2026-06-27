import { Email } from "../../../accounts/domain/value-objects/email";
import { InvalidCurrentPasswordError } from "../../../../shared/errors/invalid-current-password-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { FakeHashComparer } from "../../../../../tests/repositories/fake-hash-comparer";
import { FakeHashGenerator } from "../../../../../tests/repositories/fake-hash-generator";
import { InMemoryUnitOfWork } from "../../../../../tests/repositories/in-memory-unit-of-work";
import { InMemoryUsersRepository } from "../../../../../tests/repositories/in-memory-users-repository";
import {
  InvalidUserPasswordUpdateInputError,
  UpdateUserPasswordUseCase,
} from "./update-user-password";

let inMemoryUsersRepository: InMemoryUsersRepository;
let fakeHashGenerator: FakeHashGenerator;
let fakeHashComparer: FakeHashComparer;
let inMemoryUnitOfWork: InMemoryUnitOfWork;

let sut: UpdateUserPasswordUseCase;

describe("Update user password", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    fakeHashGenerator = new FakeHashGenerator();
    fakeHashComparer = new FakeHashComparer();
    inMemoryUnitOfWork = new InMemoryUnitOfWork();

    sut = new UpdateUserPasswordUseCase(
      inMemoryUsersRepository,
      fakeHashGenerator,
      fakeHashComparer,
      inMemoryUnitOfWork,
    );
  });

  it("should allow OAuth-only user to set the first local password", async () => {
    const user = makeUser("CUSTOMER", {
      email: new Email("oauth@example.com"),
      hashedPassword: null,
      phone: null,
      address: null,
      socialAccounts: [{ provider: "GOOGLE", subjectId: "google-sub-1" }],
    });
    await inMemoryUsersRepository.create(user);

    const result = await sut.execute({
      userId: user.id.toString(),
      newPassword: "first-local-password",
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.user.hashedPassword).toBe(
      "first-local-password-hashed",
    );
    expect(inMemoryUsersRepository.items[0]?.hashedPassword).toBe(
      "first-local-password-hashed",
    );
  });

  it("should reject OAuth-only user when current password is provided", async () => {
    const user = makeUser("CUSTOMER", {
      email: new Email("oauth@example.com"),
      hashedPassword: null,
      phone: null,
      address: null,
      socialAccounts: [{ provider: "GOOGLE", subjectId: "google-sub-1" }],
    });
    await inMemoryUsersRepository.create(user);

    const result = await sut.execute({
      userId: user.id.toString(),
      newPassword: "first-local-password",
      currentPassword: "should-not-be-sent",
    });

    expect(result.isLeft()).toBe(true);
    if (result.isRight()) {
      throw new Error("Expected left result.");
    }

    expect(result.value).toBeInstanceOf(InvalidUserPasswordUpdateInputError);
  });

  it("should allow user with local password to change password", async () => {
    const user = makeUser("CUSTOMER", {
      email: new Email("user@example.com"),
      hashedPassword: "old-password-hashed",
    });
    await inMemoryUsersRepository.create(user);

    const result = await sut.execute({
      userId: user.id.toString(),
      currentPassword: "old-password",
      newPassword: "new-password",
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.user.hashedPassword).toBe("new-password-hashed");
  });

  it("should allow hybrid social user with local password to change password", async () => {
    const user = makeUser("CUSTOMER", {
      email: new Email("hybrid@example.com"),
      hashedPassword: "old-password-hashed",
      socialAccounts: [{ provider: "GOOGLE", subjectId: "google-sub-hybrid" }],
    });
    await inMemoryUsersRepository.create(user);

    const result = await sut.execute({
      userId: user.id.toString(),
      currentPassword: "old-password",
      newPassword: "new-password",
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.user.hashedPassword).toBe("new-password-hashed");
  });

  it("should reject user with local password when current password is missing", async () => {
    const user = makeUser("CUSTOMER", {
      hashedPassword: "old-password-hashed",
    });
    await inMemoryUsersRepository.create(user);

    const result = await sut.execute({
      userId: user.id.toString(),
      newPassword: "new-password",
    });

    expect(result.isLeft()).toBe(true);
    if (result.isRight()) {
      throw new Error("Expected left result.");
    }

    expect(result.value).toBeInstanceOf(InvalidUserPasswordUpdateInputError);
  });

  it("should reject user with local password when current password is incorrect", async () => {
    const user = makeUser("CUSTOMER", {
      hashedPassword: "old-password-hashed",
    });
    await inMemoryUsersRepository.create(user);

    const result = await sut.execute({
      userId: user.id.toString(),
      currentPassword: "wrong-password",
      newPassword: "new-password",
    });

    expect(result.isLeft()).toBe(true);
    if (result.isRight()) {
      throw new Error("Expected left result.");
    }

    expect(result.value).toBeInstanceOf(InvalidCurrentPasswordError);
  });

  it("should not update password for unknown user", async () => {
    const result = await sut.execute({
      userId: "00000000-0000-4000-8000-000000000000",
      newPassword: "new-password",
    });

    expect(result.isLeft()).toBe(true);
    if (result.isRight()) {
      throw new Error("Expected left result.");
    }

    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
