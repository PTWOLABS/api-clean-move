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
  makeCustomerAccessToken,
  makeEstablishmentAccessToken,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

const onboardingResponseSchema = z.object({
  onboarding: z.object({
    establishmentUpdated: z.boolean(),
    serviceCreated: z.boolean(),
    customerCreated: z.boolean(),
    vehicleCreated: z.boolean(),
    appointmentCreated: z.boolean(),
  }),
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
    appointment: {
      startsAt: "2026-06-10T14:00:00.000Z",
      endsAt: "2026-06-10T15:00:00.000Z",
      description: "Primeiro atendimento",
      discountInCents: 500,
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

  async function makeDraftEstablishmentAuth() {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "ESTABLISHMENT",
      plainPassword: "strong-password",
    });
    const establishment =
      await establishmentFactory.makePrismaOAuthDraftEstablishment({
        ownerId: user.id,
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
      establishment,
    };
  }

  afterAll(async () => {
    await app.close();
  });

  it("should update establishment and create optional onboarding resources", async () => {
    const { accessToken, establishment } = await makeDraftEstablishmentAuth();

    const response = await request(getHttpServer(app))
      .post("/onboarding")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(makeOnboardingPayload());
    const body = onboardingResponseSchema.parse(response.body);

    expect(response.status).toBe(201);
    expect(body.onboarding).toEqual({
      establishmentUpdated: true,
      serviceCreated: true,
      customerCreated: true,
      vehicleCreated: true,
      appointmentCreated: true,
    });

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
    expect(
      await prisma.appointment.count({
        where: { establishmentId: establishment.id.toString() },
      }),
    ).toBe(1);

    const updatedEstablishment = await prisma.establishment.findUnique({
      where: { id: establishment.id.toString() },
    });
    const createdService = await prisma.service.findFirst({
      where: { establishmentId: establishment.id.toString() },
    });
    const createdCustomer = await prisma.customer.findFirst({
      where: { establishmentId: establishment.id.toString() },
    });
    const createdVehicle = await prisma.customerVehicle.findFirst({
      where: { establishmentId: establishment.id.toString() },
    });
    const createdAppointment = await prisma.appointment.findFirst({
      where: { establishmentId: establishment.id.toString() },
      include: { bookedServices: true },
    });

    expect(updatedEstablishment?.tradeName).toBe("Clean Move");
    expect(updatedEstablishment?.legalBusinessName).toBe(
      "Clean Move Servicos LTDA",
    );
    expect(updatedEstablishment?.cnpj).toBe("61911322000187");
    expect(updatedEstablishment?.onboardingCompletedAt).toBeInstanceOf(Date);
    expect(createdService?.serviceName).toBe("Lavagem premium");
    expect(createdCustomer?.fullName).toBe("Maria Silva");
    expect(createdVehicle?.customerId).toBe(createdCustomer?.id);
    expect(createdAppointment?.customerId).toBe(createdCustomer?.id);
    expect(createdAppointment?.vehicleId).toBe(createdVehicle?.id);
    expect(createdAppointment?.bookedServices[0]?.serviceId).toBe(
      createdService?.id,
    );
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
        appointment: {},
      });
    const body = onboardingResponseSchema.parse(response.body);

    expect(response.status).toBe(201);
    expect(body.onboarding).toEqual({
      establishmentUpdated: false,
      serviceCreated: false,
      customerCreated: false,
      vehicleCreated: false,
      appointmentCreated: false,
    });

    const updatedEstablishment = await prisma.establishment.findUnique({
      where: { id: establishment.id.toString() },
    });

    expect(updatedEstablishment?.onboardingCompletedAt).toBeInstanceOf(Date);
  });

  it("should reject establishment commercial updates when company data already exists", async () => {
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
        establishment: {
          tradeName: "Should Not Change",
        },
      });

    const unchangedEstablishment = await prisma.establishment.findUnique({
      where: { id: establishment.id.toString() },
    });

    expect(response.status).toBe(400);
    expect(unchangedEstablishment?.tradeName).toBe(establishment.tradeName);
    expect(unchangedEstablishment?.onboardingCompletedAt).toBeNull();
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

  it("should reject appointment data without service and customer data", async () => {
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
        appointment: {
          startsAt: "2026-06-10T14:00:00.000Z",
        },
      });

    expect(response.status).toBe(400);
  });

  it("should reject appointment data without startsAt", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const payload = makeOnboardingPayload();
    delete (payload.appointment as Partial<typeof payload.appointment>)
      .startsAt;

    const response = await request(getHttpServer(app))
      .post("/onboarding")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(payload);

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
