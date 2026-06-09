import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

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

const serviceCategories = [
  "WASH",
  "SANITIZATION",
  "AUTOMATIVE_DETAILING",
  "PROTECTION",
  "UPHOLSTERY",
] as const;

const onboardingResponseSchema = z.object({
  establishment: z.object({
    id: z.uuid(),
    tradeName: z.string().nullable(),
    legalBusinessName: z.string().nullable(),
    cnpj: z.string().nullable(),
    slug: z.string().nullable(),
    bannerImageUrl: z.string().nullable(),
  }),
  service: z
    .object({
      id: z.uuid(),
      establishmentId: z.uuid(),
      name: z.string(),
      description: z.string().nullable(),
      category: z.enum(serviceCategories).nullable(),
      estimatedDuration: z
        .object({
          minInMinutes: z.number().int().positive(),
          maxInMinutes: z.number().int().positive().nullable(),
        })
        .nullable(),
      priceInCents: z.number().int().nonnegative(),
      isActive: z.boolean(),
      createdAt: z.string().nullable(),
      updatedAt: z.string().nullable(),
    })
    .nullable(),
  customer: z
    .object({
      id: z.uuid(),
      establishmentId: z.uuid(),
      cpfCnpj: z.string().nullable(),
      documentType: z.enum(["CPF", "CNPJ"]).nullable(),
      fullName: z.string(),
      phone: z.string(),
      email: z.email().nullable(),
      address: z
        .object({
          street: z.string(),
          complement: z.string().optional(),
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
    })
    .nullable(),
  vehicle: z
    .object({
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
    })
    .nullable(),
});

function makeOnboardingPayload() {
  return {
    establishment: {
      tradeName: "Clean Move",
      legalBusinessName: "Clean Move Servicos LTDA",
      cnpj: "61911322000187",
    },
    service: {
      serviceName: "Lavagem premium",
      description: "Lavagem externa com acabamento e brilho.",
      category: "WASH",
      estimatedDuration: {
        minInMinutes: 30,
        maxInMinutes: 60,
      },
      price: 3000,
      isActive: true,
    },
    customer: {
      fullName: "Maria Silva",
      phone: "11999999999",
      email: "maria@example.com",
      cpfCnpj: "529.982.247-25",
    },
    vehicle: {
      plate: "abc-1d23",
      brand: "Toyota",
      model: "Corolla",
      color: "Prata",
      year: 2022,
      notes: "Veiculo principal",
    },
  };
}

describe("CompleteOnboardingController (e2e)", () => {
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

  it("should update establishment and create optional onboarding resources", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .post("/onboarding")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(makeOnboardingPayload());
    const body = onboardingResponseSchema.parse(response.body);

    expect(response.status).toBe(201);
    expect(body.establishment.id).toBe(establishment.id.toString());
    expect(body.establishment.tradeName).toBe("Clean Move");
    expect(body.establishment.legalBusinessName).toBe(
      "Clean Move Servicos LTDA",
    );
    expect(body.establishment.cnpj).toBe("61911322000187");
    expect(body.service?.establishmentId).toBe(establishment.id.toString());
    expect(body.service?.name).toBe("Lavagem premium");
    expect(body.service?.priceInCents).toBe(3000);
    expect(body.service?.estimatedDuration).toEqual({
      minInMinutes: 30,
      maxInMinutes: 60,
    });
    expect(body.customer?.fullName).toBe("Maria Silva");
    expect(body.customer?.phone).toBe("11999999999");
    expect(body.vehicle?.customerId).toBe(body.customer?.id);
    expect(body.vehicle?.plate).toBe("ABC1D23");

    expect(
      await prisma.service.count({
        where: { establishmentId: establishment.id.toString() },
      }),
    ).toBe(1);
    expect(
      await prisma.customer.count({
        where: { establishmentId: establishment.id.toString() },
      }),
    ).toBe(1);
    expect(
      await prisma.customerVehicle.count({
        where: { establishmentId: establishment.id.toString() },
      }),
    ).toBe(1);
  });

  it("should skip optional resource creation when sections are omitted or empty", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .post("/onboarding")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        service: {},
        customer: {},
        vehicle: {},
      });
    const body = onboardingResponseSchema.parse(response.body);

    expect(response.status).toBe(201);
    expect(body.establishment.id).toBe(establishment.id.toString());
    expect(body.service).toBeNull();
    expect(body.customer).toBeNull();
    expect(body.vehicle).toBeNull();
  });

  it("should reject service data without the required service fields", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .post("/onboarding")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        service: {
          serviceName: "Lavagem premium",
        },
      });

    expect(response.status).toBe(400);
  });

  it("should reject vehicle data without customer data", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .post("/onboarding")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        vehicle: {
          plate: "def-4g56",
        },
      });

    expect(response.status).toBe(400);
  });

  it("should reject customer data without name and phone", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .post("/onboarding")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        customer: {
          email: "maria@example.com",
        },
      });

    expect(response.status).toBe(400);
  });

  it("should enforce authentication and establishment role", async () => {
    const establishmentRole = await makeEstablishmentAccessToken({
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

    const noTokenResponse = await request(getHttpServer(app))
      .post("/onboarding")
      .send(makeOnboardingPayload());
    const invalidTokenResponse = await request(getHttpServer(app))
      .post("/onboarding")
      .set("Authorization", "Bearer invalid-token")
      .send(makeOnboardingPayload());
    const expiredTokenResponse = await request(getHttpServer(app))
      .post("/onboarding")
      .set("Authorization", `Bearer ${establishmentRole.expiredAccessToken}`)
      .send(makeOnboardingPayload());
    const customerRoleResponse = await request(getHttpServer(app))
      .post("/onboarding")
      .set("Authorization", `Bearer ${customerRole.accessToken}`)
      .send(makeOnboardingPayload());

    expect(noTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.status).toBe(401);
    expect(expiredTokenResponse.status).toBe(401);
    expect(customerRoleResponse.status).toBe(403);
  });
});
