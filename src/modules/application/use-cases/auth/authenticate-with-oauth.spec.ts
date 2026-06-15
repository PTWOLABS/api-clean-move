import { Email } from "../../../accounts/domain/value-objects/email";
import { OAuthEmailMismatchError } from "../../../../shared/errors/oauth-email-mismatch-error";
import { OAuthEmailNotVerifiedError } from "../../../../shared/errors/oauth-email-not-verified-error";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { InMemoryUnitOfWork } from "../../../../../tests/repositories/in-memory-unit-of-work";
import { InMemoryUsersRepository } from "../../../../../tests/repositories/in-memory-users-repository";
import { AuthenticateWithOAuthUseCase } from "./authenticate-with-oauth";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryUnitOfWork: InMemoryUnitOfWork;

let sut: AuthenticateWithOAuthUseCase;

describe("Authenticate with OAuth", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      new InMemoryServicesRepository(),
    );
    inMemoryUnitOfWork = new InMemoryUnitOfWork();

    sut = new AuthenticateWithOAuthUseCase(
      inMemoryUsersRepository,
      inMemoryEstablishmentsRepository,
      inMemoryUnitOfWork,
    );
  });

  it("should reject when email is not verified", async () => {
    const result = await sut.execute({
      provider: "GOOGLE",
      subjectId: "google-sub-1",
      email: new Email("john@example.com"),
      emailVerified: false,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(OAuthEmailNotVerifiedError);
  });

  it("should return user found by provider and subject when email matches", async () => {
    const user = makeUser("CUSTOMER", {
      email: new Email("john@example.com"),
      socialAccounts: [{ provider: "GOOGLE", subjectId: "google-sub-1" }],
    });

    await inMemoryUsersRepository.create(user);

    const result = await sut.execute({
      provider: "GOOGLE",
      subjectId: "google-sub-1",
      email: new Email("john@example.com"),
      emailVerified: true,
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.user).toBe(user);
  });

  it("should reject when linked user email does not match OAuth email", async () => {
    const user = makeUser("CUSTOMER", {
      email: new Email("john@example.com"),
      socialAccounts: [{ provider: "GOOGLE", subjectId: "google-sub-1" }],
    });

    await inMemoryUsersRepository.create(user);

    const result = await sut.execute({
      provider: "GOOGLE",
      subjectId: "google-sub-1",
      email: new Email("other@example.com"),
      emailVerified: true,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(OAuthEmailMismatchError);
  });

  it("should authenticate after email update when OAuth email matches the new account email", async () => {
    const user = makeUser("CUSTOMER", {
      email: new Email("new-email@example.com"),
      socialAccounts: [{ provider: "GOOGLE", subjectId: "google-sub-1" }],
    });

    await inMemoryUsersRepository.create(user);

    const result = await sut.execute({
      provider: "GOOGLE",
      subjectId: "google-sub-1",
      email: new Email("new-email@example.com"),
      emailVerified: true,
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.user.email.toString()).toBe("new-email@example.com");
  });

  it("should reject OAuth login with old email after account email was updated", async () => {
    const user = makeUser("CUSTOMER", {
      email: new Email("new-email@example.com"),
      socialAccounts: [{ provider: "GOOGLE", subjectId: "google-sub-1" }],
    });

    await inMemoryUsersRepository.create(user);

    const result = await sut.execute({
      provider: "GOOGLE",
      subjectId: "google-sub-1",
      email: new Email("old-email@example.com"),
      emailVerified: true,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(OAuthEmailMismatchError);
  });

  it("should link provider when user exists by email without creating establishment", async () => {
    const user = makeUser("CUSTOMER", {
      email: new Email("john@example.com"),
      socialAccounts: [],
    });

    await inMemoryUsersRepository.create(user);

    const result = await sut.execute({
      provider: "GOOGLE",
      subjectId: "google-sub-new",
      email: new Email("john@example.com"),
      emailVerified: true,
      name: "John Doe",
      roleForNewUser: "ESTABLISHMENT",
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.user.socialAccounts).toEqual([
      { provider: "GOOGLE", subjectId: "google-sub-new" },
    ]);
    expect(inMemoryEstablishmentsRepository.items).toHaveLength(0);
  });

  it("should create customer user only when role is CUSTOMER", async () => {
    const result = await sut.execute({
      provider: "GOOGLE",
      subjectId: "google-brand-new",
      email: new Email("newuser@example.com"),
      emailVerified: true,
      name: "New User",
      roleForNewUser: "CUSTOMER",
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    const { user } = result.value;

    expect(user.role).toBe("CUSTOMER");
    expect(user.profileImageUrl).toBeNull();
    expect(inMemoryUsersRepository.items).toHaveLength(1);
    expect(inMemoryEstablishmentsRepository.items).toHaveLength(0);
  });

  it("should create establishment draft when role is ESTABLISHMENT", async () => {
    const result = await sut.execute({
      provider: "GOOGLE",
      subjectId: "google-establishment-new",
      email: new Email("owner@example.com"),
      emailVerified: true,
      name: "Owner User",
      roleForNewUser: "ESTABLISHMENT",
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    const { user } = result.value;

    expect(user.role).toBe("ESTABLISHMENT");
    expect(user.profileImageUrl).toBeNull();
    expect(inMemoryEstablishmentsRepository.items).toHaveLength(1);

    const establishment = inMemoryEstablishmentsRepository.items[0];

    expect(establishment?.ownerId.equals(user.id)).toBe(true);
    expect(establishment?.tradeName).toBeNull();
    expect(establishment?.cnpj).toBeNull();
  });
});
