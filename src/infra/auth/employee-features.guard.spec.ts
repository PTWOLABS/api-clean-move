import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { makeEmployee } from "../../../tests/factories/employee-factory";
import { InMemoryEmployeesRepository } from "../../../tests/repositories/in-memory-employees-repository";
import { Employee } from "../../modules/employees/domain/entities/employee";
import { EmployeeFeature } from "../../modules/employees/domain/policies/employee-features-policy";
import { UniqueEntityId } from "../../shared/entities/unique-entity-id";
import { AuthenticatedRequest } from "./authenticated-user";
import { EmployeeFeatures } from "./employee-features";
import { EmployeeFeaturesGuard } from "./employee-features.guard";

describe("EmployeeFeaturesGuard", () => {
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let employeesRepository: InMemoryEmployeesRepository;
  let sut: EmployeeFeaturesGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: vi.fn(),
    };
    employeesRepository = new InMemoryEmployeesRepository();
    sut = new EmployeeFeaturesGuard(
      reflector as unknown as Reflector,
      employeesRepository,
    );
  });

  it("should allow requests without required employee features", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(sut.canActivate(makeContext())).resolves.toBe(true);
  });

  it("should read feature metadata from handler and class", async () => {
    const requiredFeatures: EmployeeFeature[] = ["update:employees:self"];
    reflector.getAllAndOverride.mockReturnValue(requiredFeatures);
    const { context, handler, controller } = makeContextParts({
      userId: new UniqueEntityId().toString(),
      sessionId: new UniqueEntityId().toString(),
      role: "CUSTOMER",
    });

    await sut.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(EmployeeFeatures, [
      handler,
      controller,
    ]);
  });

  it("should reject requests with required features and no authenticated user", async () => {
    reflector.getAllAndOverride.mockReturnValue(["update:employees:self"]);

    await expect(sut.canActivate(makeContext())).resolves.toBe(false);
  });

  it("should allow non-employee actors with required features", async () => {
    reflector.getAllAndOverride.mockReturnValue(["update:employees:self"]);

    await expect(
      sut.canActivate(
        makeContext({
          userId: new UniqueEntityId().toString(),
          sessionId: new UniqueEntityId().toString(),
          role: "ESTABLISHMENT",
        }),
      ),
    ).resolves.toBe(true);
  });

  it("should reject employee actors without employee record", async () => {
    const userId = new UniqueEntityId();
    reflector.getAllAndOverride.mockReturnValue(["update:employees:self"]);

    await expect(
      sut.canActivate(
        makeContext({
          userId: userId.toString(),
          sessionId: new UniqueEntityId().toString(),
          role: "EMPLOYEE",
        }),
      ),
    ).resolves.toBe(false);
  });

  it("should reject deleted employees", async () => {
    const userId = new UniqueEntityId();
    const employee = makeEmployee({ userId });
    employee.softDelete(new Date("2026-05-05T10:00:00.000Z"));
    await employeesRepository.create(employee);
    reflector.getAllAndOverride.mockReturnValue(["update:employees:self"]);

    await expect(
      sut.canActivate(
        makeContext({
          userId: userId.toString(),
          sessionId: new UniqueEntityId().toString(),
          role: "EMPLOYEE",
        }),
      ),
    ).resolves.toBe(false);
  });

  it("should reject employees without every required feature", async () => {
    const userId = new UniqueEntityId();
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
          "read:sessions:self",
        ],
        deletedAt: null,
        createdAt: new Date("2026-05-05T10:00:00.000Z"),
        updatedAt: new Date("2026-05-05T10:00:00.000Z"),
      }),
    );
    reflector.getAllAndOverride.mockReturnValue(["update:employees:self"]);

    await expect(
      sut.canActivate(
        makeContext({
          userId: userId.toString(),
          sessionId: new UniqueEntityId().toString(),
          role: "EMPLOYEE",
        }),
      ),
    ).resolves.toBe(false);
  });

  it("should allow employees with every required feature", async () => {
    const userId = new UniqueEntityId();
    await employeesRepository.create(
      makeEmployee({
        userId,
        extraFeatures: ["update:employees:self", "delete:customers"],
      }),
    );
    reflector.getAllAndOverride.mockReturnValue([
      "update:employees:self",
      "delete:customers",
    ]);

    await expect(
      sut.canActivate(
        makeContext({
          userId: userId.toString(),
          sessionId: new UniqueEntityId().toString(),
          role: "EMPLOYEE",
        }),
      ),
    ).resolves.toBe(true);
  });
});

function makeContext(user?: AuthenticatedRequest["user"]) {
  return makeContextParts(user).context;
}

function makeContextParts(user?: AuthenticatedRequest["user"]) {
  const request: AuthenticatedRequest = {
    headers: {},
    ...(user ? { user } : {}),
  };
  const handler = vi.fn();
  const controller = vi.fn();
  const context = {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  return {
    context,
    controller,
    handler,
  };
}
