import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
import { Service } from "../../../modules/catalog/domain/entities/services";
import { UniqueEntityId } from "../../../shared/entities/unique-entity-id";
import { AppointmentStatus } from "../../../modules/scheduling/domain/entities/appointment";

const referenceDate = new Date("2026-05-15T12:00:00.000Z");

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
    cancellationRate: z
      .object({
        currentPercent: z.number(),
        comparisonPercentPoints: z.number().nullable(),
      })
      .strict(),
  })
  .strict();

const revenueResponseSchema = z
  .object({
    points: z.array(
      z
        .object({
          date: z.string(),
          label: z.string(),
          revenueInCents: z.number(),
          appointments: z.number(),
        })
        .strict(),
    ),
    summary: z
      .object({
        revenueInCents: z.number(),
        appointments: z.number(),
        revenueTrendPercent: z.number().nullable(),
        appointmentsTrendPercent: z.number().nullable(),
      })
      .strict(),
  })
  .strict();

const popularServicesResponseSchema = z
  .object({
    popularServices: z.array(
      z
        .object({
          id: z.uuid(),
          name: z.string(),
          completedCount: z.number(),
          percent: z.number(),
        })
        .strict(),
    ),
    totalServices: z.number(),
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
    vi.useFakeTimers();
    vi.setSystemTime(referenceDate);

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
    vi.useRealTimers();
  });

  async function makeAuthContext() {
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

    return { accessToken, establishment, customer };
  }

  async function createAppointment({
    establishmentId,
    customerId,
    service,
    startsAt,
    status = "DONE",
    priceInCents,
    discountInCents,
    serviceName,
  }: {
    establishmentId: UniqueEntityId;
    customerId: UniqueEntityId;
    service: Service;
    startsAt: string;
    status?: AppointmentStatus;
    priceInCents: number;
    discountInCents?: number;
    serviceName?: string;
  }) {
    const start = new Date(startsAt);

    await prisma.appointment.create({
      data: PrismaAppointmentMapper.toPrisma(
        makeAppointment({
          establishmentId,
          customerId,
          status,
          service: {
            serviceId: service.id,
            serviceName: serviceName ?? service.serviceName.value,
            category: service.category,
            durationInMinutes: service.estimatedDuration?.upperBoundInMinutes,
            priceInCents,
          },
          discountInCents:
            discountInCents !== undefined
              ? Money.create(discountInCents)
              : null,
          startsAt: start,
          endsAt: new Date(start.getTime() + 60 * 60 * 1000),
        }),
      ),
    });
  }

  async function seedDashboardMetrics() {
    const { accessToken, establishment, customer } = await makeAuthContext();
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
    const shared = {
      establishmentId: establishment.id,
      customerId: customer.id,
    };

    await createAppointment({
      ...shared,
      service: washService,
      startsAt: "2026-05-09T10:00:00.000Z",
      priceInCents: 10000,
    });
    await createAppointment({
      ...shared,
      service: detailsService,
      startsAt: "2026-05-10T10:00:00.000Z",
      priceInCents: 20000,
      discountInCents: 5000,
      serviceName: "Detalhamento snapshot",
    });
    await createAppointment({
      ...shared,
      service: washService,
      startsAt: "2026-05-11T10:00:00.000Z",
      priceInCents: 10000,
    });
    await createAppointment({
      ...shared,
      service: protectionService,
      startsAt: "2026-05-12T10:00:00.000Z",
      priceInCents: 25000,
    });
    await createAppointment({
      ...shared,
      service: washService,
      startsAt: "2026-05-13T10:00:00.000Z",
      status: "CANCELLED",
      priceInCents: 30000,
    });
    await createAppointment({
      ...shared,
      service: washService,
      startsAt: "2026-05-03T10:00:00.000Z",
      priceInCents: 5000,
    });
    await createAppointment({
      ...shared,
      service: detailsService,
      startsAt: "2026-04-20T10:00:00.000Z",
      priceInCents: 7000,
    });
    await createAppointment({
      ...shared,
      service: washService,
      startsAt: "2026-05-02T10:00:00.000Z",
      priceInCents: 10000,
    });
    await createAppointment({
      ...shared,
      service: detailsService,
      startsAt: "2026-05-04T10:00:00.000Z",
      priceInCents: 10000,
    });
    await createAppointment({
      ...shared,
      service: protectionService,
      startsAt: "2026-05-05T10:00:00.000Z",
      status: "CANCELLED",
      priceInCents: 10000,
    });
    await createAppointment({
      ...shared,
      service: washService,
      startsAt: "2026-04-10T10:00:00.000Z",
      priceInCents: 10000,
    });
    await createAppointment({
      ...shared,
      service: detailsService,
      startsAt: "2026-04-12T10:00:00.000Z",
      status: "CANCELLED",
      priceInCents: 10000,
    });
    await createAppointment({
      ...shared,
      service: protectionService,
      startsAt: "2026-03-20T10:00:00.000Z",
      priceInCents: 4000,
    });

    return { accessToken, washService, detailsService, protectionService };
  }

  it("should preserve overview metrics response from real appointment data", async () => {
    const { accessToken, establishment, customer } = await makeAuthContext();
    const washService = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
      category: "WASH",
    });
    const detailsService = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
      category: "AUTOMATIVE_DETAILING",
    });
    const shared = {
      establishmentId: establishment.id,
      customerId: customer.id,
    };

    await createAppointment({
      ...shared,
      service: washService,
      startsAt: "2026-04-01T10:00:00.000Z",
      status: "SCHEDULED",
      priceInCents: 10000,
      discountInCents: 1000,
    });
    await createAppointment({
      ...shared,
      service: washService,
      startsAt: "2026-04-01T14:00:00.000Z",
      status: "SCHEDULED",
      priceInCents: 12000,
    });
    await createAppointment({
      ...shared,
      service: detailsService,
      startsAt: "2026-04-02T14:00:00.000Z",
      status: "SCHEDULED",
      priceInCents: 30000,
      discountInCents: 5000,
    });
    await createAppointment({
      ...shared,
      service: washService,
      startsAt: "2026-04-03T14:00:00.000Z",
      status: "CANCELLED",
      priceInCents: 15000,
      discountInCents: 5000,
    });
    await createAppointment({
      ...shared,
      service: washService,
      startsAt: "2026-04-02T16:00:00.000Z",
      priceInCents: 99999,
    });

    const response = await request(getHttpServer(app))
      .get("/dashboard/metrics/overview")
      .query({
        startsAt: "2026-04-01T00:00:00.000Z",
        endsAt: "2026-04-03T23:59:59.999Z",
        categories: ["WASH", "AUTOMATIVE_DETAILING"],
        status: ["SCHEDULED", "CANCELLED"],
      })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(overviewResponseSchema.parse(response.body)).toEqual({
      totalRevenueInCents: 56000,
      averageTicketInCents: 14000,
      appointmentsCount: 4,
      cancellationRate: 0.25,
    });
  });

  it("should return dynamic revenue metrics for period presets with comparison trends", async () => {
    const { accessToken } = await seedDashboardMetrics();

    const lastSevenDaysResponse = await request(getHttpServer(app))
      .get("/dashboard/metrics/revenue")
      .query({ period: "last-7-days" })
      .set("Authorization", `Bearer ${accessToken}`);
    const lastThirtyDaysResponse = await request(getHttpServer(app))
      .get("/dashboard/metrics/revenue")
      .query({ period: "last-30-days" })
      .set("Authorization", `Bearer ${accessToken}`);
    const thisMonthResponse = await request(getHttpServer(app))
      .get("/dashboard/metrics/revenue")
      .query({ period: "this-month" })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(lastSevenDaysResponse.status).toBe(200);
    expect(lastThirtyDaysResponse.status).toBe(200);
    expect(thisMonthResponse.status).toBe(200);

    const lastSevenDays = revenueResponseSchema.parse(
      lastSevenDaysResponse.body,
    );
    expect(lastSevenDays.points).toHaveLength(7);
    expect(lastSevenDays.points).toEqual(
      expect.arrayContaining([
        {
          date: "2026-05-09",
          label: "09/05",
          appointments: 1,
          revenueInCents: 10000,
        },
        {
          date: "2026-05-10",
          label: "10/05",
          appointments: 1,
          revenueInCents: 15000,
        },
        {
          date: "2026-05-11",
          label: "11/05",
          appointments: 1,
          revenueInCents: 10000,
        },
        {
          date: "2026-05-12",
          label: "12/05",
          appointments: 1,
          revenueInCents: 25000,
        },
      ]),
    );
    expect(lastSevenDays.summary).toEqual({
      revenueInCents: 60000,
      appointments: 4,
      revenueTrendPercent: 140,
      appointmentsTrendPercent: 33,
    });

    expect(
      revenueResponseSchema.parse(lastThirtyDaysResponse.body).summary,
    ).toEqual({
      revenueInCents: 92000,
      appointments: 8,
      revenueTrendPercent: 557,
      appointmentsTrendPercent: 300,
    });
    expect(revenueResponseSchema.parse(thisMonthResponse.body).summary).toEqual(
      {
        revenueInCents: 85000,
        appointments: 7,
        revenueTrendPercent: 750,
        appointmentsTrendPercent: 600,
      },
    );
  });

  it("should return appointment metrics for custom startsAt and endsAt", async () => {
    const { accessToken } = await seedDashboardMetrics();

    const response = await request(getHttpServer(app))
      .get("/dashboard/metrics/appointments")
      .query({
        startsAt: "2026-05-09T00:00:00.000Z",
        endsAt: "2026-05-15T23:59:59.999Z",
      })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(appointmentsResponseSchema.parse(response.body)).toEqual({
      appointmentsCount: 5,
      cancellationRate: {
        currentPercent: 20,
        comparisonPercentPoints: -5,
      },
    });
  });

  it("should return revenue metrics for startsAt without endsAt", async () => {
    const { accessToken } = await seedDashboardMetrics();

    const response = await request(getHttpServer(app))
      .get("/dashboard/metrics/revenue")
      .query({
        startsAt: "2026-05-09T00:00:00.000Z",
      })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(revenueResponseSchema.parse(response.body).summary).toEqual({
      revenueInCents: 60000,
      appointments: 4,
      revenueTrendPercent: 140,
      appointmentsTrendPercent: 33,
    });
  });

  it("should paginate popular services from appointment-level pages", async () => {
    const { accessToken, washService, detailsService } =
      await seedDashboardMetrics();

    const firstPageResponse = await request(getHttpServer(app))
      .get("/dashboard/metrics/popular-services")
      .query({
        period: "last-7-days",
        page: 1,
        size: 1,
      })
      .set("Authorization", `Bearer ${accessToken}`);
    const secondPageResponse = await request(getHttpServer(app))
      .get("/dashboard/metrics/popular-services")
      .query({
        period: "last-7-days",
        page: 2,
        size: 1,
      })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(firstPageResponse.status).toBe(200);
    expect(secondPageResponse.status).toBe(200);
    expect(popularServicesResponseSchema.parse(firstPageResponse.body)).toEqual(
      {
        popularServices: [
          {
            id: washService.id.toString(),
            name: washService.serviceName.value,
            completedCount: 1,
            percent: 100,
          },
        ],
        totalServices: 1,
      },
    );
    expect(
      popularServicesResponseSchema.parse(secondPageResponse.body),
    ).toEqual({
      popularServices: [
        {
          id: detailsService.id.toString(),
          name: "Detalhamento snapshot",
          completedCount: 1,
          percent: 100,
        },
      ],
      totalServices: 1,
    });
  });

  it.each([
    [
      "endsAt without startsAt",
      "/dashboard/metrics/revenue",
      { endsAt: "2026-05-15T23:59:59.999Z" },
    ],
    [
      "future startsAt",
      "/dashboard/metrics/appointments",
      { startsAt: "2026-05-16T00:00:00.000Z" },
    ],
    [
      "range above 24 months",
      "/dashboard/metrics/popular-services",
      {
        startsAt: "2024-01-01T00:00:00.000Z",
        endsAt: "2026-05-15T23:59:59.999Z",
      },
    ],
    [
      "incompatible explicit granularity",
      "/dashboard/metrics/revenue",
      {
        startsAt: "2026-04-01T00:00:00.000Z",
        endsAt: "2026-05-15T23:59:59.999Z",
        granularity: "daily",
      },
    ],
    ["page=0", "/dashboard/metrics/popular-services", { page: 0 }],
    ["size=0", "/dashboard/metrics/popular-services", { size: 0 }],
  ])("should reject %s", async (_, path, query) => {
    const { accessToken } = await makeAuthContext();

    const response = await request(getHttpServer(app))
      .get(path)
      .query(query)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
  });

  it.each(dashboardMetricPaths)(
    "should reject invalid query dates for %s",
    async (path) => {
      const { accessToken } = await makeAuthContext();

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
