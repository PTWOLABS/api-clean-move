import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  customerResponseSchema,
  makeCustomerAuth,
  makeEstablishmentAuth,
  validCustomerPayload,
} from "../../../../tests/helpers/establishment-operated-scheduling.e2e-helpers";
import { getHttpServer } from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

describe("UpdateCustomerController (e2e)", () => {
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

  it("should update customer data", async () => {
    const { accessToken } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const createResponse = await request(getHttpServer(app))
      .post("/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validCustomerPayload());
    const customer = customerResponseSchema.parse(createResponse.body).customer;

    const response = await request(getHttpServer(app))
      .patch(`/customers/${customer.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        cpfCnpj: "81936265000106",
        fullName: "Maria Oliveira",
        phone: "11988888888",
        email: "maria.oliveira@example.com",
        address: null,
        birthDate: null,
        nickname: null,
      });
    const body = customerResponseSchema.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.customer.cpfCnpj).toBe("81936265000106");
    expect(body.customer.documentType).toBe("CNPJ");
    expect(body.customer.fullName).toBe("Maria Oliveira");
    expect(body.customer.phone).toBe("11988888888");
    expect(body.customer.email).toBe("maria.oliveira@example.com");
    expect(body.customer.address).toBeNull();
    expect(body.customer.birthDate).toBeNull();
    expect(body.customer.nickname).toBeNull();
  });

  it("should enforce authentication and establishment role", async () => {
    const { accessToken, expiredAccessToken } = await makeEstablishmentAuth({
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
    const createResponse = await request(getHttpServer(app))
      .post("/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validCustomerPayload());
    const customerId = customerResponseSchema.parse(createResponse.body)
      .customer.id;

    const noTokenResponse = await request(getHttpServer(app))
      .patch(`/customers/${customerId}`)
      .send({ fullName: "Unauthorized" });
    const invalidTokenResponse = await request(getHttpServer(app))
      .patch(`/customers/${customerId}`)
      .set("Authorization", "Bearer invalid-token")
      .send({ fullName: "Unauthorized" });
    const expiredTokenResponse = await request(getHttpServer(app))
      .patch(`/customers/${customerId}`)
      .set("Authorization", `Bearer ${expiredAccessToken}`)
      .send({ fullName: "Unauthorized" });
    const customerRoleResponse = await request(getHttpServer(app))
      .patch(`/customers/${customerId}`)
      .set("Authorization", `Bearer ${customerRole.accessToken}`)
      .send({ fullName: "Unauthorized" });

    expect(noTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.status).toBe(401);
    expect(expiredTokenResponse.status).toBe(401);
    expect(customerRoleResponse.status).toBe(403);
  });

  it("should reject invalid update payloads and params", async () => {
    const { accessToken } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const createResponse = await request(getHttpServer(app))
      .post("/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validCustomerPayload());
    const customerId = customerResponseSchema.parse(createResponse.body)
      .customer.id;

    const invalidUuidResponse = await request(getHttpServer(app))
      .patch("/customers/not-a-uuid")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ fullName: "Invalid UUID" });
    const emptyBodyResponse = await request(getHttpServer(app))
      .patch(`/customers/${customerId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});
    const invalidEmailResponse = await request(getHttpServer(app))
      .patch(`/customers/${customerId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ email: "not-an-email" });

    expect(invalidUuidResponse.status).toBe(400);
    expect(emptyBodyResponse.status).toBe(400);
    expect(invalidEmailResponse.status).toBe(400);
  });

  it("should reject duplicate cpfCnpj inside the same establishment", async () => {
    const { accessToken } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const firstResponse = await request(getHttpServer(app))
      .post("/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validCustomerPayload({ cpfCnpj: "529.982.247-25" }));
    const secondResponse = await request(getHttpServer(app))
      .post("/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        validCustomerPayload({
          cpfCnpj: "111.444.777-35",
          email: "second@example.com",
        }),
      );
    const firstCustomer = customerResponseSchema.parse(
      firstResponse.body,
    ).customer;
    const secondCustomer = customerResponseSchema.parse(
      secondResponse.body,
    ).customer;

    const response = await request(getHttpServer(app))
      .patch(`/customers/${secondCustomer.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ cpfCnpj: firstCustomer.cpfCnpj });

    expect(response.status).toBe(409);
  });

  it("should not update customers from another establishment", async () => {
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
    const createResponse = await request(getHttpServer(app))
      .post("/customers")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .send(validCustomerPayload());
    const customerId = customerResponseSchema.parse(createResponse.body)
      .customer.id;

    const crossEstablishmentResponse = await request(getHttpServer(app))
      .patch(`/customers/${customerId}`)
      .set("Authorization", `Bearer ${secondOwner.accessToken}`)
      .send({ fullName: "Other owner" });
    const missingCustomerResponse = await request(getHttpServer(app))
      .patch(`/customers/${randomUUID()}`)
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .send({ fullName: "Missing" });

    expect(crossEstablishmentResponse.status).toBe(404);
    expect(missingCustomerResponse.status).toBe(404);
  });
});
