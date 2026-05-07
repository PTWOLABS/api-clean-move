import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  getHttpServer,
  loginUser,
  makeCustomerAccessToken,
  makeEstablishmentAccessToken,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

const employeeFeatureSchema = z.enum([
  "read:appointments",
  "read:services",
  "read:customers",
  "read:employees:self",
  "create:sessions:self",
  "read:sessions:self",
  "create:appointments",
  "create:services",
  "create:customers",
  "update:appointments",
  "update:services",
  "update:customers",
  "delete:appointments",
  "delete:services",
  "delete:customers",
  "update:employees:self",
]);

const employeeSchema = z.object({
  id: z.uuid(),
  establishmentId: z.uuid(),
  userId: z.uuid(),
  profileImageUrl: z.string().nullable(),
  name: z.string(),
  cpf: z.string().nullable(),
  birthDate: z.string().nullable(),
  features: z.array(employeeFeatureSchema),
  deletedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

const employeeResponseSchema = z.object({
  employee: employeeSchema,
});

const listEmployeesResponseSchema = z.object({
  employees: z.array(employeeSchema),
});

function employeePayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Ana Silva",
    email: `employee-${randomUUID()}@example.com`,
    password: "strong-password",
    birthDate: "1995-01-01T00:00:00.000Z",
    extraFeatures: ["update:employees:self"],
    ...overrides,
  };
}

async function createEmployee(accessToken: string, app: INestApplication) {
  const response = await request(getHttpServer(app))
    .post("/employees")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(employeePayload());

  expect(response.status).toBe(201);
  return employeeResponseSchema.parse(response.body).employee;
}

describe("Manage employees controller (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userFactory: UserFactory;
  let establishmentFactory: EstablishmentFactory;
  let envService: EnvService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get(PrismaService);
    userFactory = new UserFactory(prisma, moduleRef.get(HashGenerator));
    establishmentFactory = new EstablishmentFactory(prisma);
    envService = moduleRef.get(EnvService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should get, list, update, and soft-delete employees as establishment", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const ana = await createEmployee(accessToken, app);
    const biaResponse = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        employeePayload({
          name: "Beatriz Souza",
          email: `beatriz-${randomUUID()}@example.com`,
          extraFeatures: [],
        }),
      );
    const bia = employeeResponseSchema.parse(biaResponse.body).employee;

    const getResponse = await request(getHttpServer(app))
      .get(`/employees/${ana.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const listResponse = await request(getHttpServer(app))
      .get("/employees")
      .query({ name: "bea" })
      .set("Authorization", `Bearer ${accessToken}`);
    const updateResponse = await request(getHttpServer(app))
      .patch(`/employees/${ana.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Ana Updated",
        birthDate: null,
        extraFeatures: ["create:appointments"],
      });
    const deleteResponse = await request(getHttpServer(app))
      .delete(`/employees/${ana.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const afterDeleteGetResponse = await request(getHttpServer(app))
      .get(`/employees/${ana.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const deletedEmployee = await prisma.employee.findUnique({
      where: { id: ana.id },
    });

    expect(getResponse.status).toBe(200);
    expect(employeeResponseSchema.parse(getResponse.body).employee.id).toBe(
      ana.id,
    );
    expect(listResponse.status).toBe(200);
    expect(
      listEmployeesResponseSchema.parse(listResponse.body).employees,
    ).toEqual([expect.objectContaining({ id: bia.id, name: "Beatriz Souza" })]);
    expect(updateResponse.status).toBe(200);
    const updatedEmployee = employeeResponseSchema.parse(
      updateResponse.body,
    ).employee;
    expect(updatedEmployee).toEqual(
      expect.objectContaining({
        id: ana.id,
        name: "Ana Updated",
        birthDate: null,
      }),
    );
    expect(updatedEmployee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
      "create:appointments",
    ]);
    expect(deleteResponse.status).toBe(204);
    expect(deletedEmployee?.deletedAt).toBeInstanceOf(Date);
    expect(deletedEmployee?.features).not.toContain("create:sessions:self");
    expect(deletedEmployee?.features).not.toContain("read:sessions:self");
    expect(afterDeleteGetResponse.status).toBe(404);
  });

  it("should allow employee self get and self update without feature updates", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const employee = await createEmployee(accessToken, app);
    const employeeUser = await prisma.user.findUniqueOrThrow({
      where: { id: employee.userId },
    });
    const login = await loginUser({
      app,
      prisma,
      userId: employee.userId,
      email: employeeUser.email,
      password: "strong-password",
    });

    const getResponse = await request(getHttpServer(app))
      .get(`/employees/${employee.id}`)
      .set("Authorization", `Bearer ${login.loginBody.accessToken}`);
    const updateResponse = await request(getHttpServer(app))
      .patch(`/employees/${employee.id}`)
      .set("Authorization", `Bearer ${login.loginBody.accessToken}`)
      .send({ name: "Self Updated" });
    const featureUpdateResponse = await request(getHttpServer(app))
      .patch(`/employees/${employee.id}`)
      .set("Authorization", `Bearer ${login.loginBody.accessToken}`)
      .send({ extraFeatures: ["delete:customers"] });
    const persistedEmployeeAfterForbiddenUpdate =
      await prisma.employee.findUniqueOrThrow({
        where: { id: employee.id },
      });

    expect(getResponse.status).toBe(200);
    expect(updateResponse.status).toBe(200);
    expect(
      employeeResponseSchema.parse(updateResponse.body).employee.name,
    ).toBe("Self Updated");
    expect(featureUpdateResponse.status).toBe(403);
    expect(persistedEmployeeAfterForbiddenUpdate.features).toContain(
      "update:employees:self",
    );
    expect(persistedEmployeeAfterForbiddenUpdate.features).not.toContain(
      "delete:customers",
    );
  });

  it("should block employee requests after delete", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const employee = await createEmployee(accessToken, app);
    const employeeUser = await prisma.user.findUniqueOrThrow({
      where: { id: employee.userId },
    });
    const login = await loginUser({
      app,
      prisma,
      userId: employee.userId,
      email: employeeUser.email,
      password: "strong-password",
    });

    const deleteResponse = await request(getHttpServer(app))
      .delete(`/employees/${employee.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const blockedGetResponse = await request(getHttpServer(app))
      .get(`/employees/${employee.id}`)
      .set("Authorization", `Bearer ${login.loginBody.accessToken}`);
    const blockedLoginResponse = await request(getHttpServer(app))
      .post("/auth/login")
      .send({ email: employeeUser.email, password: "strong-password" });

    expect(deleteResponse.status).toBe(204);
    expect(blockedGetResponse.status).toBe(401);
    expect(blockedLoginResponse.status).toBe(400);
  });

  it("should enforce roles and establishment ownership", async () => {
    const firstOwner = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const secondOwner = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const customer = await makeCustomerAccessToken({
      app,
      prisma,
      userFactory,
    });
    const employee = await createEmployee(firstOwner.accessToken, app);

    const customerListResponse = await request(getHttpServer(app))
      .get("/employees")
      .set("Authorization", `Bearer ${customer.accessToken}`);
    const crossGetResponse = await request(getHttpServer(app))
      .get(`/employees/${employee.id}`)
      .set("Authorization", `Bearer ${secondOwner.accessToken}`);
    const invalidUuidResponse = await request(getHttpServer(app))
      .get("/employees/not-a-uuid")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`);

    expect(customerListResponse.status).toBe(403);
    expect(crossGetResponse.status).toBe(404);
    expect(invalidUuidResponse.status).toBe(400);
  });
});
