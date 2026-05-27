import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CustomerFactory } from "../../../../tests/factories/customer-factory";
import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  makeCustomerAuth,
  makeEstablishmentAuth,
  vehicleOptionsResponseSchema,
} from "../../../../tests/helpers/establishment-operated-scheduling.e2e-helpers";
import {
  getHttpServer,
  makeEmployeeAuth,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

describe("ListCustomerVehicleOptionsController (e2e)", () => {
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

  it("should list active vehicle options with search, customer filter, limit, and minimal shape", async () => {
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
    const outsideCustomer = await customerFactory.makePrismaCustomer({
      establishmentId: secondOwner.establishment.id,
      cpfCnpj: null,
    });
    const firstVehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: firstOwner.establishment.id.toString(),
        customerId: firstCustomer.id.toString(),
        plate: "ABC1D23",
        brand: "Volkswagen",
        model: "Gol Trend",
      },
    });
    await prisma.customerVehicle.create({
      data: {
        establishmentId: firstOwner.establishment.id.toString(),
        customerId: firstCustomer.id.toString(),
        plate: "DEF4G56",
        brand: "Chevrolet",
        model: "Onix",
      },
    });
    await prisma.customerVehicle.create({
      data: {
        establishmentId: firstOwner.establishment.id.toString(),
        customerId: secondCustomer.id.toString(),
        plate: "GHI7J89",
        brand: "Volkswagen",
        model: "Polo",
      },
    });
    const deletedVehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: firstOwner.establishment.id.toString(),
        customerId: firstCustomer.id.toString(),
        plate: "JKL1M23",
        brand: "Volkswagen",
        model: "Virtus",
        deletedAt: new Date(),
      },
    });
    await prisma.customerVehicle.create({
      data: {
        establishmentId: secondOwner.establishment.id.toString(),
        customerId: outsideCustomer.id.toString(),
        plate: "MNO4P56",
        brand: "Volkswagen",
        model: "Nivus",
      },
    });

    const brandResponse = await request(getHttpServer(app))
      .get("/vehicles/options")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .query({
        search: "volks",
        customerId: firstCustomer.id.toString(),
        limit: 1,
      });
    const plateResponse = await request(getHttpServer(app))
      .get("/vehicles/options")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .query({ search: "abc-1d" });
    const brandBody = vehicleOptionsResponseSchema.parse(brandResponse.body);
    const plateBody = vehicleOptionsResponseSchema.parse(plateResponse.body);

    expect(brandResponse.status).toBe(200);
    expect(brandBody.vehicles).toEqual([
      {
        id: firstVehicle.id,
        label: "Gol Trend",
      },
    ]);
    expect(brandBody.vehicles.map((vehicle) => vehicle.id)).not.toContain(
      deletedVehicle.id,
    );
    expect(plateResponse.status).toBe(200);
    expect(plateBody.vehicles).toEqual([
      {
        id: firstVehicle.id,
        label: "Gol Trend",
      },
    ]);
    expect(brandBody.totalItems).toBe(1);
    expect(plateBody.totalItems).toBe(1);
  });

  it("should allow employee scope", async () => {
    const owner = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const employee = await makeEmployeeAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      establishment: owner.establishment,
    });
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: owner.establishment.id,
      cpfCnpj: null,
    });
    const vehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: owner.establishment.id.toString(),
        customerId: customer.id.toString(),
        plate: "ABC1D23",
        brand: "Toyota",
        model: "Corolla",
      },
    });

    const response = await request(getHttpServer(app))
      .get("/vehicles/options")
      .set("Authorization", `Bearer ${employee.accessToken}`);

    expect(response.status).toBe(200);
    const body = vehicleOptionsResponseSchema.parse(response.body);

    expect(body.vehicles).toEqual([
      {
        id: vehicle.id,
        label: "Corolla",
      },
    ]);
  });

  it("should enforce authentication, roles, and employee read customer feature", async () => {
    const owner = await makeEstablishmentAuth({
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
    const employeeWithoutReadCustomers = await makeEmployeeAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      establishment: owner.establishment,
    });

    await prisma.employee.update({
      where: {
        id: employeeWithoutReadCustomers.employee.id.toString(),
      },
      data: {
        features: [
          "read:appointments",
          "read:services",
          "read:employees:self",
          "create:sessions:self",
          "read:sessions:self",
        ],
      },
    });

    const noTokenResponse = await request(getHttpServer(app)).get(
      "/vehicles/options",
    );
    const invalidTokenResponse = await request(getHttpServer(app))
      .get("/vehicles/options")
      .set("Authorization", "Bearer invalid-token");
    const customerRoleResponse = await request(getHttpServer(app))
      .get("/vehicles/options")
      .set("Authorization", `Bearer ${customerRole.accessToken}`);
    const employeeWithoutFeatureResponse = await request(getHttpServer(app))
      .get("/vehicles/options")
      .set(
        "Authorization",
        `Bearer ${employeeWithoutReadCustomers.accessToken}`,
      );

    expect(noTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.status).toBe(401);
    expect(customerRoleResponse.status).toBe(403);
    expect(employeeWithoutFeatureResponse.status).toBe(403);
  });

  it("should reject invalid query params and out-of-scope customer filters", async () => {
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
    const outsideCustomer = await customerFactory.makePrismaCustomer({
      establishmentId: secondOwner.establishment.id,
      cpfCnpj: null,
    });

    const invalidCustomerIdResponse = await request(getHttpServer(app))
      .get("/vehicles/options")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .query({ customerId: "not-a-uuid" });
    const invalidLimitResponse = await request(getHttpServer(app))
      .get("/vehicles/options")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .query({ limit: 0 });
    const outsideCustomerResponse = await request(getHttpServer(app))
      .get("/vehicles/options")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .query({ customerId: outsideCustomer.id.toString() });

    expect(invalidCustomerIdResponse.status).toBe(400);
    expect(invalidLimitResponse.status).toBe(400);
    expect(outsideCustomerResponse.status).toBe(404);
  });
});
