import { makeUser } from "../../../../../tests/factories/user-factory";
import type { Env } from "../../../../infra/env/env";
import type { EnvService } from "../../../../infra/env/env.service";
import { FakeEmailSender } from "../../../../../tests/repositories/fake-email-sender";
import { FakePasswordResetAuditLogger } from "../../../../../tests/repositories/fake-password-reset-audit-logger";
import { FakeResetTokenGenerator } from "../../../../../tests/repositories/fake-reset-token-generator";
import { FakeTokenHasher } from "../../../../../tests/repositories/fake-token-hasher";
import { InMemoryPasswordResetTokensRepository } from "../../../../../tests/repositories/in-memory-password-reset-tokens-repository";
import { InMemoryUsersRepository } from "../../../../../tests/repositories/in-memory-users-repository";
import { Email } from "../../../accounts/domain/value-objects/email";
import { RequestPasswordResetUseCase } from "./request-password-reset";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryTokensRepository: InMemoryPasswordResetTokensRepository;
let fakeTokenHasher: FakeTokenHasher;
let fakeEmailSender: FakeEmailSender;
let fakeResetTokenGenerator: FakeResetTokenGenerator;
let fakePasswordResetAuditLogger: FakePasswordResetAuditLogger;

type EnvReader = {
  get<T extends keyof Env>(key: T): Env[T];
};

let envService: EnvReader;

let sut: RequestPasswordResetUseCase;

describe("Request password reset", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryTokensRepository = new InMemoryPasswordResetTokensRepository();
    fakeTokenHasher = new FakeTokenHasher();
    fakeEmailSender = new FakeEmailSender();
    fakeResetTokenGenerator = new FakeResetTokenGenerator();
    fakePasswordResetAuditLogger = new FakePasswordResetAuditLogger();
    envService = {
      get<T extends keyof Env>(key: T): Env[T] {
        if (key === "PASSWORD_RESET_PATH") {
          return "https://app.example.com/reset-password" as Env[T];
        }

        if (key === "EMAIL_LOGO_URL") {
          return "https://cdn.example.com/brand/logo.png" as Env[T];
        }

        if (key === "PASSWORD_RESET_TOKEN_TTL_IN_MS") {
          return 900_000 as Env[T];
        }

        throw new Error(`Unexpected env key requested: ${String(key)}`);
      },
    };

    sut = new RequestPasswordResetUseCase(
      inMemoryUsersRepository,
      inMemoryTokensRepository,
      fakeTokenHasher,
      fakeEmailSender,
      fakeResetTokenGenerator,
      fakePasswordResetAuditLogger,
      envService as EnvService,
    );
  });

  it("should not send email when user email is not registered", async () => {
    await sut.execute({
      email: "missing@example.com",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(inMemoryTokensRepository.items).toHaveLength(0);
    expect(fakeEmailSender.sent).toHaveLength(0);
    expect(fakePasswordResetAuditLogger.entries).toEqual([
      {
        event: "password_reset.requested",
        outcome: "success",
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      {
        event: "password_reset.requested",
        outcome: "skipped",
        reason: "user_not_found",
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
    ]);
  });

  it("should store hashed token and send reset link by email", async () => {
    const user = makeUser("CUSTOMER", {
      email: new Email("john@example.com"),
    });
    await inMemoryUsersRepository.create(user);

    await sut.execute({
      email: "john@example.com",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(fakeEmailSender.sent).toHaveLength(1);
    expect(fakeEmailSender.sent[0]?.to).toBe("john@example.com");
    expect(fakeEmailSender.sent[0]?.html).toContain("reset-token-plain");
    expect(inMemoryTokensRepository.items).toHaveLength(1);
    const token = inMemoryTokensRepository.items[0];
    expect(token?.hashedToken).toBe("reset-token-plain-token-hashed");
    expect(token?.userId.equals(user.id)).toBe(true);
    expect(fakePasswordResetAuditLogger.entries.at(-1)).toEqual({
      event: "password_reset.token_issued",
      outcome: "success",
      userId: user.id.toString(),
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });
  });

  it("should replace previous token when requesting again", async () => {
    const user = makeUser("CUSTOMER", {
      email: new Email("john@example.com"),
    });
    await inMemoryUsersRepository.create(user);

    await sut.execute({ email: "john@example.com" });
    const firstId = inMemoryTokensRepository.items[0]?.id.toString();

    await sut.execute({ email: "john@example.com" });

    expect(inMemoryTokensRepository.items).toHaveLength(1);
    expect(inMemoryTokensRepository.items[0]?.id.toString()).not.toBe(firstId);
  });
});
