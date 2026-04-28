import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  customerResponseSchema,
  listCustomersResponseSchema,
  makeCustomerAuth,
  makeEstablishmentAuth,
  validCustomerPayload,
} from "../../../../tests/helpers/establishment-operated-scheduling.e2e-helpers";
import { getHttpServer } from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

describe("ListCustomersController (e2e)", () => {
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

  it("should list active customers and support search and pagination", async () => {
    const { accessToken } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const mariaResponse = await request(getHttpServer(app))
      .post("/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        validCustomerPayload({
          cpfCnpj: null,
          fullName: "Maria Silva",
          email: "maria@example.com",
        }),
      );
    const joaoResponse = await request(getHttpServer(app))
      .post("/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        validCustomerPayload({
          cpfCnpj: null,
          fullName: "Joao Oliveira",
          email: "joao@example.com",
        }),
      );
    const deletedResponse = await request(getHttpServer(app))
      .post("/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        validCustomerPayload({
          cpfCnpj: null,
          fullName: "Ana Removida",
          email: "ana@example.com",
        }),
      );
    const maria = customerResponseSchema.parse(mariaResponse.body).customer;
    const joao = customerResponseSchema.parse(joaoResponse.body).customer;
    const deleted = customerResponseSchema.parse(deletedResponse.body).customer;

    await prisma.customer.update({
      where: {
        id: deleted.id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    const allResponse = await request(getHttpServer(app))
      .get("/customers")
      .set("Authorization", `Bearer ${accessToken}`);
    const searchResponse = await request(getHttpServer(app))
      .get("/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ search: "maria" });
    const paginatedResponse = await request(getHttpServer(app))
      .get("/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ page: 1, size: 1 });
    const allBody = listCustomersResponseSchema.parse(allResponse.body);
    const searchBody = listCustomersResponseSchema.parse(searchResponse.body);
    const paginatedBody = listCustomersResponseSchema.parse(
      paginatedResponse.body,
    );

    expect(allResponse.status).toBe(200);
    expect(allBody.customers.map((customer) => customer.id)).toEqual(
      expect.arrayContaining([maria.id, joao.id]),
    );
    expect(allBody.customers.map((customer) => customer.id)).not.toContain(
      deleted.id,
    );
    expect(searchResponse.status).toBe(200);
    expect(searchBody.customers.map((customer) => customer.id)).toEqual([
      maria.id,
    ]);
    expect(paginatedResponse.status).toBe(200);
    expect(paginatedBody.customers).toHaveLength(1);
  });

  it("should enforce authentication and establishment role", async () => {
    const { expiredAccessToken, accessToken } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const customerRole = await makeCustomerAuth({
      app,
      prisma,
      userFactory,
    });

    const noTokenResponse = await request(getHttpServer(app)).get("/customers");
    const invalidTokenResponse = await request(getHttpServer(app))
      .get("/customers")
      .set("Authorization", "Bearer invalid-token");
    const expiredTokenResponse = await request(getHttpServer(app))
      .get("/customers")
      .set("Authorization", `Bearer ${expiredAccessToken}`);
    const customerRoleResponse = await request(getHttpServer(app))
      .get("/customers")
      .set("Authorization", `Bearer ${customerRole.accessToken}`);
    const validResponse = await request(getHttpServer(app))
      .get("/customers")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(noTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.status).toBe(401);
    expect(expiredTokenResponse.status).toBe(401);
    expect(customerRoleResponse.status).toBe(403);
    expect(validResponse.status).toBe(200);
  });

  it("should reject invalid list query params", async () => {
    const { accessToken } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const invalidPageResponse = await request(getHttpServer(app))
      .get("/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ page: 0 });
    const invalidSizeResponse = await request(getHttpServer(app))
      .get("/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ size: 0 });

    expect(invalidPageResponse.status).toBe(400);
    expect(invalidSizeResponse.status).toBe(400);
  });

  it("should not expose customers from another establishment", async () => {
    const firstOwner = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const secondOwner = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    await request(getHttpServer(app))
      .post("/customers")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .send(validCustomerPayload({ cpfCnpj: null }));

    const response = await request(getHttpServer(app))
      .get("/customers")
      .set("Authorization", `Bearer ${secondOwner.accessToken}`);
    const body = listCustomersResponseSchema.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.customers).toHaveLength(0);
  });
});
