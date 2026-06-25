import { PasswordResetToken } from "../../../accounts/domain/entities/password-reset-token";
import { Session } from "../../../accounts/domain/entities/session";
import { Email } from "../../../accounts/domain/value-objects/email";
import { InvalidOrExpiredPasswordResetTokenError } from "../../../../shared/errors/invalid-or-expired-password-reset-token-error";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { FakeEmailSender } from "../../../../../tests/repositories/fake-email-sender";
import { FakeHashGenerator } from "../../../../../tests/repositories/fake-hash-generator";
import { FakePasswordResetAuditLogger } from "../../../../../tests/repositories/fake-password-reset-audit-logger";
import { FakeTokenHasher } from "../../../../../tests/repositories/fake-token-hasher";
import { InMemoryPasswordResetTokensRepository } from "../../../../../tests/repositories/in-memory-password-reset-tokens-repository";
import { InMemorySessionsRepository } from "../../../../../tests/repositories/in-memory-sessions-repository";
import { InMemoryUsersRepository } from "../../../../../tests/repositories/in-memory-users-repository";
import { ResetPasswordWithTokenUseCase } from "./reset-password-with-token";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryTokensRepository: InMemoryPasswordResetTokensRepository;
let inMemorySessionsRepository: InMemorySessionsRepository;
let fakeTokenHasher: FakeTokenHasher;
let fakeHashGenerator: FakeHashGenerator;
let fakeEmailSender: FakeEmailSender;
let fakePasswordResetAuditLogger: FakePasswordResetAuditLogger;

let sut: ResetPasswordWithTokenUseCase;

describe("Reset password with token", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryTokensRepository = new InMemoryPasswordResetTokensRepository();
    inMemorySessionsRepository = new InMemorySessionsRepository();
    fakeTokenHasher = new FakeTokenHasher();
    fakeHashGenerator = new FakeHashGenerator();
    fakeEmailSender = new FakeEmailSender();
    fakePasswordResetAuditLogger = new FakePasswordResetAuditLogger();

    sut = new ResetPasswordWithTokenUseCase(
      inMemoryUsersRepository,
      inMemoryTokensRepository,
      inMemorySessionsRepository,
      fakeTokenHasher,
      fakeHashGenerator,
      fakeEmailSender,
      fakePasswordResetAuditLogger,
      "https://app.example.com/login",
    );
  });

  it("should reject when token is unknown", async () => {
    const result = await sut.execute({
      token: "unknown-token",
      newPassword: "new-secret",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result.isLeft()).toBe(true);
    if (result.isRight()) {
      throw new Error("expected left");
    }
    expect(result.value).toBeInstanceOf(
      InvalidOrExpiredPasswordResetTokenError,
    );
    expect(fakePasswordResetAuditLogger.entries).toEqual([
      {
        event: "password_reset.confirm_failed",
        outcome: "failure",
        reason: "invalid_or_expired_token",
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
    ]);
    expect(fakeEmailSender.sent).toHaveLength(0);
  });

  it("should reject when token is expired", async () => {
    const user = makeUser("CUSTOMER", {
      email: new Email("john@example.com"),
    });
    await inMemoryUsersRepository.create(user);

    const hashedToken = await fakeTokenHasher.hash("reset-token");
    const token = PasswordResetToken.create({
      userId: user.id,
      hashedToken,
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
    });
    await inMemoryTokensRepository.upsert(token);

    const result = await sut.execute({
      token: "reset-token",
      newPassword: "new-secret",
    });

    expect(result.isLeft()).toBe(true);
    expect(fakeEmailSender.sent).toHaveLength(0);
  });

  it("should update password, remove token, revoke sessions and send confirmation email", async () => {
    const user = makeUser("CUSTOMER", {
      email: new Email("john@example.com"),
      hashedPassword: "old-hashed",
    });
    await inMemoryUsersRepository.create(user);

    const hashedToken = await fakeTokenHasher.hash("reset-token");
    const token = PasswordResetToken.create({
      userId: user.id,
      hashedToken,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    await inMemoryTokensRepository.upsert(token);

    const session = Session.create({
      userId: user.id,
      refreshTokenHash: "refresh-hash",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    await inMemorySessionsRepository.create(session);

    const result = await sut.execute({
      token: "reset-token",
      newPassword: "new-secret",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) {
      throw result.value;
    }
    expect(result.value.user.hashedPassword).toBe("new-secret-hashed");
    expect(inMemoryTokensRepository.items).toHaveLength(0);
    expect(inMemorySessionsRepository.items[0]?.isRevoked()).toBe(true);
    expect(fakeEmailSender.sent).toHaveLength(1);
    expect(fakeEmailSender.sent[0]?.to).toBe("john@example.com");
    expect(fakeEmailSender.sent[0]?.subject).toBe("Sua senha foi alterada");
    expect(fakeEmailSender.sent[0]?.html).toContain(
      "https://app.example.com/login",
    );
    expect(fakePasswordResetAuditLogger.entries.at(-1)).toEqual({
      event: "password_reset.completed",
      outcome: "success",
      userId: user.id.toString(),
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });
  });

  it("should allow OAuth-only user to set a local password", async () => {
    const user = makeUser("CUSTOMER", {
      email: new Email("oauth@example.com"),
      hashedPassword: null,
      phone: null,
      address: null,
    });
    await inMemoryUsersRepository.create(user);

    const hashedToken = await fakeTokenHasher.hash("reset-token");
    const token = PasswordResetToken.create({
      userId: user.id,
      hashedToken,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    await inMemoryTokensRepository.upsert(token);

    const result = await sut.execute({
      token: "reset-token",
      newPassword: "first-local",
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) {
      throw result.value;
    }
    expect(result.value.user.hashedPassword).toBe("first-local-hashed");
    expect(fakeEmailSender.sent).toHaveLength(1);
  });
});
