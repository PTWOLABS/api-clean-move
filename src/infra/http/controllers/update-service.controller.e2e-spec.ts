import { randomUUID } from "node:crypto";

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  getHttpServer,
  loginUser,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import { expectSingleMessageResponseWithoutIssues } from "../../../../tests/helpers/http-response-assertions";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { Cnpj } from "../../../modules/establishments/domain/value-objects/cnpj";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";

const serviceCategories = [
  "WASH",
  "SANITIZATION",
  "AUTOMATIVE_DETAILING",
  "PROTECTION",
  "UPHOLSTERY",
] as const;

const serviceResponseSchema = z.object({
  id: z.uuid(),
  establishmentId: z.uuid(),
  name: z.string().min(1),
  description: z.string().min(1).nullable(),
  category: z.enum(serviceCategories).nullable(),
  estimatedDuration: z
    .object({
      minInMinutes: z.number().int().positive(),
      maxInMinutes: z.number().int().positive().nullable(),
    })
    .nullable(),
  priceInCents: z.number().int().nonnegative(),
  isActive: z.boolean(),
  createdAt: z.string().min(1).nullable(),
  updatedAt: z.string().min(1).nullable(),
});

const updateServiceResponseSchema = z.object({
  service: serviceResponseSchema,
});

const validationErrorResponseSchema = z.object({
  statusCode: z.literal(400),
  message: z.literal("Validation failed"),
  error: z.literal("Bad Request"),
  issues: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      path: z.string(),
    }),
  ),
  parameter: z.null(),
  target: z.literal("body"),
});

function makeCreateServicePayload() {
  return {
    serviceName: "Lavagem premium",
    description: "Lavagem externa com acabamento e brilho.",
    category: "WASH" as const,
    estimatedDuration: {
      minInMinutes: 30,
      maxInMinutes: 60,
    },
    price: 3000,
    isActive: true,
  };
}

describe("UpdateServiceController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hashGenerator: HashGenerator;
  let userFactory: UserFactory;
  let establishmentFactory: EstablishmentFactory;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get(PrismaService);
    hashGenerator = moduleRef.get(HashGenerator);
    userFactory = new UserFactory(prisma, hashGenerator);
    establishmentFactory = new EstablishmentFactory(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return 401 when trying to update a service without an access token", async () => {
    const response = await request(getHttpServer(app))
      .patch(`/services/${randomUUID()}`)
      .send({ serviceName: "Updated name" });

    expect(response.status).toBe(401);
    expectSingleMessageResponseWithoutIssues(
      response.body,
      "Missing access token.",
    );
  });

  it("should return 403 when trying to update a service authenticated as a customer", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "CUSTOMER",
      plainPassword: "strong-password",
    });
    const customerLogin = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const response = await request(getHttpServer(app))
      .patch(`/services/${randomUUID()}`)
      .set("Authorization", `Bearer ${customerLogin.loginBody.accessToken}`)
      .send({ serviceName: "Updated name" });

    expect(response.status).toBe(403);
    expectSingleMessageResponseWithoutIssues(
      response.body,
      "Forbidden resource",
    );
  });

  it("should return 404 when the authenticated establishment user has no establishment profile", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "ESTABLISHMENT",
      plainPassword: "strong-password",
    });
    const establishmentLogin = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const response = await request(getHttpServer(app))
      .patch(`/services/${randomUUID()}`)
      .set(
        "Authorization",
        `Bearer ${establishmentLogin.loginBody.accessToken}`,
      )
      .send({ serviceName: "Updated name" });

    expect(response.status).toBe(404);
    expectSingleMessageResponseWithoutIssues(
      response.body,
      "Resource not found: establishment.",
    );
  });

  it("should update a subset of fields for the authenticated establishment", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "ESTABLISHMENT",
      plainPassword: "strong-password",
    });
    const establishment = await establishmentFactory.makePrismaEstablishment({
      ownerId: user.id,
    });
    const establishmentLogin = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const createResponse = await request(getHttpServer(app))
      .post("/services")
      .set(
        "Authorization",
        `Bearer ${establishmentLogin.loginBody.accessToken}`,
      )
      .send(makeCreateServicePayload());
    const created = updateServiceResponseSchema.parse(createResponse.body);
    const serviceId = created.service.id;
    const createdAtBefore = created.service.createdAt;

    const patchResponse = await request(getHttpServer(app))
      .patch(`/services/${serviceId}`)
      .set(
        "Authorization",
        `Bearer ${establishmentLogin.loginBody.accessToken}`,
      )
      .send({
        serviceName: "Lavagem express",
        price: 4500,
      });
    const body = updateServiceResponseSchema.parse(patchResponse.body);

    expect(patchResponse.status).toBe(200);
    expect(body.service.id).toBe(serviceId);
    expect(body.service.establishmentId).toBe(establishment.id.toString());
    expect(body.service.name).toBe("Lavagem express");
    expect(body.service.priceInCents).toBe(4500);
    expect(body.service.description).toBe(
      "Lavagem externa com acabamento e brilho.",
    );
    expect(body.service.category).toBe("WASH");
    expect(body.service.estimatedDuration).toEqual({
      minInMinutes: 30,
      maxInMinutes: 60,
    });
    expect(body.service.isActive).toBe(true);
    expect(body.service.createdAt).toBe(createdAtBefore);

    const row = await prisma.service.findUnique({ where: { id: serviceId } });
    expect(row?.serviceName).toBe("Lavagem express");
    expect(row?.priceInCents).toBe(4500);
  });

  it("should update only isActive and persist it", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "ESTABLISHMENT",
      plainPassword: "strong-password",
    });
    await establishmentFactory.makePrismaEstablishment({
      ownerId: user.id,
    });
    const establishmentLogin = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const createResponse = await request(getHttpServer(app))
      .post("/services")
      .set(
        "Authorization",
        `Bearer ${establishmentLogin.loginBody.accessToken}`,
      )
      .send(makeCreateServicePayload());
    const created = updateServiceResponseSchema.parse(createResponse.body);
    const serviceId = created.service.id;

    const patchResponse = await request(getHttpServer(app))
      .patch(`/services/${serviceId}`)
      .set(
        "Authorization",
        `Bearer ${establishmentLogin.loginBody.accessToken}`,
      )
      .send({ isActive: false });
    const body = updateServiceResponseSchema.parse(patchResponse.body);

    expect(patchResponse.status).toBe(200);
    expect(body.service.isActive).toBe(false);

    const row = await prisma.service.findUnique({ where: { id: serviceId } });
    expect(row?.isActive).toBe(false);
  });

  it("should return 400 when the update body is empty", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "ESTABLISHMENT",
      plainPassword: "strong-password",
    });
    await establishmentFactory.makePrismaEstablishment({
      ownerId: user.id,
    });
    const establishmentLogin = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const createResponse = await request(getHttpServer(app))
      .post("/services")
      .set(
        "Authorization",
        `Bearer ${establishmentLogin.loginBody.accessToken}`,
      )
      .send(makeCreateServicePayload());
    const created = updateServiceResponseSchema.parse(createResponse.body);

    const response = await request(getHttpServer(app))
      .patch(`/services/${created.service.id}`)
      .set(
        "Authorization",
        `Bearer ${establishmentLogin.loginBody.accessToken}`,
      )
      .send({});

    expect(response.status).toBe(400);
    const parsed = validationErrorResponseSchema.parse(response.body);
    expect(parsed.issues.length).toBeGreaterThan(0);
    expect(
      parsed.issues.some((i) =>
        i.message.includes("At least one field must be provided"),
      ),
    ).toBe(true);
  });

  it("should return 404 when the service id does not exist", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "ESTABLISHMENT",
      plainPassword: "strong-password",
    });
    await establishmentFactory.makePrismaEstablishment({
      ownerId: user.id,
    });
    const establishmentLogin = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const response = await request(getHttpServer(app))
      .patch(`/services/${randomUUID()}`)
      .set(
        "Authorization",
        `Bearer ${establishmentLogin.loginBody.accessToken}`,
      )
      .send({ price: 1000 });

    expect(response.status).toBe(404);
    expectSingleMessageResponseWithoutIssues(
      response.body,
      "Resource not found: service.",
    );
  });

  it("should return 403 when the service belongs to another establishment", async () => {
    const { user: ownerA, plainPassword: passwordA } =
      await userFactory.makePrismaUser({
        role: "ESTABLISHMENT",
        plainPassword: "strong-password",
      });
    const { user: ownerB, plainPassword: passwordB } =
      await userFactory.makePrismaUser({
        role: "ESTABLISHMENT",
        plainPassword: "strong-password",
      });

    await establishmentFactory.makePrismaEstablishment({
      ownerId: ownerA.id,
    });
    await establishmentFactory.makePrismaEstablishment({
      ownerId: ownerB.id,
      cnpj: Cnpj.create("41437902000177"),
    });

    const loginA = await loginUser({
      app,
      prisma,
      userId: ownerA.id.toString(),
      email: ownerA.email.toString(),
      password: passwordA ?? "",
    });

    const createResponse = await request(getHttpServer(app))
      .post("/services")
      .set("Authorization", `Bearer ${loginA.loginBody.accessToken}`)
      .send(makeCreateServicePayload());
    const created = updateServiceResponseSchema.parse(createResponse.body);
    const serviceId = created.service.id;

    const loginB = await loginUser({
      app,
      prisma,
      userId: ownerB.id.toString(),
      email: ownerB.email.toString(),
      password: passwordB ?? "",
    });

    const response = await request(getHttpServer(app))
      .patch(`/services/${serviceId}`)
      .set("Authorization", `Bearer ${loginB.loginBody.accessToken}`)
      .send({ serviceName: "Tentativa invasora" });

    expect(response.status).toBe(403);
    expectSingleMessageResponseWithoutIssues(response.body, "Not allowed.");
  });
});
