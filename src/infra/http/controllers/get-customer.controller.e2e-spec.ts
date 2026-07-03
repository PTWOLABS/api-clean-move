import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CustomerFactory } from "../../../../tests/factories/customer-factory";
import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  customerResponseSchema,
  makeCustomerAuth,
  makeEstablishmentAuth,
} from "../../../../tests/helpers/establishment-operated-scheduling.e2e-helpers";
import { getHttpServer } from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

describe("GetCustomerController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userFactory: UserFactory;
  let establishmentFactory: EstablishmentFactory;
  let customerFactory: CustomerFactory;
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
    customerFactory = new CustomerFactory(prisma);
    envService = moduleRef.get(EnvService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should get an active customer without vehicle data", async () => {
    const { accessToken, establishment } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
      fullName: "Maria Silva",
    });

    const response = await request(getHttpServer(app))
      .get(`/customers/${customer.id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const body = customerResponseSchema.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.customer).toMatchObject({
      id: customer.id.toString(),
      establishmentId: establishment.id.toString(),
      fullName: "Maria Silva",
      deletedAt: null,
    });
    expect(body.customer).not.toHaveProperty("vehicles");
    expect(body.customer).not.toHaveProperty("vehiclesCount");
  });

  it("should enforce authentication and establishment role", async () => {
    const { accessToken, expiredAccessToken, establishment } =
      await makeEstablishmentAuth({
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
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const path = `/customers/${customer.id.toString()}`;

    const noTokenResponse = await request(getHttpServer(app)).get(path);
    const invalidTokenResponse = await request(getHttpServer(app))
      .get(path)
      .set("Authorization", "Bearer invalid-token");
    const expiredTokenResponse = await request(getHttpServer(app))
      .get(path)
      .set("Authorization", `Bearer ${expiredAccessToken}`);
    const customerRoleResponse = await request(getHttpServer(app))
      .get(path)
      .set("Authorization", `Bearer ${customerRole.accessToken}`);
    const validResponse = await request(getHttpServer(app))
      .get(path)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(noTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.status).toBe(401);
    expect(expiredTokenResponse.status).toBe(401);
    expect(customerRoleResponse.status).toBe(403);
    expect(validResponse.status).toBe(200);
  });

  it("should reject invalid ids and customers from another establishment", async () => {
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
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: firstOwner.establishment.id,
      cpfCnpj: null,
    });

    const invalidIdResponse = await request(getHttpServer(app))
      .get("/customers/not-a-uuid")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`);
    const crossEstablishmentResponse = await request(getHttpServer(app))
      .get(`/customers/${customer.id.toString()}`)
      .set("Authorization", `Bearer ${secondOwner.accessToken}`);

    expect(invalidIdResponse.status).toBe(400);
    expect(crossEstablishmentResponse.status).toBe(404);
  });
});
