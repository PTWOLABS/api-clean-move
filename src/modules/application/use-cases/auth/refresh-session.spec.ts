import { JwtService } from "@nestjs/jwt";
import type { Env } from "../../../../infra/env/env";
import type { EnvService } from "../../../../infra/env/env.service";
import { AuthService } from "../../../../infra/auth/auth.service";
import { InvalidSessionError } from "../../../../shared/errors/invalid-session-error";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { SessionCreationService } from "../../../accounts/domain/services/session-creation-service";
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { Employee } from "../../../employees/domain/entities/employee";
import { FakeTokenHasher } from "../../../../../tests/repositories/fake-token-hasher";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemorySessionsRepository } from "../../../../../tests/repositories/in-memory-sessions-repository";
import { InMemoryUsersRepository } from "../../../../../tests/repositories/in-memory-users-repository";
import { EmployeeSessionAccessService } from "../../services/employee-session-access";
import { RefreshSessionUseCase } from "./refresh-session";

const refreshTokenTtlInMs = 1_296_000_000;

type EnvReader = {
  get<T extends keyof Env>(key: T): Env[T];
};

describe("RefreshSessionUseCase", () => {
  let inMemoryUsersRepository: InMemoryUsersRepository;
  let inMemorySessionsRepository: InMemorySessionsRepository;
  let inMemoryEmployeesRepository: InMemoryEmployeesRepository;
  let fakeTokenHasher: FakeTokenHasher;
  let sessionCreationService: SessionCreationService;
  let envService: EnvReader;
  let authService: AuthService;
  let employeeSessionAccessService: EmployeeSessionAccessService;
  let sut: RefreshSessionUseCase;

  beforeEach(() => {
    inMemoryUsersRepository = new InMemoryUsersRepository();
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

    sut = new RefreshSessionUseCase(
      authService,
      envService as EnvService,
      inMemorySessionsRepository,
      inMemoryUsersRepository,
      fakeTokenHasher,
      employeeSessionAccessService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function makeRefreshableUserSession(role: "CUSTOMER" | "EMPLOYEE") {
    const user = makeUser(role);
    const sessionId = new UniqueEntityId();
    const refreshToken = await authService.generateRefreshToken({
      sub: user.id.toString(),
      sid: sessionId.toString(),
    });
    const refreshTokenHash = await fakeTokenHasher.hash(refreshToken);
    const session = sessionCreationService.execute({
      id: sessionId,
      userId: user.id,
      refreshTokenHash,
      ttlInMs: refreshTokenTtlInMs,
      referenceDate: new Date("2026-04-17T12:00:00.000Z"),
    });

    await inMemoryUsersRepository.create(user);
    await inMemorySessionsRepository.create(session);

    return {
      refreshToken,
      session,
      user,
    };
  }

  it("should rotate the refresh token and issue a new access token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:30:00.000Z"));

    const user = makeUser("CUSTOMER");
    const sessionId = new UniqueEntityId();
    const initialRefreshToken = await authService.generateRefreshToken({
      sub: user.id.toString(),
      sid: sessionId.toString(),
    });
    const initialRefreshTokenHash =
      await fakeTokenHasher.hash(initialRefreshToken);
    const session = sessionCreationService.execute({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: initialRefreshTokenHash,
      ttlInMs: refreshTokenTtlInMs,
      referenceDate: new Date("2026-04-17T12:00:00.000Z"),
    });

    await inMemoryUsersRepository.create(user);
    await inMemorySessionsRepository.create(session);

    const result = await sut.execute({
      refreshToken: initialRefreshToken,
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.user).toBe(user);
    expect(result.value.session).toBe(session);
    expect(result.value.refreshToken).toEqual(expect.any(String));
    expect(result.value.refreshToken).not.toBe(initialRefreshToken);
    expect(result.value.accessToken).toEqual(expect.any(String));
    expect(session.refreshTokenHash).toBe(
      `${result.value.refreshToken}-token-hashed`,
    );
    expect(session.lastUsedAt).not.toBeNull();

    const accessPayload = await new JwtService({
      secret: "test-access-secret",
    }).verifyAsync<{
      sub: string;
      sid: string;
      role: string;
      type: "access";
    }>(result.value.accessToken);

    expect(accessPayload.sub).toBe(user.id.toString());
    expect(accessPayload.sid).toBe(session.id.toString());
    expect(accessPayload.role).toBe("CUSTOMER");
    expect(accessPayload.type).toBe("access");

    const staleRefreshAttempt = await sut.execute({
      refreshToken: initialRefreshToken,
    });

    expect(staleRefreshAttempt.isLeft()).toBe(true);
    expect(staleRefreshAttempt.value).toBeInstanceOf(InvalidSessionError);
  });

  it("should reject an invalid refresh token", async () => {
    const result = await sut.execute({
      refreshToken: "invalid-refresh-token",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidSessionError);
  });

  it("should reject employee refresh without read sessions feature", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:30:00.000Z"));

    const { refreshToken, session, user } =
      await makeRefreshableUserSession("EMPLOYEE");
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
        "create:sessions:self",
      ],
      deletedAt: null,
      createdAt: new Date("2026-05-05T10:00:00.000Z"),
      updatedAt: new Date("2026-05-05T10:00:00.000Z"),
    });
    await inMemoryEmployeesRepository.create(employee);

    const result = await sut.execute({ refreshToken });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidSessionError);
    expect(inMemorySessionsRepository.items[0]?.refreshTokenHash).toBe(
      session.refreshTokenHash,
    );
  });

  it("should allow employee refresh with read sessions feature", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:30:00.000Z"));

    const { refreshToken, user } = await makeRefreshableUserSession("EMPLOYEE");
    await inMemoryEmployeesRepository.create(
      makeEmployee({
        userId: user.id,
        name: user.name,
      }),
    );

    const result = await sut.execute({ refreshToken });

    expect(result.isRight()).toBe(true);
  });
});
