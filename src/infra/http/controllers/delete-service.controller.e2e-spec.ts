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

const createServiceResponseSchema = z.object({
  service: z.object({
    id: z.uuid(),
    establishmentId: z.uuid(),
  }),
});

const listEstablishmentServicesResponseSchema = z.object({
  items: z.array(z.object({ id: z.uuid() })),
  totalItems: z.number(),
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

describe("DeleteServiceController (e2e)", () => {
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

  it("should return 401 when deleting a service without an access token", async () => {
    const response = await request(getHttpServer(app)).delete(
      `/services/${randomUUID()}`,
    );

    expect(response.status).toBe(401);
    expectSingleMessageResponseWithoutIssues(
      response.body,
      "Missing access token.",
    );
  });

  it("should return 403 when deleting as a customer", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "CUSTOMER",
      plainPassword: "strong-password",
    });
    const login = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const response = await request(getHttpServer(app))
      .delete(`/services/${randomUUID()}`)
      .set("Authorization", `Bearer ${login.loginBody.accessToken}`);

    expect(response.status).toBe(403);
  });

  it("should soft-delete a service and return 204", async () => {
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

    const createResponse = await request(getHttpServer(app))
      .post("/services")
      .set(
        "Authorization",
        `Bearer ${establishmentLogin.loginBody.accessToken}`,
      )
      .send(makeCreateServicePayload());
    const created = createServiceResponseSchema.parse(createResponse.body);
    const serviceId = created.service.id;

    const deleteResponse = await request(getHttpServer(app))
      .delete(`/services/${serviceId}`)
      .set(
        "Authorization",
        `Bearer ${establishmentLogin.loginBody.accessToken}`,
      );

    expect(deleteResponse.status).toBe(204);

    const row = await prisma.service.findUnique({ where: { id: serviceId } });
    expect(row?.deletedAt).not.toBeNull();

    const listResponse = await request(getHttpServer(app))
      .get(`/establishments/${user.id.toString()}/services`)
      .set(
        "Authorization",
        `Bearer ${establishmentLogin.loginBody.accessToken}`,
      );

    expect(listResponse.status).toBe(200);
    const listBody = listEstablishmentServicesResponseSchema.parse(
      listResponse.body,
    );
    const ids = listBody.items.map((s) => s.id);
    expect(ids).not.toContain(serviceId);
  });

  it("should return 404 when deleting the same service twice", async () => {
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
    const created = createServiceResponseSchema.parse(createResponse.body);
    const serviceId = created.service.id;

    await request(getHttpServer(app))
      .delete(`/services/${serviceId}`)
      .set(
        "Authorization",
        `Bearer ${establishmentLogin.loginBody.accessToken}`,
      );

    const second = await request(getHttpServer(app))
      .delete(`/services/${serviceId}`)
      .set(
        "Authorization",
        `Bearer ${establishmentLogin.loginBody.accessToken}`,
      );

    expect(second.status).toBe(404);
    expectSingleMessageResponseWithoutIssues(
      second.body,
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
    const created = createServiceResponseSchema.parse(createResponse.body);
    const serviceId = created.service.id;

    const loginB = await loginUser({
      app,
      prisma,
      userId: ownerB.id.toString(),
      email: ownerB.email.toString(),
      password: passwordB ?? "",
    });

    const response = await request(getHttpServer(app))
      .delete(`/services/${serviceId}`)
      .set("Authorization", `Bearer ${loginB.loginBody.accessToken}`);

    expect(response.status).toBe(403);
    expectSingleMessageResponseWithoutIssues(response.body, "Not allowed.");
  });
});
