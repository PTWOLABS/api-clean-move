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

describe("DeleteCustomerVehicleController (e2e)", () => {
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

  it("should soft delete a vehicle and hide it from active listings", async () => {
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

    const deleteResponse = await request(getHttpServer(app))
      .delete(`/customers/${customer.id.toString()}/vehicles/${vehicle.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const listResponse = await request(getHttpServer(app))
      .get(`/customers/${customer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${accessToken}`);
    const deletedVehicle = await prisma.customerVehicle.findUnique({
      where: {
        id: vehicle.id,
      },
    });
    const listBody = listVehiclesResponseSchema.parse(listResponse.body);

    expect(deleteResponse.status).toBe(204);
    expect(deletedVehicle?.deletedAt).toBeInstanceOf(Date);
    expect(listBody.vehicles).toHaveLength(0);
  });

  it("should enforce authentication and establishment role", async () => {
    const { expiredAccessToken, establishment } = await makeEstablishmentAuth({
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

    const noTokenResponse = await request(getHttpServer(app)).delete(
      `/customers/${customer.id.toString()}/vehicles/${vehicle.id}`,
    );
    const invalidTokenResponse = await request(getHttpServer(app))
      .delete(`/customers/${customer.id.toString()}/vehicles/${vehicle.id}`)
      .set("Authorization", "Bearer invalid-token");
    const expiredTokenResponse = await request(getHttpServer(app))
      .delete(`/customers/${customer.id.toString()}/vehicles/${vehicle.id}`)
      .set("Authorization", `Bearer ${expiredAccessToken}`);
    const customerRoleResponse = await request(getHttpServer(app))
      .delete(`/customers/${customer.id.toString()}/vehicles/${vehicle.id}`)
      .set("Authorization", `Bearer ${customerRole.accessToken}`);

    expect(noTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.status).toBe(401);
    expect(expiredTokenResponse.status).toBe(401);
    expect(customerRoleResponse.status).toBe(403);
  });

  it("should reject invalid customer or vehicle ids", async () => {
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
      .delete(`/customers/not-a-uuid/vehicles/${vehicle.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const invalidVehicleIdResponse = await request(getHttpServer(app))
      .delete(`/customers/${customer.id.toString()}/vehicles/not-a-uuid`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(invalidCustomerIdResponse.status).toBe(400);
    expect(invalidVehicleIdResponse.status).toBe(400);
  });

  it("should not delete vehicles from another establishment or customer", async () => {
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
      .delete(
        `/customers/${firstCustomer.id.toString()}/vehicles/${vehicle.id}`,
      )
      .set("Authorization", `Bearer ${secondOwner.accessToken}`);
    const wrongCustomerResponse = await request(getHttpServer(app))
      .delete(
        `/customers/${secondCustomer.id.toString()}/vehicles/${vehicle.id}`,
      )
      .set("Authorization", `Bearer ${firstOwner.accessToken}`);

    expect(crossEstablishmentResponse.status).toBe(404);
    expect(wrongCustomerResponse.status).toBe(404);
  });

  it("should reject deleting an already deleted vehicle", async () => {
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

    const firstDeleteResponse = await request(getHttpServer(app))
      .delete(`/customers/${customer.id.toString()}/vehicles/${vehicle.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const secondDeleteResponse = await request(getHttpServer(app))
      .delete(`/customers/${customer.id.toString()}/vehicles/${vehicle.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(firstDeleteResponse.status).toBe(204);
    expect(secondDeleteResponse.status).toBe(404);
  });
});
