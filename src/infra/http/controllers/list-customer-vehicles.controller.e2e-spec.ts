import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CustomerFactory } from "../../../../tests/factories/customer-factory";
import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  listVehiclesResponseSchema,
  makeCustomerAuth,
  makeEstablishmentAuth,
} from "../../../../tests/helpers/establishment-operated-scheduling.e2e-helpers";
import { getHttpServer } from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

describe("ListCustomerVehiclesController (e2e)", () => {
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

  it("should list active customer vehicles and support pagination", async () => {
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
    });
    const firstVehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: customer.id.toString(),
        plate: "ABC1D23",
      },
    });
    const secondVehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: customer.id.toString(),
        plate: "DEF4G56",
      },
    });
    const deletedVehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: customer.id.toString(),
        plate: "GHI7J89",
        deletedAt: new Date(),
      },
    });

    const allResponse = await request(getHttpServer(app))
      .get(`/customers/${customer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${accessToken}`);
    const paginatedResponse = await request(getHttpServer(app))
      .get(`/customers/${customer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ page: 1, size: 1 });
    const allBody = listVehiclesResponseSchema.parse(allResponse.body);
    const paginatedBody = listVehiclesResponseSchema.parse(
      paginatedResponse.body,
    );

    expect(allResponse.status).toBe(200);
    expect(allBody.vehicles.map((vehicle) => vehicle.id)).toEqual(
      expect.arrayContaining([firstVehicle.id, secondVehicle.id]),
    );
    expect(allBody.vehicles.map((vehicle) => vehicle.id)).not.toContain(
      deletedVehicle.id,
    );
    expect(paginatedResponse.status).toBe(200);
    expect(paginatedBody.vehicles).toHaveLength(1);
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

    const noTokenResponse = await request(getHttpServer(app)).get(
      `/customers/${customer.id.toString()}/vehicles`,
    );
    const invalidTokenResponse = await request(getHttpServer(app))
      .get(`/customers/${customer.id.toString()}/vehicles`)
      .set("Authorization", "Bearer invalid-token");
    const expiredTokenResponse = await request(getHttpServer(app))
      .get(`/customers/${customer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${expiredAccessToken}`);
    const customerRoleResponse = await request(getHttpServer(app))
      .get(`/customers/${customer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${customerRole.accessToken}`);
    const validResponse = await request(getHttpServer(app))
      .get(`/customers/${customer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(noTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.status).toBe(401);
    expect(expiredTokenResponse.status).toBe(401);
    expect(customerRoleResponse.status).toBe(403);
    expect(validResponse.status).toBe(200);
  });

  it("should reject invalid params and query values", async () => {
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
    });

    const invalidCustomerIdResponse = await request(getHttpServer(app))
      .get("/customers/not-a-uuid/vehicles")
      .set("Authorization", `Bearer ${accessToken}`);
    const invalidPageResponse = await request(getHttpServer(app))
      .get(`/customers/${customer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ page: 0 });

    expect(invalidCustomerIdResponse.status).toBe(400);
    expect(invalidPageResponse.status).toBe(400);
  });

  it("should not expose vehicles from another establishment or another customer", async () => {
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
    const firstCustomer = await customerFactory.makePrismaCustomer({
      establishmentId: firstOwner.establishment.id,
      cpfCnpj: null,
    });
    const secondCustomer = await customerFactory.makePrismaCustomer({
      establishmentId: firstOwner.establishment.id,
      cpfCnpj: null,
    });
    await prisma.customerVehicle.create({
      data: {
        establishmentId: firstOwner.establishment.id.toString(),
        customerId: firstCustomer.id.toString(),
        plate: "ABC1D23",
      },
    });

    const crossEstablishmentResponse = await request(getHttpServer(app))
      .get(`/customers/${firstCustomer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${secondOwner.accessToken}`);
    const wrongCustomerResponse = await request(getHttpServer(app))
      .get(`/customers/${secondCustomer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${firstOwner.accessToken}`);
    const wrongCustomerBody = listVehiclesResponseSchema.parse(
      wrongCustomerResponse.body,
    );

    expect(crossEstablishmentResponse.status).toBe(404);
    expect(wrongCustomerResponse.status).toBe(200);
    expect(wrongCustomerBody.vehicles).toHaveLength(0);
  });
});
