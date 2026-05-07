import { UnauthorizedException } from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { makeEmployee } from "../../../tests/factories/employee-factory";
import { InMemoryEmployeesRepository } from "../../../tests/repositories/in-memory-employees-repository";
import { InMemorySessionsRepository } from "../../../tests/repositories/in-memory-sessions-repository";
import { Session } from "../../modules/accounts/domain/entities/session";
import { Employee } from "../../modules/employees/domain/entities/employee";
import { UniqueEntityId } from "../../shared/entities/unique-entity-id";
import { EmployeeSessionAccessService } from "../../modules/application/services/employee-session-access";
import { AuthenticatedRequest } from "./authenticated-user";
import { AuthService } from "./auth.service";
import { AccessSessionGuard } from "./access-session.guard";

describe("AccessSessionGuard", () => {
  let authService: { verifyAccessToken: ReturnType<typeof vi.fn> };
  let sessionsRepository: InMemorySessionsRepository;
  let employeesRepository: InMemoryEmployeesRepository;
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let employeeSessionAccessService: EmployeeSessionAccessService;
  let sut: AccessSessionGuard;

  beforeEach(() => {
    authService = {
      verifyAccessToken: vi.fn(),
    };
    sessionsRepository = new InMemorySessionsRepository();
    employeesRepository = new InMemoryEmployeesRepository();
    reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    };
    employeeSessionAccessService = new EmployeeSessionAccessService(
      employeesRepository,
    );
    sut = new AccessSessionGuard(
      authService as unknown as AuthService,
      sessionsRepository,
      reflector as unknown as Reflector,
      employeeSessionAccessService,
    );
  });

  it("should allow non-employee authenticated requests", async () => {
    const userId = new UniqueEntityId();
    const session = await createSession(userId);
    const request = makeRequest();
    authService.verifyAccessToken.mockResolvedValue({
      sub: userId.toString(),
      sid: session.id.toString(),
      role: "CUSTOMER",
      type: "access",
    });

    const result = await sut.canActivate(makeContext(request));

    expect(result).toBe(true);
    expect(request.user).toEqual({
      userId: userId.toString(),
      sessionId: session.id.toString(),
      role: "CUSTOMER",
    });
  });

  it("should block employee requests without employee record", async () => {
    const userId = new UniqueEntityId();
    const session = await createSession(userId);
    const request = makeRequest();
    authService.verifyAccessToken.mockResolvedValue({
      sub: userId.toString(),
      sid: session.id.toString(),
      role: "EMPLOYEE",
      type: "access",
    });

    await expect(sut.canActivate(makeContext(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should block deleted employee requests", async () => {
    const userId = new UniqueEntityId();
    const session = await createSession(userId);
    const employee = makeEmployee({ userId });
    employee.softDelete(new Date("2026-05-05T10:00:00.000Z"));
    await employeesRepository.create(employee);
    const request = makeRequest();
    authService.verifyAccessToken.mockResolvedValue({
      sub: userId.toString(),
      sid: session.id.toString(),
      role: "EMPLOYEE",
      type: "access",
    });

    await expect(sut.canActivate(makeContext(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should block employee requests without read sessions feature", async () => {
    const userId = new UniqueEntityId();
    const session = await createSession(userId);
    await employeesRepository.create(
      Employee.restore({
        establishmentId: new UniqueEntityId(),
        userId,
        profileImageUrl: null,
        name: "Ana Silva",
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
      }),
    );
    const request = makeRequest();
    authService.verifyAccessToken.mockResolvedValue({
      sub: userId.toString(),
      sid: session.id.toString(),
      role: "EMPLOYEE",
      type: "access",
    });

    await expect(sut.canActivate(makeContext(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should allow employee requests with read sessions feature", async () => {
    const userId = new UniqueEntityId();
    const session = await createSession(userId);
    await employeesRepository.create(makeEmployee({ userId }));
    const request = makeRequest();
    authService.verifyAccessToken.mockResolvedValue({
      sub: userId.toString(),
      sid: session.id.toString(),
      role: "EMPLOYEE",
      type: "access",
    });

    const result = await sut.canActivate(makeContext(request));

    expect(result).toBe(true);
    expect(request.user?.role).toBe("EMPLOYEE");
  });

  async function createSession(userId: UniqueEntityId) {
    const session = Session.create({
      userId,
      refreshTokenHash: "refresh-token-hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    await sessionsRepository.create(session);

    return session;
  }
});

function makeRequest(): AuthenticatedRequest {
  return {
    headers: {
      authorization: "Bearer access-token",
    },
  };
}

function makeContext(request: AuthenticatedRequest): ExecutionContext {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}
