import { Email } from "../../../accounts/domain/value-objects/email";
import { PasswordChangeConfirmationCode } from "../../../accounts/domain/entities/password-change-confirmation-code";
import { EnvService } from "../../../../infra/env/env.service";
import { InvalidCurrentPasswordError } from "../../../../shared/errors/invalid-current-password-error";
import { InvalidPasswordConfirmationCodeError } from "../../../../shared/errors/invalid-password-confirmation-code-error";
import { InvalidUserPasswordUpdateInputError } from "../../../../shared/errors/invalid-user-password-update-input-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { SamePasswordError } from "../../../../shared/errors/same-password-error";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { FakeHashComparer } from "../../../../../tests/repositories/fake-hash-comparer";
import { FakeHashGenerator } from "../../../../../tests/repositories/fake-hash-generator";
import { FakeTokenHasher } from "../../../../../tests/repositories/fake-token-hasher";
import { InMemoryPasswordChangeConfirmationCodesRepository } from "../../../../../tests/repositories/in-memory-password-change-confirmation-codes-repository";
import { InMemoryUnitOfWork } from "../../../../../tests/repositories/in-memory-unit-of-work";
import { InMemoryUsersRepository } from "../../../../../tests/repositories/in-memory-users-repository";
import { PasswordChangeValidator } from "../../services/password-change-validator";
import { UpdateUserPasswordUseCase } from "./update-user-password";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryConfirmationCodesRepository: InMemoryPasswordChangeConfirmationCodesRepository;
let fakeHashGenerator: FakeHashGenerator;
let fakeHashComparer: FakeHashComparer;
let fakeTokenHasher: FakeTokenHasher;
let inMemoryUnitOfWork: InMemoryUnitOfWork;
let passwordChangeValidator: PasswordChangeValidator;
let envService: EnvService;

let sut: UpdateUserPasswordUseCase;

const MAX_FAILED_ATTEMPTS = 5;

describe("Update user password", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryConfirmationCodesRepository =
      new InMemoryPasswordChangeConfirmationCodesRepository();
    fakeHashGenerator = new FakeHashGenerator();
    fakeHashComparer = new FakeHashComparer();
    fakeTokenHasher = new FakeTokenHasher();
    inMemoryUnitOfWork = new InMemoryUnitOfWork();
    passwordChangeValidator = new PasswordChangeValidator(fakeHashComparer);
    envService = {
      get: (key: string) => {
        if (key === "PASSWORD_CONFIRMATION_CODE_MAX_FAILED_ATTEMPTS") {
          return MAX_FAILED_ATTEMPTS;
        }

        throw new Error(`Unexpected env key: ${key}`);
      },
    } as EnvService;

    sut = new UpdateUserPasswordUseCase(
      inMemoryUsersRepository,
      inMemoryConfirmationCodesRepository,
      fakeHashGenerator,
      fakeHashComparer,
      fakeTokenHasher,
      passwordChangeValidator,
      inMemoryUnitOfWork,
      envService,
    );
  });

  async function seedConfirmationCode(
    userId: string,
    newPassword: string,
    code = "123456",
  ) {
    const user = await inMemoryUsersRepository.findById(userId);

    if (!user) {
      throw new Error("Expected user.");
    }

    await inMemoryConfirmationCodesRepository.upsert(
      PasswordChangeConfirmationCode.create({
        userId: user.id,
        hashedCode: `${code}-token-hashed`,
        pendingPasswordHash: `${newPassword}-hashed`,
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        failedAttempts: 0,
      }),
    );
  }

  it("should allow OAuth-only user to set the first local password with confirmation code", async () => {
    const user = makeUser("CUSTOMER", {
      email: new Email("oauth@example.com"),
      hashedPassword: null,
      phone: null,
      address: null,
      socialAccounts: [{ provider: "GOOGLE", subjectId: "google-sub-1" }],
    });
    await inMemoryUsersRepository.create(user);
    await seedConfirmationCode(user.id.toString(), "first-local-password");

    const result = await sut.execute({
      userId: user.id.toString(),
      confirmationCode: "123456",
      newPassword: "first-local-password",
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.user.hashedPassword).toBe(
      "first-local-password-hashed",
    );
    expect(inMemoryConfirmationCodesRepository.items).toHaveLength(0);
  });

  it("should reject password update without valid confirmation code", async () => {
    const user = makeUser("CUSTOMER", {
      hashedPassword: "old-password-hashed",
    });
    await inMemoryUsersRepository.create(user);
    await seedConfirmationCode(user.id.toString(), "new-password");

    const result = await sut.execute({
      userId: user.id.toString(),
      confirmationCode: "999999",
      currentPassword: "old-password",
      newPassword: "new-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidPasswordConfirmationCodeError);
    expect(inMemoryConfirmationCodesRepository.items[0]?.failedAttempts).toBe(
      1,
    );
  });

  it("should reject expired confirmation code without incrementing failed attempts", async () => {
    const user = makeUser("CUSTOMER", {
      hashedPassword: "old-password-hashed",
    });
    await inMemoryUsersRepository.create(user);

    await inMemoryConfirmationCodesRepository.upsert(
      PasswordChangeConfirmationCode.create({
        userId: user.id,
        hashedCode: "123456-token-hashed",
        pendingPasswordHash: "new-password-hashed",
        expiresAt: new Date("2020-01-01T00:00:00.000Z"),
        failedAttempts: 0,
      }),
    );

    const result = await sut.execute({
      userId: user.id.toString(),
      confirmationCode: "123456",
      currentPassword: "old-password",
      newPassword: "new-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidPasswordConfirmationCodeError);
    expect(inMemoryConfirmationCodesRepository.items[0]?.failedAttempts).toBe(
      0,
    );
  });

  it("should delete confirmation code after max failed attempts", async () => {
    const user = makeUser("CUSTOMER", {
      hashedPassword: "old-password-hashed",
    });
    await inMemoryUsersRepository.create(user);

    await inMemoryConfirmationCodesRepository.upsert(
      PasswordChangeConfirmationCode.create({
        userId: user.id,
        hashedCode: "123456-token-hashed",
        pendingPasswordHash: "new-password-hashed",
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        failedAttempts: MAX_FAILED_ATTEMPTS - 1,
      }),
    );

    const result = await sut.execute({
      userId: user.id.toString(),
      confirmationCode: "999999",
      currentPassword: "old-password",
      newPassword: "new-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidPasswordConfirmationCodeError);
    expect(inMemoryConfirmationCodesRepository.items).toHaveLength(0);
  });

  it("should reject when new password differs from the one used to request the code", async () => {
    const user = makeUser("CUSTOMER", {
      hashedPassword: "old-password-hashed",
    });
    await inMemoryUsersRepository.create(user);
    await seedConfirmationCode(user.id.toString(), "requested-password");

    const result = await sut.execute({
      userId: user.id.toString(),
      confirmationCode: "123456",
      currentPassword: "old-password",
      newPassword: "different-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidUserPasswordUpdateInputError);
    if (!(result.value instanceof InvalidUserPasswordUpdateInputError)) {
      throw new Error("Expected InvalidUserPasswordUpdateInputError.");
    }

    expect(result.value.message).toBe(
      "The new password does not match the one used to request the confirmation code.",
    );
  });

  it("should allow user with local password to change password", async () => {
    const user = makeUser("CUSTOMER", {
      email: new Email("user@example.com"),
      hashedPassword: "old-password-hashed",
    });
    await inMemoryUsersRepository.create(user);
    await seedConfirmationCode(user.id.toString(), "new-password");

    const result = await sut.execute({
      userId: user.id.toString(),
      confirmationCode: "123456",
      currentPassword: "old-password",
      newPassword: "new-password",
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.user.hashedPassword).toBe("new-password-hashed");
  });

  it("should reject same password when changing an existing password", async () => {
    const user = makeUser("CUSTOMER", {
      hashedPassword: "old-password-hashed",
    });
    await inMemoryUsersRepository.create(user);
    await seedConfirmationCode(user.id.toString(), "old-password");

    const result = await sut.execute({
      userId: user.id.toString(),
      confirmationCode: "123456",
      currentPassword: "old-password",
      newPassword: "old-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(SamePasswordError);
  });

  it("should reject user with local password when current password is missing", async () => {
    const user = makeUser("CUSTOMER", {
      hashedPassword: "old-password-hashed",
    });
    await inMemoryUsersRepository.create(user);
    await seedConfirmationCode(user.id.toString(), "new-password");

    const result = await sut.execute({
      userId: user.id.toString(),
      confirmationCode: "123456",
      newPassword: "new-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidUserPasswordUpdateInputError);
  });

  it("should reject user with local password when current password is incorrect", async () => {
    const user = makeUser("CUSTOMER", {
      hashedPassword: "old-password-hashed",
    });
    await inMemoryUsersRepository.create(user);
    await seedConfirmationCode(user.id.toString(), "new-password");

    const result = await sut.execute({
      userId: user.id.toString(),
      confirmationCode: "123456",
      currentPassword: "wrong-password",
      newPassword: "new-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidCurrentPasswordError);
    if (!(result.value instanceof InvalidCurrentPasswordError)) {
      throw new Error("Expected InvalidCurrentPasswordError.");
    }

    expect(result.value.code).toBe("INVALID_CURRENT_PASSWORD");
    expect(result.value.field).toBe("currentPassword");
  });

  it("should not update password for unknown user", async () => {
    const result = await sut.execute({
      userId: "00000000-0000-4000-8000-000000000000",
      confirmationCode: "123456",
      newPassword: "new-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
