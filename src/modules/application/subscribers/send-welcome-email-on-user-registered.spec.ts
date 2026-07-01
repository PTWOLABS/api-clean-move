import type { Env } from "../../../infra/env/env";
import type { EnvService } from "../../../infra/env/env.service";
import { User } from "../../accounts/domain/entities/user";
import { UserRegisteredEvent } from "../../accounts/domain/events/user-registered-event";
import { Email } from "../../accounts/domain/value-objects/email";
import { FakeEmailSender } from "../../../../tests/repositories/fake-email-sender";
import { InMemoryUnitOfWork } from "../../../../tests/repositories/in-memory-unit-of-work";
import { InMemoryUsersRepository } from "../../../../tests/repositories/in-memory-users-repository";
import { SendWelcomeEmailOnUserRegistered } from "./send-welcome-email-on-user-registered";

let inMemoryUsersRepository: InMemoryUsersRepository;
let inMemoryUnitOfWork: InMemoryUnitOfWork;
let fakeEmailSender: FakeEmailSender;

type EnvReader = {
  get<T extends keyof Env>(key: T): Env[T];
};

let envService: EnvReader;
let sut: SendWelcomeEmailOnUserRegistered;

describe("Send welcome email on user registered", () => {
  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
    inMemoryUnitOfWork = new InMemoryUnitOfWork();
    fakeEmailSender = new FakeEmailSender();
    envService = {
      get<T extends keyof Env>(key: T): Env[T] {
        if (key === "FRONTEND_URL") {
          return "https://app.example.com" as Env[T];
        }

        if (key === "EMAIL_LOGO_URL") {
          return "https://cdn.example.com/brand/logo.png" as Env[T];
        }

        throw new Error(`Unexpected env key requested: ${String(key)}`);
      },
    };

    sut = new SendWelcomeEmailOnUserRegistered(
      inMemoryUsersRepository,
      fakeEmailSender,
      envService as EnvService,
    );
  });

  afterEach(() => {
    sut.onModuleDestroy();
  });

  it("should send welcome email after customer registration", async () => {
    await inMemoryUnitOfWork.execute(async () => {
      const user = User.register({
        name: "Maria Silva",
        email: new Email("maria@example.com"),
        hashedPassword: "hashed-password",
        role: "CUSTOMER",
        phone: null,
        address: null,
      });

      await inMemoryUsersRepository.create(user);
    });

    expect(fakeEmailSender.sent).toHaveLength(1);
    expect(fakeEmailSender.sent[0]?.to).toBe("maria@example.com");
    expect(fakeEmailSender.sent[0]?.subject).toBe("Bem-vindo(a) à Clean Move");
    expect(fakeEmailSender.sent[0]?.html).toContain("Olá, Maria");
    expect(fakeEmailSender.sent[0]?.html).toContain(
      "https://app.example.com/login",
    );
  });

  it("should not send welcome email for employee registration", async () => {
    await inMemoryUnitOfWork.execute(async () => {
      const user = User.register({
        name: "Employee User",
        email: new Email("employee@example.com"),
        hashedPassword: "hashed-password",
        role: "EMPLOYEE",
        phone: null,
        address: null,
      });

      await inMemoryUsersRepository.create(user);
    });

    expect(fakeEmailSender.sent).toHaveLength(0);
  });

  it("should not send email when user is not found", async () => {
    const user = User.register({
      name: "Missing User",
      email: new Email("missing@example.com"),
      hashedPassword: "hashed-password",
      role: "CUSTOMER",
      phone: null,
      address: null,
    });

    await (
      sut as unknown as {
        sendWelcomeEmail: (event: UserRegisteredEvent) => Promise<void>;
      }
    ).sendWelcomeEmail(new UserRegisteredEvent(user));

    expect(fakeEmailSender.sent).toHaveLength(0);
  });
});
