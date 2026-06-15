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

describe("ListVehiclesController (e2e)", () => {
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

  it("should list active vehicles across customers and support pagination", async () => {
    const { accessToken, establishment } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const firstCustomer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
      fullName: "Maria Silva",
    });
    const secondCustomer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
      fullName: "Joao Santos",
    });
    const firstVehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: firstCustomer.id.toString(),
        plate: "ABC1D23",
      },
    });
    const secondVehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: secondCustomer.id.toString(),
        plate: "DEF4G56",
      },
    });
    const deletedVehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: firstCustomer.id.toString(),
        plate: "GHI7J89",
        deletedAt: new Date(),
      },
    });

    const allResponse = await request(getHttpServer(app))
      .get("/vehicles")
      .set("Authorization", `Bearer ${accessToken}`);
    const paginatedResponse = await request(getHttpServer(app))
      .get("/vehicles")
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
    expect(allBody.totalItems).toBe(2);
    expect(paginatedBody.totalItems).toBe(2);
  });

  it("should filter by customerId and dedicated query params", async () => {
    const { accessToken, establishment } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const maria = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
      fullName: "Maria Silva",
    });
    const joao = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
      fullName: "Joao Santos",
    });
    const mariaVehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: maria.id.toString(),
        plate: "ABC1D23",
      },
    });
    await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: joao.id.toString(),
        plate: "DEF4G56",
      },
    });

    const byCustomerIdResponse = await request(getHttpServer(app))
      .get("/vehicles")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ customerId: maria.id.toString() });
    const byNameResponse = await request(getHttpServer(app))
      .get("/vehicles")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ name: "Maria" });
    const byCustomerIdBody = listVehiclesResponseSchema.parse(
      byCustomerIdResponse.body,
    );
    const byNameBody = listVehiclesResponseSchema.parse(byNameResponse.body);

    expect(byCustomerIdResponse.status).toBe(200);
    expect(byCustomerIdBody.vehicles.map((vehicle) => vehicle.id)).toEqual([
      mariaVehicle.id,
    ]);
    expect(byCustomerIdBody.totalItems).toBe(1);
    expect(byNameResponse.status).toBe(200);
    expect(byNameBody.vehicles.map((vehicle) => vehicle.id)).toEqual([
      mariaVehicle.id,
    ]);
    expect(byNameBody.totalItems).toBe(1);
  });

  it("should filter by plate, model, brand, color, and year", async () => {
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
    const targetVehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: customer.id.toString(),
        plate: "ABC1D23",
        model: "Gol",
        brand: "Volkswagen",
        color: "Branco",
        year: 2020,
      },
    });
    await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: customer.id.toString(),
        plate: "XYZ9A87",
        model: "Onix",
        brand: "Chevrolet",
        color: "Preto",
        year: 2018,
      },
    });

    const assertSingleMatch = async (
      query: Record<string, string>,
      expectedId: string,
    ) => {
      const response = await request(getHttpServer(app))
        .get("/vehicles")
        .set("Authorization", `Bearer ${accessToken}`)
        .query(query);
      const body = listVehiclesResponseSchema.parse(response.body);

      expect(response.status).toBe(200);
      expect(body.vehicles.map((vehicle) => vehicle.id)).toEqual([expectedId]);
      expect(body.totalItems).toBe(1);
    };

    await assertSingleMatch({ plate: "abc-1d23" }, targetVehicle.id);
    await assertSingleMatch({ model: "gol" }, targetVehicle.id);
    await assertSingleMatch({ brand: "volks" }, targetVehicle.id);
    await assertSingleMatch({ color: "branco" }, targetVehicle.id);
    await assertSingleMatch({ year: "2020" }, targetVehicle.id);

    const invalidYearResponse = await request(getHttpServer(app))
      .get("/vehicles")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ year: "not-a-year" });
    const invalidYearBody = listVehiclesResponseSchema.parse(
      invalidYearResponse.body,
    );

    expect(invalidYearResponse.status).toBe(200);
    expect(invalidYearBody.vehicles).toHaveLength(0);
    expect(invalidYearBody.totalItems).toBe(0);
  });

  it("should combine dedicated filters with AND logic", async () => {
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
    const targetVehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: customer.id.toString(),
        plate: "ABC1D23",
        model: "Gol",
        brand: "Volkswagen",
      },
    });
    await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: customer.id.toString(),
        plate: "XYZ9A87",
        model: "Gol",
        brand: "Chevrolet",
      },
    });

    const response = await request(getHttpServer(app))
      .get("/vehicles")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ brand: "volks", model: "gol" });
    const body = listVehiclesResponseSchema.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.vehicles.map((vehicle) => vehicle.id)).toEqual([
      targetVehicle.id,
    ]);
    expect(body.totalItems).toBe(1);
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

    const noTokenResponse = await request(getHttpServer(app)).get("/vehicles");
    const invalidTokenResponse = await request(getHttpServer(app))
      .get("/vehicles")
      .set("Authorization", "Bearer invalid-token");
    const expiredTokenResponse = await request(getHttpServer(app))
      .get("/vehicles")
      .set("Authorization", `Bearer ${expiredAccessToken}`);
    const customerRoleResponse = await request(getHttpServer(app))
      .get("/vehicles")
      .set("Authorization", `Bearer ${customerRole.accessToken}`);
    const validResponse = await request(getHttpServer(app))
      .get("/vehicles")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(noTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.status).toBe(401);
    expect(expiredTokenResponse.status).toBe(401);
    expect(customerRoleResponse.status).toBe(403);
    expect(validResponse.status).toBe(200);
  });

  it("should reject invalid query values and unknown customers", async () => {
    const { accessToken, establishment } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const otherOwner = await makeEstablishmentAuth({
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
      .get("/vehicles")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ customerId: "not-a-uuid" });
    const invalidPageResponse = await request(getHttpServer(app))
      .get("/vehicles")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ page: 0 });
    const nameFilterResponse = await request(getHttpServer(app))
      .get("/vehicles")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ name: "Maria" });
    const unknownCustomerResponse = await request(getHttpServer(app))
      .get("/vehicles")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ customerId: customer.id.toString() });
    const crossEstablishmentResponse = await request(getHttpServer(app))
      .get("/vehicles")
      .set("Authorization", `Bearer ${otherOwner.accessToken}`)
      .query({ customerId: customer.id.toString() });

    expect(invalidCustomerIdResponse.status).toBe(400);
    expect(invalidPageResponse.status).toBe(400);
    expect(nameFilterResponse.status).toBe(200);
    expect(unknownCustomerResponse.status).toBe(200);
    expect(crossEstablishmentResponse.status).toBe(404);
  });

  it("should not expose vehicles from another establishment", async () => {
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
    await prisma.customerVehicle.create({
      data: {
        establishmentId: firstOwner.establishment.id.toString(),
        customerId: customer.id.toString(),
        plate: "ABC1D23",
      },
    });

    const crossEstablishmentResponse = await request(getHttpServer(app))
      .get("/vehicles")
      .set("Authorization", `Bearer ${secondOwner.accessToken}`);
    const crossEstablishmentBody = listVehiclesResponseSchema.parse(
      crossEstablishmentResponse.body,
    );

    expect(crossEstablishmentResponse.status).toBe(200);
    expect(crossEstablishmentBody.vehicles).toHaveLength(0);
    expect(crossEstablishmentBody.totalItems).toBe(0);
  });
});
