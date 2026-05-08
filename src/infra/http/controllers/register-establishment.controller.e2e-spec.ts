import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";

const registerEstablishmentResponseSchema = z.object({
  establishmentId: z.uuid(),
});

const singleMessageResponseSchema = z.object({
  message: z.string(),
});

const validationErrorResponseSchema = z.object({
  statusCode: z.literal(400),
  message: z.literal("Validation failed"),
  error: z.literal("Bad Request"),
  issues: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      path: z.string(),
    }),
  ),
  parameter: z.null(),
  target: z.literal("body"),
});

function makeRegisterEstablishmentPayload() {
  return {
    name: "Jon Doe",
    tradeName: "Valid Establishment",
    legalBusinessName: "SOCIAL REASON TEST LTDA",
    email: "jondoe@example.com",
    password: "jondoe@123",
    cnpj: "37.158.666/0001-82",
    phone: "11987654321",
    address: {
      street: "street-1",
      complement: "Sala 2",
      country: "country-1",
      state: "state-1",
      zipCode: "11111-111",
      city: "city-1",
    },
  };
}

function makeAnotherRegisterEstablishmentPayload() {
  return {
    ...makeRegisterEstablishmentPayload(),
    name: "Jane Doe",
    tradeName: "Another Establishment",
    legalBusinessName: "ANOTHER SOCIAL REASON LTDA",
    cnpj: "41.437.902/0001-77",
    phone: "21987654321",
    address: {
      street: "street-2",
      country: "country-2",
      state: "state-2",
      zipCode: "22222-222",
      city: "city-2",
    },
  };
}

function getHttpServer(app: INestApplication): Parameters<typeof request>[0] {
  return app.getHttpServer() as Parameters<typeof request>[0];
}

describe("RegisterEstablishmentController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should register an establishment and persist the data", async () => {
    const response = await request(getHttpServer(app))
      .post("/register/establishment")
      .send(makeRegisterEstablishmentPayload());

    expect(response.status).toBe(201);

    const responseBody = registerEstablishmentResponseSchema.parse(
      response.body,
    );

    expect(responseBody.establishmentId).toEqual(expect.any(String));

    const createdUser = await prisma.user.findUnique({
      where: {
        email: "jondoe@example.com",
      },
    });

    const createdEstablishment = await prisma.establishment.findUnique({
      where: {
        id: responseBody.establishmentId,
      },
    });

    expect(createdUser).not.toBeNull();
    expect(createdUser?.role).toBe("ESTABLISHMENT");
    expect(createdUser?.address).toMatchObject({
      street: "street-1",
      complement: "Sala 2",
      country: "country-1",
      state: "state-1",
      zipCode: "11111-111",
      city: "city-1",
    });
    expect(createdEstablishment).not.toBeNull();
    expect(createdEstablishment?.slug).toBe("valid-establishment");
    expect(createdEstablishment?.operatingHours).toEqual({ days: [] });
  });

  it("should return 400 when sending an invalid establishment payload", async () => {
    const response = await request(getHttpServer(app))
      .post("/register/establishment")
      .send({
        ...makeRegisterEstablishmentPayload(),
        cnpj: "05027115000191",
      });

    expect(response.status).toBe(400);

    const responseBody = singleMessageResponseSchema.parse(response.body);

    expect(responseBody.message).toBe("Invalid CNPJ: 05027115000191");

    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.establishment.count()).toBe(0);
  });

  it("should return 400 when sending an incomplete establishment payload", async () => {
    const incompletePayload = {
      ...makeRegisterEstablishmentPayload(),
      tradeName: undefined,
    };

    const response = await request(getHttpServer(app))
      .post("/register/establishment")
      .send(incompletePayload);

    expect(response.status).toBe(400);

    const responseBody = validationErrorResponseSchema.parse(response.body);

    expect(responseBody.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_type",
          path: "tradeName",
        }),
      ]),
    );

    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.establishment.count()).toBe(0);
  });

  it("should return 409 when trying to register an establishment with an email that already exists", async () => {
    const firstResponse = await request(getHttpServer(app))
      .post("/register/establishment")
      .send(makeRegisterEstablishmentPayload());

    expect(firstResponse.status).toBe(201);

    const response = await request(getHttpServer(app))
      .post("/register/establishment")
      .send(makeAnotherRegisterEstablishmentPayload());

    expect(response.status).toBe(409);

    const responseBody = singleMessageResponseSchema.parse(response.body);

    expect(responseBody.message).toBe("Establishment already registered.");

    expect(
      await prisma.user.count({
        where: {
          email: "jondoe@example.com",
        },
      }),
    ).toBe(1);
    expect(await prisma.establishment.count()).toBe(1);
    expect(
      await prisma.establishment.findUnique({
        where: {
          cnpj: "41437902000177",
        },
      }),
    ).toBeNull();
  });

  it("should start each test with a clean database", async () => {
    const response = await request(getHttpServer(app))
      .post("/register/establishment")
      .send(makeRegisterEstablishmentPayload());

    expect(response.status).toBe(201);
  });
});
