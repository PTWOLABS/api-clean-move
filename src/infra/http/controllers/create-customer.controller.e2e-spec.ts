import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  getHttpServer,
  loginUser,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

const customerResponseSchema = z.object({
  customer: z.object({
    id: z.uuid(),
    establishmentId: z.uuid(),
    cpfCnpj: z.string().nullable(),
    documentType: z.enum(["CPF", "CNPJ"]).nullable(),
    fullName: z.string(),
    phone: z.string(),
    email: z.email(),
    address: z
      .object({
        street: z.string(),
        country: z.string(),
        state: z.string(),
        zipCode: z.string(),
        city: z.string(),
      })
      .nullable(),
    birthDate: z.string().nullable(),
    nickname: z.string().nullable(),
    deletedAt: z.string().nullable(),
    createdAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }),
});

const listCustomersResponseSchema = z.object({
  customers: z.array(customerResponseSchema.shape.customer),
});

function validCustomerPayload(cpfCnpj = "529.982.247-25") {
  return {
    cpfCnpj,
    fullName: "Maria Silva",
    phone: "11999999999",
    email: "maria@example.com",
    address: {
      street: "Rua A",
      country: "Brasil",
      state: "SP",
      zipCode: "01001-000",
      city: "Sao Paulo",
    },
    birthDate: "1990-01-01T00:00:00.000Z",
    nickname: "Maria",
  };
}

async function makeEstablishmentAccessToken({
  app,
  prisma,
  userFactory,
  establishmentFactory,
  envService,
}: {
  app: INestApplication;
  prisma: PrismaService;
  userFactory: UserFactory;
  establishmentFactory: EstablishmentFactory;
  envService: EnvService;
}) {
  const { user, plainPassword } = await userFactory.makePrismaUser({
    role: "ESTABLISHMENT",
    plainPassword: "strong-password",
  });
  const establishment = await establishmentFactory.makePrismaEstablishment({
    ownerId: user.id,
  });
  const login = await loginUser({
    app,
    prisma,
    userId: user.id.toString(),
    email: user.email.toString(),
    password: plainPassword ?? "",
  });
  const expiredAccessToken = await new JwtService({
    secret: envService.get("JWT_ACCESS_SECRET"),
  }).signAsync(
    {
      sub: user.id.toString(),
      role: user.role,
      sid: login.sessionId,
      type: "access",
    },
    {
      expiresIn: "-1s",
    },
  );

  return {
    accessToken: login.loginBody.accessToken,
    expiredAccessToken,
    establishment,
  };
}

async function makeCustomerAccessToken({
  app,
  prisma,
  userFactory,
}: {
  app: INestApplication;
  prisma: PrismaService;
  userFactory: UserFactory;
}) {
  const { user, plainPassword } = await userFactory.makePrismaUser({
    role: "CUSTOMER",
    plainPassword: "strong-password",
  });
  const login = await loginUser({
    app,
    prisma,
    userId: user.id.toString(),
    email: user.email.toString(),
    password: plainPassword ?? "",
  });

  return {
    accessToken: login.loginBody.accessToken,
  };
}

describe("Customer controllers (e2e)", () => {
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

  it("should create, list, update and delete establishment customers", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
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
    const createBody = customerResponseSchema.parse(createResponse.body);

    expect(createResponse.status).toBe(201);
    expect(createBody.customer.establishmentId).toBe(
      establishment.id.toString(),
    );
    expect(createBody.customer.cpfCnpj).toBe("52998224725");
    expect(createBody.customer.documentType).toBe("CPF");

    const listResponse = await request(getHttpServer(app))
      .get("/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ search: "maria" });
    const listBody = listCustomersResponseSchema.parse(listResponse.body);

    expect(listResponse.status).toBe(200);
    expect(listBody.customers).toHaveLength(1);
    expect(listBody.customers[0]?.id).toBe(createBody.customer.id);

    const updateResponse = await request(getHttpServer(app))
      .patch(`/customers/${createBody.customer.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "Maria Oliveira",
        nickname: null,
      });
    const updateBody = customerResponseSchema.parse(updateResponse.body);

    expect(updateResponse.status).toBe(200);
    expect(updateBody.customer.fullName).toBe("Maria Oliveira");
    expect(updateBody.customer.nickname).toBeNull();

    const deleteResponse = await request(getHttpServer(app))
      .delete(`/customers/${createBody.customer.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(deleteResponse.status).toBe(204);

    const deletedCustomer = await prisma.customer.findUnique({
      where: {
        id: createBody.customer.id,
      },
    });

    expect(deletedCustomer?.deletedAt).toBeInstanceOf(Date);
  });

  it("should enforce authentication and establishment role on all customer endpoints", async () => {
    const { accessToken, expiredAccessToken } =
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
    const createResponse = await request(getHttpServer(app))
      .post("/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validCustomerPayload());
    const customerId = customerResponseSchema.parse(createResponse.body)
      .customer.id;

    const endpoints = [
      {
        withoutToken: () =>
          request(getHttpServer(app))
            .post("/customers")
            .send(validCustomerPayload("111.444.777-35")),
        withToken: (token: string) =>
          request(getHttpServer(app))
            .post("/customers")
            .set("Authorization", `Bearer ${token}`)
            .send(validCustomerPayload("111.444.777-35")),
      },
      {
        withoutToken: () => request(getHttpServer(app)).get("/customers"),
        withToken: (token: string) =>
          request(getHttpServer(app))
            .get("/customers")
            .set("Authorization", `Bearer ${token}`),
      },
      {
        withoutToken: () =>
          request(getHttpServer(app))
            .patch(`/customers/${customerId}`)
            .send({ fullName: "Unauthorized" }),
        withToken: (token: string) =>
          request(getHttpServer(app))
            .patch(`/customers/${customerId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ fullName: "Unauthorized" }),
      },
      {
        withoutToken: () =>
          request(getHttpServer(app)).delete(`/customers/${customerId}`),
        withToken: (token: string) =>
          request(getHttpServer(app))
            .delete(`/customers/${customerId}`)
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

  it("should reject invalid customer payloads", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
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

    const missingRequiredResponse = await request(getHttpServer(app))
      .post("/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        phone: "11999999999",
        email: "missing-name@example.com",
      });
    const invalidEmailResponse = await request(getHttpServer(app))
      .post("/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...validCustomerPayload("111.444.777-35"),
        email: "not-an-email",
      });
    const invalidUuidResponse = await request(getHttpServer(app))
      .patch("/customers/not-a-uuid")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ fullName: "Invalid UUID" });
    const emptyUpdateResponse = await request(getHttpServer(app))
      .patch(`/customers/${customerId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(missingRequiredResponse.status).toBe(400);
    expect(invalidEmailResponse.status).toBe(400);
    expect(invalidUuidResponse.status).toBe(400);
    expect(emptyUpdateResponse.status).toBe(400);
  });

  it("should enforce cpfCnpj uniqueness only inside the same establishment", async () => {
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
    const payload = validCustomerPayload();

    const firstResponse = await request(getHttpServer(app))
      .post("/customers")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .send(payload);
    const duplicateResponse = await request(getHttpServer(app))
      .post("/customers")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .send(payload);
    const otherEstablishmentResponse = await request(getHttpServer(app))
      .post("/customers")
      .set("Authorization", `Bearer ${secondOwner.accessToken}`)
      .send(payload);

    expect(firstResponse.status).toBe(201);
    expect(duplicateResponse.status).toBe(409);
    expect(otherEstablishmentResponse.status).toBe(201);
  });

  it("should not expose or mutate customers from another establishment", async () => {
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
    const createResponse = await request(getHttpServer(app))
      .post("/customers")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .send(validCustomerPayload());
    const customerId = customerResponseSchema.parse(createResponse.body)
      .customer.id;

    const listResponse = await request(getHttpServer(app))
      .get("/customers")
      .set("Authorization", `Bearer ${secondOwner.accessToken}`);
    const updateResponse = await request(getHttpServer(app))
      .patch(`/customers/${customerId}`)
      .set("Authorization", `Bearer ${secondOwner.accessToken}`)
      .send({ fullName: "Other owner" });
    const deleteResponse = await request(getHttpServer(app))
      .delete(`/customers/${customerId}`)
      .set("Authorization", `Bearer ${secondOwner.accessToken}`);
    const listBody = listCustomersResponseSchema.parse(listResponse.body);

    expect(listResponse.status).toBe(200);
    expect(listBody.customers).toHaveLength(0);
    expect(updateResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);
  });
});
