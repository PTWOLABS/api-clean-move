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

describe("DeleteCustomerController (e2e)", () => {
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

  it("should soft delete a customer and hide it from active listings", async () => {
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

    const deleteResponse = await request(getHttpServer(app))
      .delete(`/customers/${customerId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const listResponse = await request(getHttpServer(app))
      .get("/customers")
      .set("Authorization", `Bearer ${accessToken}`);
    const deletedCustomer = await prisma.customer.findUnique({
      where: {
        id: customerId,
      },
    });
    const listBody = listCustomersResponseSchema.parse(listResponse.body);

    expect(deleteResponse.status).toBe(204);
    expect(deletedCustomer?.deletedAt).toBeInstanceOf(Date);
    expect(listBody.customers).toHaveLength(0);
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

    const noTokenResponse = await request(getHttpServer(app)).delete(
      `/customers/${customerId}`,
    );
    const invalidTokenResponse = await request(getHttpServer(app))
      .delete(`/customers/${customerId}`)
      .set("Authorization", "Bearer invalid-token");
    const expiredTokenResponse = await request(getHttpServer(app))
      .delete(`/customers/${customerId}`)
      .set("Authorization", `Bearer ${expiredAccessToken}`);
    const customerRoleResponse = await request(getHttpServer(app))
      .delete(`/customers/${customerId}`)
      .set("Authorization", `Bearer ${customerRole.accessToken}`);

    expect(noTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.status).toBe(401);
    expect(expiredTokenResponse.status).toBe(401);
    expect(customerRoleResponse.status).toBe(403);
  });

  it("should reject invalid customer ids", async () => {
    const { accessToken } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .delete("/customers/not-a-uuid")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
  });

  it("should not delete customers from another establishment", async () => {
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

    const response = await request(getHttpServer(app))
      .delete(`/customers/${customerId}`)
      .set("Authorization", `Bearer ${secondOwner.accessToken}`);

    expect(response.status).toBe(404);
  });

  it("should reject deleting an already deleted customer", async () => {
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

    const firstDeleteResponse = await request(getHttpServer(app))
      .delete(`/customers/${customerId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const secondDeleteResponse = await request(getHttpServer(app))
      .delete(`/customers/${customerId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(firstDeleteResponse.status).toBe(204);
    expect(secondDeleteResponse.status).toBe(404);
  });
});
