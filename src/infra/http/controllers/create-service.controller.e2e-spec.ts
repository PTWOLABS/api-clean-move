import { INestApplication } from "@nestjs/common";
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
import { expectSingleMessageResponseWithoutIssues } from "../../../../tests/helpers/http-response-assertions";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { Cnpj } from "../../../modules/establishments/domain/value-objects/cnpj";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";

const serviceCategorySchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1),
  })
  .nullable();

const serviceResponseSchema = z.object({
  id: z.uuid(),
  establishmentId: z.uuid(),
  name: z.string().min(1),
  description: z.string().min(1).nullable(),
  category: serviceCategorySchema,
  estimatedDuration: z
    .object({
      minInMinutes: z.number().int().positive(),
      maxInMinutes: z.number().int().positive().nullable(),
    })
    .nullable(),
  priceInCents: z.number().int().nonnegative(),
  isActive: z.boolean(),
  createdAt: z.string().min(1).nullable(),
  updatedAt: z.string().min(1).nullable(),
});

const createServiceResponseSchema = z.object({
  service: serviceResponseSchema,
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

function makeCreateServicePayload(
  override?: Partial<{
    serviceName: string;
    description: string | undefined;
    categoryId: string | null | undefined;
    estimatedDuration:
      | {
          minInMinutes: number;
          maxInMinutes?: number | null | undefined;
        }
      | undefined;
    price: number;
    isActive: boolean | undefined;
    establishmentId: string | undefined;
  }>,
) {
  return {
    serviceName: "Lavagem premium",
    description: "Lavagem externa com acabamento e brilho.",
    estimatedDuration: {
      minInMinutes: 30,
      maxInMinutes: 60,
    },
    price: 3000,
    isActive: true,
    ...override,
  };
}

async function seedLavagemCategory(
  prisma: PrismaService,
  establishmentId: string,
) {
  return prisma.serviceCategory.create({
    data: {
      establishmentId,
      name: "Lavagem",
    },
  });
}

describe("CreateServiceController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hashGenerator: HashGenerator;
  let userFactory: UserFactory;
  let establishmentFactory: EstablishmentFactory;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get(PrismaService);
    hashGenerator = moduleRef.get(HashGenerator);
    userFactory = new UserFactory(prisma, hashGenerator);
    establishmentFactory = new EstablishmentFactory(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return 401 when trying to create a service without an access token", async () => {
    const response = await request(getHttpServer(app))
      .post("/services")
      .send(makeCreateServicePayload());

    expect(response.status).toBe(401);
    expectSingleMessageResponseWithoutIssues(
      response.body,
      "Missing access token.",
    );
    expect(await prisma.service.count()).toBe(0);
  });

  it("should return 403 when trying to create a service authenticated as a customer", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "CUSTOMER",
      plainPassword: "strong-password",
    });
    const customerLogin = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const response = await request(getHttpServer(app))
      .post("/services")
      .set("Authorization", `Bearer ${customerLogin.loginBody.accessToken}`)
      .send(makeCreateServicePayload());

    expect(response.status).toBe(403);
    expectSingleMessageResponseWithoutIssues(
      response.body,
      "Forbidden resource",
    );
    expect(await prisma.service.count()).toBe(0);
  });

  it("should return 404 when the authenticated establishment user has no establishment profile", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "ESTABLISHMENT",
      plainPassword: "strong-password",
    });
    const establishmentLogin = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const response = await request(getHttpServer(app))
      .post("/services")
      .set(
        "Authorization",
        `Bearer ${establishmentLogin.loginBody.accessToken}`,
      )
      .send(makeCreateServicePayload());

    expect(response.status).toBe(404);
    expectSingleMessageResponseWithoutIssues(
      response.body,
      "Resource not found: Establishment.",
    );
    expect(await prisma.service.count()).toBe(0);
  });

  it("should create a service and persist the full payload for the authenticated establishment", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "ESTABLISHMENT",
      plainPassword: "strong-password",
    });
    const establishment = await establishmentFactory.makePrismaEstablishment({
      ownerId: user.id,
    });
    const category = await seedLavagemCategory(
      prisma,
      establishment.id.toString(),
    );
    const establishmentLogin = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const response = await request(getHttpServer(app))
      .post("/services")
      .set(
        "Authorization",
        `Bearer ${establishmentLogin.loginBody.accessToken}`,
      )
      .send(
        makeCreateServicePayload({
          categoryId: category.id,
        }),
      );
    const responseBody = createServiceResponseSchema.parse(response.body);

    expect(response.status).toBe(201);
    expect(responseBody.service.establishmentId).toBe(
      establishment.id.toString(),
    );
    expect(responseBody.service.name).toBe("Lavagem premium");
    expect(responseBody.service.description).toBe(
      "Lavagem externa com acabamento e brilho.",
    );
    expect(responseBody.service.category).toEqual({
      id: category.id,
      name: "Lavagem",
    });
    expect(responseBody.service.estimatedDuration).toEqual({
      minInMinutes: 30,
      maxInMinutes: 60,
    });
    expect(responseBody.service.priceInCents).toBe(3000);
    expect(responseBody.service.isActive).toBe(true);

    const createdService = await prisma.service.findUnique({
      where: {
        id: responseBody.service.id,
      },
    });

    expect(createdService).not.toBeNull();
    expect(createdService?.establishmentId).toBe(establishment.id.toString());
    expect(createdService?.serviceName).toBe("Lavagem premium");
    expect(createdService?.description).toBe(
      "Lavagem externa com acabamento e brilho.",
    );
    expect(createdService?.categoryId).toBe(category.id);
    expect(createdService?.estimatedDurationMinInMinutes).toBe(30);
    expect(createdService?.estimatedDurationMaxInMinutes).toBe(60);
    expect(createdService?.priceInCents).toBe(3000);
    expect(createdService?.isActive).toBe(true);
  });

  it("should ignore a forged establishmentId in the payload and create the service for the authenticated establishment", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "ESTABLISHMENT",
      plainPassword: "strong-password",
    });
    const { user: anotherUser } = await userFactory.makePrismaUser({
      role: "ESTABLISHMENT",
      plainPassword: "strong-password",
    });
    const authenticatedEstablishment =
      await establishmentFactory.makePrismaEstablishment({
        ownerId: user.id,
      });
    const anotherEstablishment =
      await establishmentFactory.makePrismaEstablishment({
        ownerId: anotherUser.id,
        cnpj: Cnpj.create("41437902000177"),
      });
    const establishmentLogin = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const response = await request(getHttpServer(app))
      .post("/services")
      .set(
        "Authorization",
        `Bearer ${establishmentLogin.loginBody.accessToken}`,
      )
      .send(
        makeCreateServicePayload({
          establishmentId: anotherEstablishment.id.toString(),
        }),
      );
    const responseBody = createServiceResponseSchema.parse(response.body);

    expect(response.status).toBe(201);
    expect(responseBody.service.establishmentId).toBe(
      authenticatedEstablishment.id.toString(),
    );
    expect(responseBody.service.establishmentId).not.toBe(
      anotherEstablishment.id.toString(),
    );

    const createdService = await prisma.service.findUnique({
      where: {
        id: responseBody.service.id,
      },
    });

    expect(createdService?.establishmentId).toBe(
      authenticatedEstablishment.id.toString(),
    );
  });

  it("should create a service without optional fields and persist null values in the response and database", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "ESTABLISHMENT",
      plainPassword: "strong-password",
    });
    const establishment = await establishmentFactory.makePrismaEstablishment({
      ownerId: user.id,
    });
    const establishmentLogin = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const response = await request(getHttpServer(app))
      .post("/services")
      .set(
        "Authorization",
        `Bearer ${establishmentLogin.loginBody.accessToken}`,
      )
      .send(
        makeCreateServicePayload({
          description: undefined,
          categoryId: undefined,
          estimatedDuration: undefined,
        }),
      );
    const responseBody = createServiceResponseSchema.parse(response.body);

    expect(response.status).toBe(201);
    expect(responseBody.service.establishmentId).toBe(
      establishment.id.toString(),
    );
    expect(responseBody.service.description).toBeNull();
    expect(responseBody.service.category).toBeNull();
    expect(responseBody.service.estimatedDuration).toBeNull();

    const createdService = await prisma.service.findUnique({
      where: {
        id: responseBody.service.id,
      },
    });

    expect(createdService).not.toBeNull();
    expect(createdService?.description).toBeNull();
    expect(createdService?.categoryId).toBeNull();
    expect(createdService?.estimatedDurationMinInMinutes).toBeNull();
    expect(createdService?.estimatedDurationMaxInMinutes).toBeNull();
  });

  it("should return 400 when sending an incomplete service payload", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "ESTABLISHMENT",
      plainPassword: "strong-password",
    });
    await establishmentFactory.makePrismaEstablishment({
      ownerId: user.id,
    });
    const establishmentLogin = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const response = await request(getHttpServer(app))
      .post("/services")
      .set(
        "Authorization",
        `Bearer ${establishmentLogin.loginBody.accessToken}`,
      )
      .send({
        ...makeCreateServicePayload(),
        serviceName: undefined,
      });

    expect(response.status).toBe(400);

    const responseBody = validationErrorResponseSchema.parse(response.body);

    expect(responseBody.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_type",
          path: "serviceName",
        }),
      ]),
    );
    expect(await prisma.service.count()).toBe(0);
  });

  it("should return 400 when estimatedDuration minInMinutes is greater than maxInMinutes", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "ESTABLISHMENT",
      plainPassword: "strong-password",
    });
    await establishmentFactory.makePrismaEstablishment({
      ownerId: user.id,
    });
    const establishmentLogin = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const response = await request(getHttpServer(app))
      .post("/services")
      .set(
        "Authorization",
        `Bearer ${establishmentLogin.loginBody.accessToken}`,
      )
      .send(
        makeCreateServicePayload({
          estimatedDuration: {
            minInMinutes: 60,
            maxInMinutes: 30,
          },
        }),
      );

    expect(response.status).toBe(400);
    expectSingleMessageResponseWithoutIssues(
      response.body,
      "minInMinutes cannot be greater than maxInMinutes.",
    );
    expect(await prisma.service.count()).toBe(0);
  });
});
