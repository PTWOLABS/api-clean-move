import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { ServiceFactory } from "../../../../tests/factories/service-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";
import {
  getHttpServer,
  makeEmployeeAuth,
  makeEstablishmentAuth,
} from "../../../../tests/helpers/auth-session.e2e-helpers";

const serviceCategories = [
  "WASH",
  "SANITIZATION",
  "AUTOMATIVE_DETAILING",
  "PROTECTION",
  "UPHOLSTERY",
] as const;

const listServicesResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      establishmentId: z.uuid(),
      name: z.string().min(1),
      description: z.string().min(1).nullable(),
      category: z.enum(serviceCategories).nullable(),
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
    }),
  ),
  totalItems: z.number().int().nonnegative(),
});

describe("ListEstablishmentServicesController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hashGenerator: HashGenerator;
  let userFactory: UserFactory;
  let establishmentFactory: EstablishmentFactory;
  let serviceFactory: ServiceFactory;
  let envService: EnvService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get(PrismaService);
    hashGenerator = moduleRef.get(HashGenerator);
    envService = moduleRef.get(EnvService);
    userFactory = new UserFactory(prisma, hashGenerator);
    establishmentFactory = new EstablishmentFactory(prisma);
    serviceFactory = new ServiceFactory(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should reject requests without an access token", async () => {
    const response = await request(getHttpServer(app)).get(
      "/services/00000000-0000-4000-8000-000000000001",
    );

    expect(response.status).toBe(401);
  });

  it("should return 400 for invalid establishment id", async () => {
    const { accessToken } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .get("/services/not-a-uuid")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
  });

  it("should list services for establishment owner", async () => {
    const { accessToken, establishment } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });

    const response = await request(getHttpServer(app))
      .get(`/services/${establishment.id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    const body = listServicesResponseSchema.parse(response.body);
    expect(body.totalItems).toBeGreaterThanOrEqual(1);
    expect(body.items[0]?.establishmentId).toBe(establishment.id.toString());
  });

  it("should allow employee to list services for their establishment", async () => {
    const { accessToken, establishment } = await makeEmployeeAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
    });

    await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });

    const response = await request(getHttpServer(app))
      .get(`/services/${establishment.id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    listServicesResponseSchema.parse(response.body);
  });

  it("should return 404 when establishment id does not exist", async () => {
    const { accessToken } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .get("/services/00000000-0000-4000-8000-000000000099")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
  });

  it("should return 403 when owner tries to list another establishment services", async () => {
    const { accessToken } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const otherOwner = await userFactory.makePrismaUser({
      role: "ESTABLISHMENT",
      plainPassword: "strong-password",
    });
    const otherEstablishment =
      await establishmentFactory.makePrismaEstablishment({
        ownerId: otherOwner.user.id,
      });

    const response = await request(getHttpServer(app))
      .get(`/services/${otherEstablishment.id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
  });
});
