import { JwtService } from "@nestjs/jwt";
import { AuthService } from "../../../infra/auth/auth.service";
import type { Env } from "../../../infra/env/env";
import type { EnvService } from "../../../infra/env/env.service";
import { UniqueEntityId } from "../../../shared/entities/unique-entity-id";
import { Email } from "../../accounts/domain/value-objects/email";
import { SessionCreationService } from "../../accounts/domain/services/session-creation-service";
import { InvalidCredentialsError } from "../../../shared/errors/invalid-credentials-error";
import { makeEmployee } from "../../../../tests/factories/employee-factory";
import { makeUser } from "../../../../tests/factories/user-factory";
import { Employee } from "../../employees/domain/entities/employee";
import { FakeTokenHasher } from "../../../../tests/repositories/fake-token-hasher";
import { InMemoryEmployeesRepository } from "../../../../tests/repositories/in-memory-employees-repository";
import { InMemorySessionsRepository } from "../../../../tests/repositories/in-memory-sessions-repository";
import { EmployeeSessionAccessService } from "./employee-session-access";
import { AuthSessionService } from "./auth-session.service";

const refreshTokenTtlInMs = 1_296_000_000;

type EnvReader = {
  get<T extends keyof Env>(key: T): Env[T];
};

describe("AuthSessionService", () => {
  let inMemorySessionsRepository: InMemorySessionsRepository;
  let inMemoryEmployeesRepository: InMemoryEmployeesRepository;
  let fakeTokenHasher: FakeTokenHasher;
  let sessionCreationService: SessionCreationService;
  let envService: EnvReader;
  let authService: AuthService;
  let employeeSessionAccessService: EmployeeSessionAccessService;
  let sut: AuthSessionService;

  beforeEach(() => {
    inMemorySessionsRepository = new InMemorySessionsRepository();
    inMemoryEmployeesRepository = new InMemoryEmployeesRepository();
    fakeTokenHasher = new FakeTokenHasher();
    sessionCreationService = new SessionCreationService();
    employeeSessionAccessService = new EmployeeSessionAccessService(
      inMemoryEmployeesRepository,
    );
    envService = {
      get<T extends keyof Env>(key: T): Env[T] {
        if (key === "REFRESH_TOKEN_TTL_IN_MS") {
          return refreshTokenTtlInMs as Env[T];
        }

        if (key === "JWT_REFRESH_SECRET") {
          return "test-refresh-secret-with-at-least-thirty-two-characters" as Env[T];
        }

        throw new Error(`Unexpected env key requested: ${String(key)}`);
      },
    };
    authService = new AuthService(
      new JwtService({ secret: "test-access-secret" }),
      envService as EnvService,
    );

    sut = new AuthSessionService(
      inMemorySessionsRepository,
      fakeTokenHasher,
      sessionCreationService,
      envService as EnvService,
      authService,
      employeeSessionAccessService,
    );
  });

  it("should create a session with refresh and access tokens", async () => {
    const user = makeUser("CUSTOMER", {
      email: new Email("john@example.com"),
    });

    const result = await sut.create({
      user,
      userAgent: "  Mozilla/5.0  ",
      ipAddress: "  127.0.0.1  ",
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.refreshToken).toEqual(expect.any(String));
    expect(result.value.accessToken).toEqual(expect.any(String));
    expect(inMemorySessionsRepository.items).toHaveLength(1);

    const createdSession = inMemorySessionsRepository.items[0];

    expect(createdSession).toBeDefined();

    if (!createdSession) {
      throw new Error("Expected created session.");
    }

    expect(result.value.session).toBe(createdSession);
    expect(createdSession.userId.equals(user.id)).toBe(true);
    expect(createdSession.refreshTokenHash).toBe(
      `${result.value.refreshToken}-token-hashed`,
    );
    expect(createdSession.userAgent).toBe("Mozilla/5.0");
    expect(createdSession.ipAddress).toBe("127.0.0.1");
    expect(
      createdSession.expiresAt.getTime() - createdSession.createdAt.getTime(),
    ).toBe(refreshTokenTtlInMs);
  });

  it("should generate an access token bound to the created session", async () => {
    const user = makeUser("ESTABLISHMENT", {
      email: new Email("john@example.com"),
    });

    const result = await sut.create({ user });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    const payload = await new JwtService({
      secret: "test-access-secret",
    }).verifyAsync<{
      sub: string;
      role: string;
      sid: string;
    }>(result.value.accessToken);

    expect(payload.sub).toBe(user.id.toString());
    expect(payload.role).toBe("ESTABLISHMENT");
    expect(payload.sid).toBe(result.value.session.id.toString());
  });

  it("should reject employee session creation without create sessions feature", async () => {
    const user = makeUser("EMPLOYEE", {
      email: new Email("blocked.employee@example.com"),
    });
    const employee = Employee.restore({
      establishmentId: new UniqueEntityId(),
      userId: user.id,
      profileImageUrl: null,
      name: user.name,
      cpf: null,
      birthDate: null,
      features: [
        "read:appointments",
        "read:services",
        "read:customers",
        "read:employees:self",
        "read:sessions:self",
        "update:employees:self",
      ],
      deletedAt: null,
      createdAt: new Date("2026-05-05T10:00:00.000Z"),
      updatedAt: new Date("2026-05-05T10:00:00.000Z"),
    });
    await inMemoryEmployeesRepository.create(employee);

    const result = await sut.create({ user });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidCredentialsError);
    expect(inMemorySessionsRepository.items).toHaveLength(0);
  });

  it("should allow employee session creation with create sessions feature", async () => {
    const user = makeUser("EMPLOYEE", {
      email: new Email("active.employee@example.com"),
    });
    await inMemoryEmployeesRepository.create(
      makeEmployee({
        userId: user.id,
        name: user.name,
      }),
    );

    const result = await sut.create({ user });

    expect(result.isRight()).toBe(true);
    expect(inMemorySessionsRepository.items).toHaveLength(1);
  });

  it("should create a session with null metadata when request does not provide it", async () => {
    const user = makeUser("CUSTOMER", {
      email: new Email("john@example.com"),
    });

    const result = await sut.create({ user });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.session.userAgent).toBeNull();
    expect(result.value.session.ipAddress).toBeNull();
  });
});
