import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  getHttpServer,
  makeCustomerAccessToken,
  makeEstablishmentAccessToken,
  makeEstablishmentUserWithoutProfileAccessToken,
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

const employeeResponseSchema = z.object({
  employee: z.object({
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
  }),
});

function validEmployeePayload() {
  return {
    name: "Ana Silva",
    email: "ana.employee@example.com",
    password: "strong-password",
    cpf: "529.982.247-25",
    birthDate: "1995-01-01T00:00:00.000Z",
    extraFeatures: ["create:appointments", "update:customers"],
  };
}

function minorBirthDateIso() {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - 10);
  date.setUTCHours(0, 0, 0, 0);

  return date.toISOString();
}

describe("Register employee controller (e2e)", () => {
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

  it("should register an employee with required fields", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Ana Silva",
        email: "ana.required@example.com",
        password: "strong-password",
      });
    const body = employeeResponseSchema.parse(response.body);

    expect(response.status).toBe(201);
    expect(body.employee.establishmentId).toBe(establishment.id.toString());
    expect(body.employee.name).toBe("Ana Silva");
    expect(body.employee.cpf).toBeNull();
    expect(body.employee.birthDate).toBeNull();
    expect(body.employee.profileImageUrl).toBeNull();
    expect(body.employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
    ]);
    expect(body.employee.deletedAt).toBeNull();

    const user = await prisma.user.findUnique({
      where: {
        id: body.employee.userId,
      },
    });
    const employee = await prisma.employee.findUnique({
      where: {
        id: body.employee.id,
      },
    });

    expect(user?.role).toBe("EMPLOYEE");
    expect(user?.email).toBe("ana.required@example.com");
    expect(user?.hashedPassword).not.toBe("strong-password");
    expect(employee?.establishmentId).toBe(establishment.id.toString());
    expect(employee?.profileImageUrl).toBeNull();
  });

  it("should register an employee with optional fields and extra features", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validEmployeePayload());
    const body = employeeResponseSchema.parse(response.body);

    expect(response.status).toBe(201);
    expect(body.employee.establishmentId).toBe(establishment.id.toString());
    expect(body.employee.cpf).toBe("52998224725");
    expect(body.employee.birthDate).toBe("1995-01-01T00:00:00.000Z");
    expect(body.employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
      "create:appointments",
      "update:customers",
    ]);
    expect(body.employee.deletedAt).toBeNull();
  });

  it("should enforce authentication and establishment role", async () => {
    const { expiredAccessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const customerRole = await makeCustomerAccessToken({
      app,
      prisma,
      userFactory,
    });

    const noTokenResponse = await request(getHttpServer(app))
      .post("/employees")
      .send(validEmployeePayload());
    const invalidTokenResponse = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", "Bearer invalid-token")
      .send(validEmployeePayload());
    const expiredTokenResponse = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", `Bearer ${expiredAccessToken}`)
      .send(validEmployeePayload());
    const customerRoleResponse = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", `Bearer ${customerRole.accessToken}`)
      .send(validEmployeePayload());

    expect(noTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.status).toBe(401);
    expect(expiredTokenResponse.status).toBe(401);
    expect(customerRoleResponse.status).toBe(403);
  });

  it("should reject invalid employee payloads", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const invalidPayloads = [
      {
        name: "missing name",
        payload: {
          email: "missing-name@example.com",
          password: "strong-password",
        },
      },
      {
        name: "invalid email",
        payload: {
          ...validEmployeePayload(),
          email: "invalid-email",
        },
      },
      {
        name: "invalid cpf",
        payload: {
          ...validEmployeePayload(),
          email: "invalid-cpf@example.com",
          cpf: "11111111111",
        },
      },
      {
        name: "birth date before 1900",
        payload: {
          ...validEmployeePayload(),
          email: "old-birth-date@example.com",
          birthDate: "1899-12-31T00:00:00.000Z",
        },
      },
      {
        name: "future birth date",
        payload: {
          ...validEmployeePayload(),
          email: "future-birth-date@example.com",
          birthDate: "2999-01-01T00:00:00.000Z",
        },
      },
      {
        name: "minor birth date",
        payload: {
          ...validEmployeePayload(),
          email: "minor-birth-date@example.com",
          birthDate: minorBirthDateIso(),
        },
      },
      {
        name: "birth date as number",
        payload: {
          ...validEmployeePayload(),
          email: "number-birth-date@example.com",
          birthDate: 0,
        },
      },
      {
        name: "birth date as boolean",
        payload: {
          ...validEmployeePayload(),
          email: "boolean-birth-date@example.com",
          birthDate: true,
        },
      },
      {
        name: "default feature sent as extra",
        payload: {
          ...validEmployeePayload(),
          email: "default-feature@example.com",
          extraFeatures: ["read:appointments"],
        },
      },
      {
        name: "unknown extra feature",
        payload: {
          ...validEmployeePayload(),
          email: "unknown-feature@example.com",
          extraFeatures: ["approve:payments"],
        },
      },
      {
        name: "profile image sent in request",
        payload: {
          ...validEmployeePayload(),
          email: "profile-image@example.com",
          profileImageUrl: "https://example.com/avatar.png",
        },
      },
    ];

    for (const invalidPayload of invalidPayloads) {
      const response = await request(getHttpServer(app))
        .post("/employees")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(invalidPayload.payload);

      expect(response.status, invalidPayload.name).toBe(400);
    }
  });

  it("should reject duplicate employee email", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const payload = validEmployeePayload();

    const firstResponse = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(payload);
    const duplicateResponse = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(payload);

    expect(firstResponse.status).toBe(201);
    expect(duplicateResponse.status).toBe(409);
  });

  it("should reject an establishment user without establishment profile", async () => {
    const { accessToken } =
      await makeEstablishmentUserWithoutProfileAccessToken({
        app,
        prisma,
        userFactory,
      });

    const response = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validEmployeePayload());

    expect(response.status).toBe(404);
  });
});
