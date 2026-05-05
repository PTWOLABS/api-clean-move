import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

import { CustomerFactory } from "../../../../tests/factories/customer-factory";
import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  getHttpServer,
  makeCustomerAccessToken,
  makeEstablishmentAccessToken,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

const vehicleResponseSchema = z.object({
  vehicle: z.object({
    id: z.uuid(),
    establishmentId: z.uuid(),
    customerId: z.uuid(),
    imageUrl: z.string().nullable(),
    plate: z.string().nullable(),
    brand: z.string().nullable(),
    model: z.string().nullable(),
    color: z.string().nullable(),
    year: z.number().int().nullable(),
    notes: z.string().nullable(),
    deletedAt: z.string().nullable(),
    createdAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }),
});

const listVehiclesResponseSchema = z.object({
  vehicles: z.array(vehicleResponseSchema.shape.vehicle),
});

function validVehiclePayload(plate = "abc-1d23") {
  return {
    plate,
    brand: "Toyota",
    model: "Corolla",
    color: "Prata",
    year: 2022,
    notes: "Veiculo principal",
  };
}

describe("Customer vehicle controllers (e2e)", () => {
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

  it("should create, list, update and delete a customer vehicle", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
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

    const createResponse = await request(getHttpServer(app))
      .post(`/customers/${customer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validVehiclePayload());
    const createBody = vehicleResponseSchema.parse(createResponse.body);

    expect(createResponse.status).toBe(201);
    expect(createBody.vehicle.establishmentId).toBe(
      establishment.id.toString(),
    );
    expect(createBody.vehicle.customerId).toBe(customer.id.toString());
    expect(createBody.vehicle.plate).toBe("ABC1D23");

    const listResponse = await request(getHttpServer(app))
      .get(`/customers/${customer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${accessToken}`);
    const listBody = listVehiclesResponseSchema.parse(listResponse.body);

    expect(listResponse.status).toBe(200);
    expect(listBody.vehicles).toHaveLength(1);
    expect(listBody.vehicles[0]?.id).toBe(createBody.vehicle.id);

    const updateResponse = await request(getHttpServer(app))
      .patch(
        `/customers/${customer.id.toString()}/vehicles/${createBody.vehicle.id}`,
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        plate: "xyz-9a87",
        brand: "Honda",
        notes: null,
      });
    const updateBody = vehicleResponseSchema.parse(updateResponse.body);

    expect(updateResponse.status).toBe(200);
    expect(updateBody.vehicle.plate).toBe("XYZ9A87");
    expect(updateBody.vehicle.brand).toBe("Honda");
    expect(updateBody.vehicle.notes).toBeNull();

    const deleteResponse = await request(getHttpServer(app))
      .delete(
        `/customers/${customer.id.toString()}/vehicles/${createBody.vehicle.id}`,
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(deleteResponse.status).toBe(204);

    const deletedVehicle = await prisma.customerVehicle.findUnique({
      where: {
        id: createBody.vehicle.id,
      },
    });

    expect(deletedVehicle?.deletedAt).toBeInstanceOf(Date);
  });

  it("should enforce authentication and establishment role on all vehicle endpoints", async () => {
    const { accessToken, expiredAccessToken, establishment } =
      await makeEstablishmentAccessToken({
        app,
        prisma,
        userFactory,
        establishmentFactory,
        envService,
      });
    const customerRole = await makeCustomerAccessToken({
      app,
      prisma,
      userFactory,
    });
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const createResponse = await request(getHttpServer(app))
      .post(`/customers/${customer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validVehiclePayload());
    const vehicleId = vehicleResponseSchema.parse(createResponse.body).vehicle
      .id;

    const endpoints = [
      {
        withoutToken: () =>
          request(getHttpServer(app))
            .post(`/customers/${customer.id.toString()}/vehicles`)
            .send(validVehiclePayload("def-4g56")),
        withToken: (token: string) =>
          request(getHttpServer(app))
            .post(`/customers/${customer.id.toString()}/vehicles`)
            .set("Authorization", `Bearer ${token}`)
            .send(validVehiclePayload("def-4g56")),
      },
      {
        withoutToken: () =>
          request(getHttpServer(app)).get(
            `/customers/${customer.id.toString()}/vehicles`,
          ),
        withToken: (token: string) =>
          request(getHttpServer(app))
            .get(`/customers/${customer.id.toString()}/vehicles`)
            .set("Authorization", `Bearer ${token}`),
      },
      {
        withoutToken: () =>
          request(getHttpServer(app))
            .patch(`/customers/${customer.id.toString()}/vehicles/${vehicleId}`)
            .send({ brand: "Unauthorized" }),
        withToken: (token: string) =>
          request(getHttpServer(app))
            .patch(`/customers/${customer.id.toString()}/vehicles/${vehicleId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ brand: "Unauthorized" }),
      },
      {
        withoutToken: () =>
          request(getHttpServer(app)).delete(
            `/customers/${customer.id.toString()}/vehicles/${vehicleId}`,
          ),
        withToken: (token: string) =>
          request(getHttpServer(app))
            .delete(
              `/customers/${customer.id.toString()}/vehicles/${vehicleId}`,
            )
            .set("Authorization", `Bearer ${token}`),
      },
    ];

    for (const endpoint of endpoints) {
      const noTokenResponse = await endpoint.withoutToken();
      const invalidTokenResponse = await endpoint.withToken("invalid-token");
      const expiredTokenResponse = await endpoint.withToken(expiredAccessToken);
      const customerRoleResponse = await endpoint.withToken(
        customerRole.accessToken,
      );

      expect(noTokenResponse.status).toBe(401);
      expect(invalidTokenResponse.status).toBe(401);
      expect(expiredTokenResponse.status).toBe(401);
      expect(customerRoleResponse.status).toBe(403);
    }
  });

  it("should reject invalid vehicle payloads and route params", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
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
    const createResponse = await request(getHttpServer(app))
      .post(`/customers/${customer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validVehiclePayload());
    const vehicleId = vehicleResponseSchema.parse(createResponse.body).vehicle
      .id;

    const invalidCustomerIdResponse = await request(getHttpServer(app))
      .post("/customers/not-a-uuid/vehicles")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validVehiclePayload("def-4g56"));
    const invalidVehicleIdResponse = await request(getHttpServer(app))
      .patch(`/customers/${customer.id.toString()}/vehicles/not-a-uuid`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ brand: "Honda" });
    const invalidPlateResponse = await request(getHttpServer(app))
      .post(`/customers/${customer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validVehiclePayload("abc"));
    const emptyUpdateResponse = await request(getHttpServer(app))
      .patch(`/customers/${customer.id.toString()}/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(invalidCustomerIdResponse.status).toBe(400);
    expect(invalidVehicleIdResponse.status).toBe(400);
    expect(invalidPlateResponse.status).toBe(400);
    expect(emptyUpdateResponse.status).toBe(400);
  });

  it("should reject duplicate active vehicle plates inside the same establishment", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
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

    const firstResponse = await request(getHttpServer(app))
      .post(`/customers/${customer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validVehiclePayload());
    const duplicateResponse = await request(getHttpServer(app))
      .post(`/customers/${customer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validVehiclePayload("abc-1d23"));

    expect(firstResponse.status).toBe(201);
    expect(duplicateResponse.status).toBe(409);
  });

  it("should not expose or mutate vehicles through another establishment or customer", async () => {
    const firstOwner = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const secondOwner = await makeEstablishmentAccessToken({
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
    const createResponse = await request(getHttpServer(app))
      .post(`/customers/${firstCustomer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .send(validVehiclePayload());
    const vehicleId = vehicleResponseSchema.parse(createResponse.body).vehicle
      .id;

    const crossEstablishmentCreateResponse = await request(getHttpServer(app))
      .post(`/customers/${firstCustomer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${secondOwner.accessToken}`)
      .send(validVehiclePayload("def-4g56"));
    const crossEstablishmentListResponse = await request(getHttpServer(app))
      .get(`/customers/${firstCustomer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${secondOwner.accessToken}`);
    const crossEstablishmentUpdateResponse = await request(getHttpServer(app))
      .patch(`/customers/${firstCustomer.id.toString()}/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${secondOwner.accessToken}`)
      .send({ brand: "Other owner" });
    const crossEstablishmentDeleteResponse = await request(getHttpServer(app))
      .delete(`/customers/${firstCustomer.id.toString()}/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${secondOwner.accessToken}`);
    const wrongCustomerListResponse = await request(getHttpServer(app))
      .get(`/customers/${secondCustomer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${firstOwner.accessToken}`);
    const wrongCustomerUpdateResponse = await request(getHttpServer(app))
      .patch(`/customers/${secondCustomer.id.toString()}/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .send({ brand: "Wrong customer" });
    const wrongCustomerDeleteResponse = await request(getHttpServer(app))
      .delete(
        `/customers/${secondCustomer.id.toString()}/vehicles/${vehicleId}`,
      )
      .set("Authorization", `Bearer ${firstOwner.accessToken}`);
    const wrongCustomerListBody = listVehiclesResponseSchema.parse(
      wrongCustomerListResponse.body,
    );

    expect(crossEstablishmentCreateResponse.status).toBe(404);
    expect(crossEstablishmentListResponse.status).toBe(404);
    expect(crossEstablishmentUpdateResponse.status).toBe(404);
    expect(crossEstablishmentDeleteResponse.status).toBe(404);
    expect(wrongCustomerListResponse.status).toBe(200);
    expect(wrongCustomerListBody.vehicles).toHaveLength(0);
    expect(wrongCustomerUpdateResponse.status).toBe(404);
    expect(wrongCustomerDeleteResponse.status).toBe(404);
  });
});
