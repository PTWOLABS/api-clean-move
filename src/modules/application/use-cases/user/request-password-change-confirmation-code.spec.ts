import { EnvService } from "../../../../infra/env/env.service";
import { Email } from "../../../accounts/domain/value-objects/email";
import { InvalidCurrentPasswordError } from "../../../../shared/errors/invalid-current-password-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { SamePasswordError } from "../../../../shared/errors/same-password-error";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { FakeConfirmationCodeGenerator } from "../../../../../tests/repositories/fake-confirmation-code-generator";
import { FakeEmailSender } from "../../../../../tests/repositories/fake-email-sender";
import { FakeHashComparer } from "../../../../../tests/repositories/fake-hash-comparer";
import { FakeTokenHasher } from "../../../../../tests/repositories/fake-token-hasher";
import { InMemoryPasswordChangeConfirmationCodesRepository } from "../../../../../tests/repositories/in-memory-password-change-confirmation-codes-repository";
import { InMemoryUsersRepository } from "../../../../../tests/repositories/in-memory-users-repository";
import { PasswordChangeValidator } from "../../services/password-change-validator";
import { InvalidUserPasswordUpdateInputError } from "../user/update-user-password";
import { RequestPasswordChangeConfirmationCodeUseCase } from "./request-password-change-confirmation-code";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryConfirmationCodesRepository: InMemoryPasswordChangeConfirmationCodesRepository;
let fakeConfirmationCodeGenerator: FakeConfirmationCodeGenerator;
let fakeTokenHasher: FakeTokenHasher;
let fakeEmailSender: FakeEmailSender;
let passwordChangeValidator: PasswordChangeValidator;
let envService: EnvService;

let sut: RequestPasswordChangeConfirmationCodeUseCase;

describe("Request password change confirmation code", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryConfirmationCodesRepository =
      new InMemoryPasswordChangeConfirmationCodesRepository();
    fakeConfirmationCodeGenerator = new FakeConfirmationCodeGenerator();
    fakeTokenHasher = new FakeTokenHasher();
    fakeEmailSender = new FakeEmailSender();
    passwordChangeValidator = new PasswordChangeValidator(
      new FakeHashComparer(),
    );
    envService = {
      get: (key: string) => {
        if (key === "EMAIL_LOGO_URL") {
          return "https://cdn.example.com/logo.png";
        }

        throw new Error(`Unexpected env key: ${key}`);
      },
    } as EnvService;

    sut = new RequestPasswordChangeConfirmationCodeUseCase(
      inMemoryUsersRepository,
      inMemoryConfirmationCodesRepository,
      fakeConfirmationCodeGenerator,
      fakeTokenHasher,
      fakeEmailSender,
      passwordChangeValidator,
      envService,
    );
  });

  it("should send a confirmation code for OAuth-only user setting first password", async () => {
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
    expect(inMemoryConfirmationCodesRepository.items).toHaveLength(1);
    expect(inMemoryConfirmationCodesRepository.items[0]?.hashedCode).toBe(
      "123456-token-hashed",
    );
    expect(fakeEmailSender.sent).toHaveLength(1);
    expect(fakeEmailSender.sent[0]?.subject).toBe(
      "Confirme a alteração de senha",
    );
    expect(fakeEmailSender.sent[0]?.html).toContain(
      'data-confirmation-code="123456"',
    );
  });

  it("should reject same password when changing an existing password", async () => {
    const user = makeUser("CUSTOMER", {
      hashedPassword: "old-password-hashed",
    });
    await inMemoryUsersRepository.create(user);

    const result = await sut.execute({
      userId: user.id.toString(),
      currentPassword: "old-password",
      newPassword: "old-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(SamePasswordError);
    expect(fakeEmailSender.sent).toHaveLength(0);
  });

  it("should reject incorrect current password", async () => {
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
    expect(result.value).toBeInstanceOf(InvalidCurrentPasswordError);
  });

  it("should not send code for unknown user", async () => {
    const result = await sut.execute({
      userId: "00000000-0000-4000-8000-000000000000",
      newPassword: "new-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject OAuth-only user when current password is provided", async () => {
    const user = makeUser("CUSTOMER", {
      hashedPassword: null,
    });
    await inMemoryUsersRepository.create(user);

    const result = await sut.execute({
      userId: user.id.toString(),
      newPassword: "first-local-password",
      currentPassword: "should-not-be-sent",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidUserPasswordUpdateInputError);
  });
});
