import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { CustomerFactory } from "../../../../tests/factories/customer-factory";
import { makeAppointment } from "../../../../tests/factories/appointment-factory";
import { ServiceFactory } from "../../../../tests/factories/service-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  getHttpServer,
  makeCustomerAccessToken,
  makeEstablishmentAccessToken,
  makeEstablishmentUserWithoutProfileAccessToken,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import { PrismaAppointmentMapper } from "../../database/prisma/mappers/prisma-appointment-mapper";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";
import { AppModule } from "../../app.module";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { Money } from "../../../modules/catalog/domain/value-objects/money";

const overviewResponseSchema = z
  .object({
    totalRevenueInCents: z.number(),
    averageTicketInCents: z.number(),
    appointmentsCount: z.number(),
    cancellationRate: z.number(),
  })
  .strict();

const appointmentsResponseSchema = z
  .object({
    appointmentsCount: z.number(),
    cancellationRate: z.number(),
  })
  .strict();

const revenueResponseSchema = z
  .object({
    points: z.array(
      z
        .object({
          period: z.string(),
          revenueInCents: z.number(),
          appointmentsCount: z.number(),
        })
        .strict(),
    ),
  })
  .strict();

const popularServicesResponseSchema = z
  .object({
    popularServices: z.array(
      z
        .object({
          serviceId: z.uuid(),
          serviceName: z.string(),
          category: z
            .enum([
              "WASH",
              "SANITIZATION",
              "AUTOMATIVE_DETAILING",
              "PROTECTION",
              "UPHOLSTERY",
            ])
            .nullable(),
          appointmentsCount: z.number(),
          revenueInCents: z.number(),
        })
        .strict(),
    ),
  })
  .strict();

const dashboardMetricPaths = [
  "/dashboard/metrics/overview",
  "/dashboard/metrics/revenue",
  "/dashboard/metrics/appointments",
  "/dashboard/metrics/popular-services",
] as const;

describe("Dashboard metrics controller (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userFactory: UserFactory;
  let establishmentFactory: EstablishmentFactory;
  let customerFactory: CustomerFactory;
  let serviceFactory: ServiceFactory;
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
    serviceFactory = new ServiceFactory(prisma);
    envService = moduleRef.get(EnvService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return dashboard metrics from real appointment data", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
    });
    const washService = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
      category: "WASH",
    });
    const detailsService = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
      category: "AUTOMATIVE_DETAILING",
    });
    const protectionService = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
      category: "PROTECTION",
    });

    await prisma.appointment.create({
      data: PrismaAppointmentMapper.toPrisma(
        makeAppointment({
          establishmentId: establishment.id,
          customerId: customer.id,
          status: "SCHEDULED",
          service: {
            serviceId: washService.id,
            serviceName: washService.serviceName.value,
            category: washService.category,
            durationInMinutes:
              washService.estimatedDuration?.upperBoundInMinutes,
            priceInCents: 10000,
          },
          discountInCents: Money.create(1000),
          startsAt: new Date("2026-04-01T10:00:00.000Z"),
          endsAt: new Date("2026-04-01T11:00:00.000Z"),
        }),
      ),
    });
    await prisma.appointment.create({
      data: PrismaAppointmentMapper.toPrisma(
        makeAppointment({
          establishmentId: establishment.id,
          customerId: customer.id,
          status: "SCHEDULED",
          service: {
            serviceId: washService.id,
            serviceName: washService.serviceName.value,
            category: washService.category,
            durationInMinutes:
              washService.estimatedDuration?.upperBoundInMinutes,
            priceInCents: 12000,
          },
          startsAt: new Date("2026-04-01T14:00:00.000Z"),
          endsAt: new Date("2026-04-01T15:00:00.000Z"),
        }),
      ),
    });
    await prisma.appointment.create({
      data: PrismaAppointmentMapper.toPrisma(
        makeAppointment({
          establishmentId: establishment.id,
          customerId: customer.id,
          status: "SCHEDULED",
          service: {
            serviceId: detailsService.id,
            serviceName: "Detalhamento snapshot",
            category: "AUTOMATIVE_DETAILING",
            durationInMinutes:
              detailsService.estimatedDuration?.upperBoundInMinutes,
            priceInCents: 30000,
          },
          discountInCents: Money.create(5000),
          startsAt: new Date("2026-04-02T14:00:00.000Z"),
          endsAt: new Date("2026-04-02T15:00:00.000Z"),
        }),
      ),
    });
    await prisma.appointment.create({
      data: PrismaAppointmentMapper.toPrisma(
        makeAppointment({
          establishmentId: establishment.id,
          customerId: customer.id,
          status: "CANCELLED",
          service: {
            serviceId: washService.id,
            serviceName: washService.serviceName.value,
            category: washService.category,
            durationInMinutes:
              washService.estimatedDuration?.upperBoundInMinutes,
            priceInCents: 15000,
          },
          discountInCents: Money.create(5000),
          startsAt: new Date("2026-04-03T14:00:00.000Z"),
          endsAt: new Date("2026-04-03T15:00:00.000Z"),
        }),
      ),
    });
    await prisma.appointment.create({
      data: PrismaAppointmentMapper.toPrisma(
        makeAppointment({
          establishmentId: establishment.id,
          customerId: customer.id,
          status: "DONE",
          service: {
            serviceId: washService.id,
            serviceName: washService.serviceName.value,
            category: washService.category,
            durationInMinutes:
              washService.estimatedDuration?.upperBoundInMinutes,
            priceInCents: 99999,
          },
          startsAt: new Date("2026-04-02T16:00:00.000Z"),
          endsAt: new Date("2026-04-02T17:00:00.000Z"),
        }),
      ),
    });
    await prisma.appointment.create({
      data: PrismaAppointmentMapper.toPrisma(
        makeAppointment({
          establishmentId: establishment.id,
          customerId: customer.id,
          status: "SCHEDULED",
          service: {
            serviceId: protectionService.id,
            serviceName: protectionService.serviceName.value,
            category: "PROTECTION",
            durationInMinutes:
              protectionService.estimatedDuration?.upperBoundInMinutes,
            priceInCents: 99999,
          },
          startsAt: new Date("2026-04-02T18:00:00.000Z"),
          endsAt: new Date("2026-04-02T19:00:00.000Z"),
        }),
      ),
    });
    await prisma.appointment.create({
      data: PrismaAppointmentMapper.toPrisma(
        makeAppointment({
          establishmentId: establishment.id,
          customerId: customer.id,
          status: "SCHEDULED",
          service: {
            serviceId: washService.id,
            serviceName: washService.serviceName.value,
            category: washService.category,
            durationInMinutes:
              washService.estimatedDuration?.upperBoundInMinutes,
            priceInCents: 99999,
          },
          startsAt: new Date("2026-04-04T14:00:00.000Z"),
          endsAt: new Date("2026-04-04T15:00:00.000Z"),
        }),
      ),
    });

    const query = {
      startsAt: "2026-04-01T00:00:00.000Z",
      endsAt: "2026-04-03T23:59:59.999Z",
      categories: ["WASH", "AUTOMATIVE_DETAILING"],
      status: ["SCHEDULED", "CANCELLED"],
    };

    const overviewResponse = await request(getHttpServer(app))
      .get("/dashboard/metrics/overview")
      .query(query)
      .set("Authorization", `Bearer ${accessToken}`);
    const revenueResponse = await request(getHttpServer(app))
      .get("/dashboard/metrics/revenue")
      .query(query)
      .set("Authorization", `Bearer ${accessToken}`);
    const appointmentsResponse = await request(getHttpServer(app))
      .get("/dashboard/metrics/appointments")
      .query(query)
      .set("Authorization", `Bearer ${accessToken}`);
    const popularServicesResponse = await request(getHttpServer(app))
      .get("/dashboard/metrics/popular-services")
      .query(query)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(overviewResponse.status).toBe(200);
    expect(revenueResponse.status).toBe(200);
    expect(appointmentsResponse.status).toBe(200);
    expect(popularServicesResponse.status).toBe(200);

    expect(overviewResponseSchema.parse(overviewResponse.body)).toEqual({
      totalRevenueInCents: 56000,
      averageTicketInCents: 14000,
      appointmentsCount: 4,
      cancellationRate: 0.25,
    });
    expect(revenueResponseSchema.parse(revenueResponse.body)).toEqual({
      points: [
        {
          period: "2026-04-01",
          appointmentsCount: 2,
          revenueInCents: 21000,
        },
        {
          period: "2026-04-02",
          appointmentsCount: 1,
          revenueInCents: 25000,
        },
        {
          period: "2026-04-03",
          appointmentsCount: 1,
          revenueInCents: 10000,
        },
      ],
    });
    expect(appointmentsResponseSchema.parse(appointmentsResponse.body)).toEqual(
      {
        appointmentsCount: 4,
        cancellationRate: 0.25,
      },
    );
    expect(
      popularServicesResponseSchema.parse(popularServicesResponse.body),
    ).toEqual({
      popularServices: [
        {
          serviceId: washService.id.toString(),
          serviceName: washService.serviceName.value,
          category: "WASH",
          appointmentsCount: 3,
          revenueInCents: 31000,
        },
        {
          serviceId: detailsService.id.toString(),
          serviceName: "Detalhamento snapshot",
          category: "AUTOMATIVE_DETAILING",
          appointmentsCount: 1,
          revenueInCents: 25000,
        },
      ],
    });
  });

  it.each(dashboardMetricPaths)(
    "should reject invalid query dates for %s",
    async (path) => {
      const { accessToken } = await makeEstablishmentAccessToken({
        app,
        prisma,
        userFactory,
        establishmentFactory,
        envService,
      });

      const response = await request(getHttpServer(app))
        .get(path)
        .query({
          startsAt: "2026-04-03T00:00:00.000Z",
          endsAt: "2026-04-01T00:00:00.000Z",
        })
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual(
        expect.objectContaining({
          message: "Validation failed",
          statusCode: 400,
        }),
      );
    },
  );

  it.each(dashboardMetricPaths)(
    "should require authentication for %s",
    async (path) => {
      const response = await request(getHttpServer(app)).get(path);

      expect(response.status).toBe(401);
    },
  );

  it.each(dashboardMetricPaths)(
    "should require establishment role for %s",
    async (path) => {
      const { accessToken } = await makeCustomerAccessToken({
        app,
        prisma,
        userFactory,
      });

      const response = await request(getHttpServer(app))
        .get(path)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
    },
  );

  it.each(dashboardMetricPaths)(
    "should return not found when establishment profile does not exist for %s",
    async (path) => {
      const { accessToken } =
        await makeEstablishmentUserWithoutProfileAccessToken({
          app,
          prisma,
          userFactory,
        });

      const response = await request(getHttpServer(app))
        .get(path)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
    },
  );
});
