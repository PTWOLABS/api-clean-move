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
  vehicleResponseSchema,
} from "../../../../tests/helpers/establishment-operated-scheduling.e2e-helpers";
import { getHttpServer } from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

describe("UpdateCustomerVehicleController (e2e)", () => {
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

  it("should update a customer vehicle", async () => {
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
    const vehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: customer.id.toString(),
        plate: "ABC1D23",
        brand: "Toyota",
        model: "Corolla",
        color: "Prata",
        year: 2022,
        notes: "Principal",
      },
    });

    const response = await request(getHttpServer(app))
      .patch(`/customers/${customer.id.toString()}/vehicles/${vehicle.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        plate: "xyz-9a87",
        brand: "Honda",
        model: "Civic",
        color: "Preto",
        year: 2024,
        notes: null,
      });
    const body = vehicleResponseSchema.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.vehicle.plate).toBe("XYZ9A87");
    expect(body.vehicle.brand).toBe("Honda");
    expect(body.vehicle.model).toBe("Civic");
    expect(body.vehicle.color).toBe("Preto");
    expect(body.vehicle.year).toBe(2024);
    expect(body.vehicle.notes).toBeNull();
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
    const vehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: customer.id.toString(),
        plate: "ABC1D23",
      },
    });

    const noTokenResponse = await request(getHttpServer(app))
      .patch(`/customers/${customer.id.toString()}/vehicles/${vehicle.id}`)
      .send({ brand: "Unauthorized" });
    const invalidTokenResponse = await request(getHttpServer(app))
      .patch(`/customers/${customer.id.toString()}/vehicles/${vehicle.id}`)
      .set("Authorization", "Bearer invalid-token")
      .send({ brand: "Unauthorized" });
    const expiredTokenResponse = await request(getHttpServer(app))
      .patch(`/customers/${customer.id.toString()}/vehicles/${vehicle.id}`)
      .set("Authorization", `Bearer ${expiredAccessToken}`)
      .send({ brand: "Unauthorized" });
    const customerRoleResponse = await request(getHttpServer(app))
      .patch(`/customers/${customer.id.toString()}/vehicles/${vehicle.id}`)
      .set("Authorization", `Bearer ${customerRole.accessToken}`)
      .send({ brand: "Unauthorized" });

    expect(noTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.status).toBe(401);
    expect(expiredTokenResponse.status).toBe(401);
    expect(customerRoleResponse.status).toBe(403);
  });

  it("should reject invalid update payloads and params", async () => {
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
    const vehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: customer.id.toString(),
        plate: "ABC1D23",
      },
    });

    const invalidCustomerIdResponse = await request(getHttpServer(app))
      .patch(`/customers/not-a-uuid/vehicles/${vehicle.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ brand: "Honda" });
    const invalidVehicleIdResponse = await request(getHttpServer(app))
      .patch(`/customers/${customer.id.toString()}/vehicles/not-a-uuid`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ brand: "Honda" });
    const emptyBodyResponse = await request(getHttpServer(app))
      .patch(`/customers/${customer.id.toString()}/vehicles/${vehicle.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});
    const invalidPlateResponse = await request(getHttpServer(app))
      .patch(`/customers/${customer.id.toString()}/vehicles/${vehicle.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ plate: "abc" });

    expect(invalidCustomerIdResponse.status).toBe(400);
    expect(invalidVehicleIdResponse.status).toBe(400);
    expect(emptyBodyResponse.status).toBe(400);
    expect(invalidPlateResponse.status).toBe(400);
  });

  it("should reject duplicate active plates inside the same establishment", async () => {
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
    await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: customer.id.toString(),
        plate: "ABC1D23",
      },
    });
    const targetVehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: customer.id.toString(),
        plate: "DEF4G56",
      },
    });

    const response = await request(getHttpServer(app))
      .patch(
        `/customers/${customer.id.toString()}/vehicles/${targetVehicle.id}`,
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ plate: "abc-1d23" });

    expect(response.status).toBe(409);
  });

  it("should not update vehicles from another establishment or customer", async () => {
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
    const vehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: firstOwner.establishment.id.toString(),
        customerId: firstCustomer.id.toString(),
        plate: "ABC1D23",
      },
    });

    const crossEstablishmentResponse = await request(getHttpServer(app))
      .patch(`/customers/${firstCustomer.id.toString()}/vehicles/${vehicle.id}`)
      .set("Authorization", `Bearer ${secondOwner.accessToken}`)
      .send({ brand: "Other owner" });
    const wrongCustomerResponse = await request(getHttpServer(app))
      .patch(
        `/customers/${secondCustomer.id.toString()}/vehicles/${vehicle.id}`,
      )
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .send({ brand: "Wrong customer" });

    expect(crossEstablishmentResponse.status).toBe(404);
    expect(wrongCustomerResponse.status).toBe(404);
  });
});
