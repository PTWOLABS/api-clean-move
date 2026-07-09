import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type SuperAgentResponse from "superagent/lib/node/response";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

import { CustomerFactory } from "../../../../../tests/factories/customer-factory";
import { EstablishmentFactory } from "../../../../../tests/factories/establishment-factory";
import { ServiceFactory } from "../../../../../tests/factories/service-factory";
import { UserFactory } from "../../../../../tests/factories/user-factory";
import {
  getHttpServer,
  makeEmployeeAccessToken,
  makeEstablishmentAccessToken,
} from "../../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../../modules/application/repositories/hash-generator";
import { ServiceName } from "../../../../modules/catalog/domain/value-objects/service-name";
import { ServicePriceSpecification } from "../../../../modules/catalog/domain/value-objects/service-price-specification";
import { CustomerDocument } from "../../../../modules/customer/domain/value-objects/customer-document";
import { AppModule } from "../../../app.module";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { EnvService } from "../../../env/env.service";

const quoteServiceCategorySchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1),
  })
  .nullable();

const quoteResponseSchema = z.object({
  quote: z.object({
    id: z.uuid(),
    establishmentId: z.uuid(),
    customerId: z.uuid().nullable(),
    vehicleId: z.uuid().nullable(),
    convertedAppointmentId: z.uuid().nullable(),
    convertedAt: z.string().nullable(),
    customer: z.object({
      name: z.string().min(1),
      phone: z.string().nullable(),
      cpfCnpj: z.string().nullable(),
      address: z.unknown().nullable(),
    }),
    vehicle: z
      .object({
        plate: z.string().nullable(),
        brand: z.string().nullable(),
        model: z.string().nullable(),
        color: z.string().nullable(),
        year: z.number().int().nullable(),
      })
      .nullable(),
    services: z
      .array(
        z.object({
          id: z.uuid().nullable(),
          name: z.string().min(1),
          category: quoteServiceCategorySchema,
          durationInMinutes: z.number().int().nullable(),
          priceInCents: z.number().int().nonnegative(),
          isCourtesy: z.boolean(),
        }),
      )
      .min(1),
    paymentOptions: z
      .array(
        z.object({
          method: z.enum(["CASH", "PIX", "CARD", "OTHER"]),
          label: z.string().min(1),
          installments: z.number().int().positive(),
          interestFree: z.boolean(),
          discountType: z.enum(["PERCENTAGE", "AMOUNT"]).nullable(),
          discountValue: z.number().int().nullable(),
          totalInCents: z.number().int().nonnegative(),
        }),
      )
      .min(1),
    subtotalInCents: z.number().int().nonnegative(),
    totalCourtesyValueInCents: z.number().int().nonnegative(),
    description: z.string().nullable(),
    termsAndConditions: z.string().nullable(),
    expiresAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
});

const quoteListItemResponseSchema = z.object({
  id: z.uuid(),
  code: z.string().optional(),
  customerName: z.string().min(1),
  customerKind: z.enum(["CUSTOMER", "PROSPECT"]),
  vehicleLabel: z.string().nullable(),
  vehiclePlate: z.string().nullable(),
  totalInCents: z.number().int().nonnegative(),
  status: z.enum(["VALID", "EXPIRES_TODAY", "EXPIRED", "APPROVED"]),
  approvedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  servicesCount: z.number().int().nonnegative().optional(),
});

const listQuotesResponseSchema = z.object({
  quotes: z.array(quoteListItemResponseSchema),
  totalItems: z.number().int().nonnegative(),
  summary: z.object({
    valid: z.number().int().nonnegative(),
    expiresToday: z.number().int().nonnegative(),
    approved: z.number().int().nonnegative(),
    expired: z.number().int().nonnegative(),
  }),
});

const registerQuoteProspectResponseSchema = z.object({
  customer: z.object({
    id: z.uuid(),
  }),
  vehicle: z
    .object({
      id: z.uuid(),
    })
    .nullable(),
  quote: quoteResponseSchema.shape.quote,
});

const approveQuoteResponseSchema = z.object({
  appointment: z.object({
    id: z.uuid(),
  }),
  quote: quoteResponseSchema.shape.quote,
});

const errorResponseSchema = z.object({
  statusCode: z.number().int(),
  code: z.string().min(1),
  message: z.string(),
  errors: z
    .array(
      z.object({
        field: z.string(),
        code: z.string(),
      }),
    )
    .optional(),
});

function collectPdfResponseBody(
  res: SuperAgentResponse,
  callback: (error: Error | null, body: Buffer) => void,
) {
  const chunks: Buffer[] = [];

  res.on("data", (chunk: unknown) => {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
      return;
    }

    if (chunk instanceof Uint8Array || typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    }
  });
  res.on("end", () => callback(null, Buffer.concat(chunks)));
}

describe("Quote controllers (e2e)", () => {
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

  it("should create, list, get, export, register prospect, and approve quote", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Lavagem detalhada"),
      priceSpecification: ServicePriceSpecification.create({
        type: "RANGE",
        minPriceInCents: 30000,
        maxPriceInCents: 60000,
      }),
    });

    const createResponse = await request(getHttpServer(app))
      .post("/quotes")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        customer: { name: "Robertinho Contador", phone: "11999999999" },
        vehicle: {
          brand: "Honda",
          model: "HR-V",
          color: "Branco",
          year: 2025,
        },
        serviceItems: [
          {
            serviceId: service.id.toString(),
            priceInCents: 45000,
            isCourtesy: false,
          },
          {
            serviceName: "Cristalizacao avulsa",
            priceInCents: 12000,
            isCourtesy: false,
          },
        ],
        paymentOptions: [
          {
            method: "PIX",
            label: "A vista no Pix",
            installments: 1,
            interestFree: true,
            discountType: "PERCENTAGE",
            discountValue: 10,
          },
        ],
        termsAndConditions: "Orcamento valido por 10 dias.",
      });
    const createBody = quoteResponseSchema.parse(createResponse.body);

    expect(createResponse.status).toBe(201);
    const quoteId = createBody.quote.id;
    expect(createBody.quote.customerId).toBeNull();
    expect(createBody.quote.services[0]?.priceInCents).toBe(45000);
    expect(createBody.quote.services[1]?.id).toBeNull();
    expect(createBody.quote.services[1]?.name).toBe("Cristalizacao avulsa");
    expect(createBody.quote.subtotalInCents).toBe(57000);
    expect(createBody.quote.paymentOptions[0]?.totalInCents).toBeGreaterThan(0);

    const listResponse = await request(getHttpServer(app))
      .get("/quotes")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ search: "robertinho" });
    const listBody = listQuotesResponseSchema.parse(listResponse.body);

    expect(listResponse.status).toBe(200);
    expect(listBody.quotes).toHaveLength(1);
    expect(listBody.totalItems).toBe(1);
    expect(listBody.summary).toEqual({
      valid: 1,
      expiresToday: 0,
      approved: 0,
      expired: 0,
    });
    expect(listBody.quotes[0]).toMatchObject({
      id: quoteId,
      customerName: "Robertinho Contador",
      customerKind: "PROSPECT",
      vehicleLabel: "Honda HR-V 2025",
      vehiclePlate: null,
      status: "VALID",
      approvedAt: null,
      servicesCount: 2,
    });
    expect(listBody.quotes[0]?.totalInCents).toBe(
      createBody.quote.paymentOptions[0]?.totalInCents,
    );

    const getResponse = await request(getHttpServer(app))
      .get(`/quotes/${quoteId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const getBody = quoteResponseSchema.parse(getResponse.body);

    expect(getResponse.status).toBe(200);
    expect(getBody.quote.id).toBe(quoteId);

    const pdfResponse = await request(getHttpServer(app))
      .get(`/quotes/${quoteId}/pdf`)
      .set("Authorization", `Bearer ${accessToken}`)
      .buffer()
      .parse(collectPdfResponseBody);

    expect(pdfResponse.status).toBe(200);
    expect(pdfResponse.headers["content-type"]).toContain("application/pdf");
    expect(Buffer.from(pdfResponse.body).subarray(0, 4).toString()).toBe(
      "%PDF",
    );

    const registerResponse = await request(getHttpServer(app))
      .post(`/quotes/${quoteId}/register-customer`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        email: "robertinho@example.com",
        phone: "11999999999",
        createVehicleFromQuote: true,
      });
    const registerBody = registerQuoteProspectResponseSchema.parse(
      registerResponse.body,
    );

    expect(registerResponse.status).toBe(201);
    expect(registerBody.customer.id).toBeTruthy();
    expect(registerBody.vehicle?.id).toBeTruthy();

    const approveResponse = await request(getHttpServer(app))
      .post(`/quotes/${quoteId}/approve`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        startsAt: "2026-06-01T10:00:00.000Z",
        endsAt: "2026-06-01T12:00:00.000Z",
      });
    const approveBody = approveQuoteResponseSchema.parse(approveResponse.body);

    expect(approveResponse.status).toBe(201);
    expect(approveBody.appointment.id).toBeTruthy();
    expect(approveBody.quote.convertedAppointmentId).toBe(
      approveBody.appointment.id,
    );
    const createdDetachedService = await prisma.service.findFirst({
      where: {
        establishmentId: establishment.id.toString(),
        serviceName: "Cristalizacao avulsa",
        deletedAt: null,
      },
    });
    expect(createdDetachedService?.priceInCents).toBe(12000);

    const approvedListResponse = await request(getHttpServer(app))
      .get("/quotes")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ search: "robertinho" });
    const approvedListBody = listQuotesResponseSchema.parse(
      approvedListResponse.body,
    );

    expect(approvedListResponse.status).toBe(200);
    expect(approvedListBody.quotes[0]).toMatchObject({
      id: quoteId,
      status: "APPROVED",
      approvedAt: approveBody.quote.convertedAt,
    });
  });

  it("should reject quote creation with an invalid prospect phone", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });

    const response = await request(getHttpServer(app))
      .post("/quotes")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        customer: { name: "Telefone Invalido", phone: "1" },
        vehicle: { brand: "Honda", model: "HR-V" },
        serviceItems: [{ serviceId: service.id.toString() }],
        paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
      });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).message).toContain(
      "Invalid phone number",
    );
  });

  it("should reject quote creation with an incomplete vehicle snapshot", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });

    const withoutBrandResponse = await request(getHttpServer(app))
      .post("/quotes")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        customer: { name: "Veiculo Sem Marca" },
        vehicle: { model: "HR-V" },
        serviceItems: [{ serviceId: service.id.toString() }],
        paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
      });
    const withoutModelResponse = await request(getHttpServer(app))
      .post("/quotes")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        customer: { name: "Veiculo Sem Modelo" },
        vehicle: { brand: "Honda" },
        serviceItems: [{ serviceId: service.id.toString() }],
        paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
      });

    expect(withoutBrandResponse.status).toBe(400);
    expect(withoutModelResponse.status).toBe(400);
    expect(errorResponseSchema.parse(withoutBrandResponse.body)).toMatchObject({
      code: "VALIDATION_ERROR",
      errors: [{ field: "vehicle.brand", code: "REQUIRED" }],
    });
    expect(errorResponseSchema.parse(withoutModelResponse.body)).toMatchObject({
      code: "VALIDATION_ERROR",
      errors: [{ field: "vehicle.model", code: "REQUIRED" }],
    });
  });

  it("should create a prospect quote with vehicle snapshot and detached service", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .post("/quotes")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        customer: {
          name: "Prospect Snapshot",
          phone: "(11) 98765-4321",
          cpfCnpj: "529.982.247-25",
        },
        vehicle: {
          plate: "ABC-1D23",
          brand: "Honda",
          model: "HR-V",
          color: "Branco",
          year: 2025,
        },
        serviceItems: [
          {
            serviceName: "Polimento snapshot",
            priceInCents: 45000,
          },
        ],
        paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
      });
    const body = quoteResponseSchema.parse(response.body);

    expect(response.status).toBe(201);
    expect(body.quote.customer.phone).toBe("11987654321");
    expect(body.quote.customer.cpfCnpj).toBe("52998224725");
    expect(body.quote.vehicle?.plate).toBe("ABC1D23");
    expect(body.quote.services[0]?.id).toBeNull();
    expect(body.quote.services[0]?.name).toBe("Polimento snapshot");
  });

  it("should filter, paginate, and sort listed quotes", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const customer = await prisma.customer.create({
      data: {
        establishmentId: establishment.id.toString(),
        fullName: "Filtro Cliente Especial",
        phone: "11988887777",
      },
    });
    const vehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: customer.id,
        plate: "ZZZ9A99",
        brand: "Tesla",
        model: "Model 3",
      },
    });
    const polishingService = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Filtro Polimento"),
    });
    const ceramicService = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Filtro Vitrificacao"),
    });
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayNoon = new Date(todayStart);
    todayNoon.setUTCHours(12, 0, 0, 0);
    const yesterdayNoon = new Date(todayNoon);
    yesterdayNoon.setUTCDate(todayNoon.getUTCDate() - 1);
    const tomorrowNoon = new Date(todayNoon);
    tomorrowNoon.setUTCDate(todayNoon.getUTCDate() + 1);

    async function createQuote(input: {
      customerName?: string;
      vehiclePlate?: string;
      vehicleBrand?: string;
      vehicleModel?: string;
      customerId?: string;
      vehicleId?: string;
      serviceId: string;
      expiresAt: Date;
      createdAt: Date;
    }) {
      const response = await request(getHttpServer(app))
        .post("/quotes")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          ...(input.customerId
            ? { customerId: input.customerId }
            : {
                customer: {
                  name: input.customerName,
                },
              }),
          ...(input.vehicleId
            ? { vehicleId: input.vehicleId }
            : {
                vehicle: {
                  plate: input.vehiclePlate,
                  brand: input.vehicleBrand,
                  model: input.vehicleModel,
                },
              }),
          serviceItems: [{ serviceId: input.serviceId }],
          paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
          expiresAt: input.expiresAt.toISOString(),
        });
      const body = quoteResponseSchema.parse(response.body);

      expect(response.status).toBe(201);

      await prisma.quote.update({
        where: {
          id: body.quote.id,
        },
        data: {
          createdAt: input.createdAt,
          updatedAt: input.createdAt,
        },
      });

      return body.quote.id;
    }

    async function listQuotes(
      query: Record<string, string | number | boolean>,
    ) {
      const response = await request(getHttpServer(app))
        .get("/quotes")
        .set("Authorization", `Bearer ${accessToken}`)
        .query(query);

      expect(response.status).toBe(200);

      return listQuotesResponseSchema.parse(response.body);
    }

    const oldestQuoteId = await createQuote({
      customerId: customer.id,
      vehicleId: vehicle.id,
      serviceId: polishingService.id.toString(),
      expiresAt: tomorrowNoon,
      createdAt: new Date("2026-06-20T12:00:00.000Z"),
    });
    const middleQuoteId = await createQuote({
      customerName: "Filtro Prospect Hoje",
      vehiclePlate: "MID1D23",
      vehicleBrand: "Honda",
      vehicleModel: "Civic",
      serviceId: ceramicService.id.toString(),
      expiresAt: todayNoon,
      createdAt: new Date("2026-06-21T12:00:00.000Z"),
    });
    const recentQuoteId = await createQuote({
      customerName: "Filtro Prospect Expirado",
      vehiclePlate: "OLD1D23",
      vehicleBrand: "Toyota",
      vehicleModel: "Corolla",
      serviceId: polishingService.id.toString(),
      expiresAt: yesterdayNoon,
      createdAt: new Date("2026-06-22T12:00:00.000Z"),
    });

    const approveResponse = await request(getHttpServer(app))
      .post(`/quotes/${oldestQuoteId}/approve`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        startsAt: tomorrowNoon.toISOString(),
      });

    expect(approveResponse.status).toBe(201);

    const recentList = await listQuotes({});
    const oldestList = await listQuotes({ sort: "oldest" });
    const paginatedList = await listQuotes({
      sort: "oldest",
      page: 2,
      size: 1,
    });

    expect(recentList.quotes.map((quote) => quote.id)).toEqual([
      recentQuoteId,
      middleQuoteId,
      oldestQuoteId,
    ]);
    expect(oldestList.quotes.map((quote) => quote.id)).toEqual([
      oldestQuoteId,
      middleQuoteId,
      recentQuoteId,
    ]);
    expect(paginatedList.totalItems).toBe(3);
    expect(paginatedList.quotes.map((quote) => quote.id)).toEqual([
      middleQuoteId,
    ]);
    expect(recentList.summary).toEqual({
      valid: 0,
      expiresToday: 1,
      approved: 1,
      expired: 1,
    });
    expect(
      Object.fromEntries(
        recentList.quotes.map((quote) => [quote.id, quote.status]),
      ),
    ).toEqual({
      [recentQuoteId]: "EXPIRED",
      [middleQuoteId]: "EXPIRES_TODAY",
      [oldestQuoteId]: "APPROVED",
    });

    await expect(
      listQuotes({ customerId: customer.id }),
    ).resolves.toMatchObject({
      quotes: [{ id: oldestQuoteId }],
    });
    await expect(
      listQuotes({ customerName: "Filtro Cliente" }),
    ).resolves.toMatchObject({
      quotes: [{ id: oldestQuoteId }],
    });
    await expect(listQuotes({ vehicleId: vehicle.id })).resolves.toMatchObject({
      quotes: [{ id: oldestQuoteId }],
    });
    await expect(
      listQuotes({ vehiclePlate: "ZZZ-9A99" }),
    ).resolves.toMatchObject({
      quotes: [{ id: oldestQuoteId }],
    });
    await expect(
      listQuotes({ serviceId: ceramicService.id.toString() }),
    ).resolves.toMatchObject({
      quotes: [{ id: middleQuoteId }],
    });
    await expect(
      listQuotes({ serviceName: "Vitrificacao" }),
    ).resolves.toMatchObject({
      quotes: [{ id: middleQuoteId }],
    });
    await expect(
      listQuotes({
        expiresFrom: todayStart.toISOString(),
        expiresTo: todayNoon.toISOString(),
      }),
    ).resolves.toMatchObject({
      quotes: [{ id: middleQuoteId }],
    });
    await expect(listQuotes({ converted: true })).resolves.toMatchObject({
      quotes: [{ id: oldestQuoteId }],
    });
    await expect(
      listQuotes({ createdAt: "2026-06-21T12:00:00.000Z" }),
    ).resolves.toMatchObject({
      quotes: [{ id: middleQuoteId }],
    });
  });

  it("should reject approving a prospect quote before registration", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });
    const createResponse = await request(getHttpServer(app))
      .post("/quotes")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        customer: { name: "Robertinho Contador" },
        vehicle: { brand: "Honda", model: "HR-V" },
        serviceItems: [{ serviceId: service.id.toString() }],
        paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
      });
    const quoteId = quoteResponseSchema.parse(createResponse.body).quote.id;

    const response = await request(getHttpServer(app))
      .post(`/quotes/${quoteId}/approve`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        startsAt: "2026-06-01T10:00:00.000Z",
        endsAt: "2026-06-01T12:00:00.000Z",
      });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body)).toMatchObject({
      code: "QUOTE_CANNOT_BE_APPROVED_FOR_PROSPECT",
    });
  });

  it("should not create a vehicle when createVehicleFromQuote is false", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });
    const createResponse = await request(getHttpServer(app))
      .post("/quotes")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        customer: { name: "Robertinho Contador" },
        vehicle: { brand: "Honda", model: "HR-V" },
        serviceItems: [{ serviceId: service.id.toString() }],
        paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
      });
    const quoteId = quoteResponseSchema.parse(createResponse.body).quote.id;

    const registerResponse = await request(getHttpServer(app))
      .post(`/quotes/${quoteId}/register-customer`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        email: "robertinho@example.com",
        createVehicleFromQuote: false,
      });
    const registerBody = registerQuoteProspectResponseSchema.parse(
      registerResponse.body,
    );

    expect(registerResponse.status).toBe(201);
    expect(registerBody.vehicle).toBeNull();
  });

  it("should enforce authentication on quote endpoints", async () => {
    const quoteId = "00000000-0000-4000-8000-000000000001";

    await request(getHttpServer(app)).post("/quotes").send({}).expect(401);
    await request(getHttpServer(app)).get("/quotes").expect(401);
    await request(getHttpServer(app)).get(`/quotes/${quoteId}/pdf`).expect(401);
    await request(getHttpServer(app))
      .post(`/quotes/${quoteId}/approve`)
      .send({
        startsAt: "2026-06-01T10:00:00.000Z",
      })
      .expect(401);
  });

  it("should allow employees with quote features to create and approve quotes", async () => {
    const { accessToken, establishment } = await makeEmployeeAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      extraFeatures: ["create:quotes", "create:customers", "approve:quotes"],
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });

    const createResponse = await request(getHttpServer(app))
      .post("/quotes")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        customer: { name: "Robertinho Contador" },
        vehicle: { brand: "Honda", model: "HR-V" },
        serviceItems: [{ serviceId: service.id.toString() }],
        paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
      });
    const quoteId = quoteResponseSchema.parse(createResponse.body).quote.id;

    const registerResponse = await request(getHttpServer(app))
      .post(`/quotes/${quoteId}/register-customer`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        email: "robertinho@example.com",
        createVehicleFromQuote: true,
      });
    const registerBody = registerQuoteProspectResponseSchema.parse(
      registerResponse.body,
    );

    expect(createResponse.status).toBe(201);
    expect(registerResponse.status).toBe(201);
    expect(registerBody.quote.customerId).toBe(registerBody.customer.id);

    const approveResponse = await request(getHttpServer(app))
      .post(`/quotes/${quoteId}/approve`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        startsAt: "2026-06-01T10:00:00.000Z",
        endsAt: "2026-06-01T12:00:00.000Z",
      });

    expect(approveResponse.status).toBe(201);
  });

  it("should isolate quote workflows by establishment", async () => {
    const firstEstablishmentAuth = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const secondEstablishmentAuth = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const firstService = await serviceFactory.makePrismaService({
      establishmentId: firstEstablishmentAuth.establishment.id,
    });
    const secondService = await serviceFactory.makePrismaService({
      establishmentId: secondEstablishmentAuth.establishment.id,
    });

    const firstCreateResponse = await request(getHttpServer(app))
      .post("/quotes")
      .set("Authorization", `Bearer ${firstEstablishmentAuth.accessToken}`)
      .send({
        customer: { name: "Tenant One Prospect" },
        vehicle: { brand: "Honda", model: "HR-V" },
        serviceItems: [{ serviceId: firstService.id.toString() }],
        paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
      });
    const firstQuoteId = quoteResponseSchema.parse(firstCreateResponse.body)
      .quote.id;

    const secondCreateResponse = await request(getHttpServer(app))
      .post("/quotes")
      .set("Authorization", `Bearer ${secondEstablishmentAuth.accessToken}`)
      .send({
        customer: { name: "Tenant Two Prospect" },
        vehicle: { brand: "Toyota", model: "Corolla" },
        serviceItems: [{ serviceId: secondService.id.toString() }],
        paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
      });
    const secondQuoteId = quoteResponseSchema.parse(secondCreateResponse.body)
      .quote.id;

    expect(firstCreateResponse.status).toBe(201);
    expect(secondCreateResponse.status).toBe(201);
    expect(firstQuoteId).not.toBe(secondQuoteId);

    const secondListResponse = await request(getHttpServer(app))
      .get("/quotes")
      .set("Authorization", `Bearer ${secondEstablishmentAuth.accessToken}`);
    const secondListBody = listQuotesResponseSchema.parse(
      secondListResponse.body,
    );

    expect(secondListResponse.status).toBe(200);
    expect(secondListBody.quotes.map((quote) => quote.id)).toEqual([
      secondQuoteId,
    ]);

    const secondSearchResponse = await request(getHttpServer(app))
      .get("/quotes")
      .set("Authorization", `Bearer ${secondEstablishmentAuth.accessToken}`)
      .query({ search: "Tenant One" });
    const secondSearchBody = listQuotesResponseSchema.parse(
      secondSearchResponse.body,
    );

    expect(secondSearchResponse.status).toBe(200);
    expect(secondSearchBody.quotes).toHaveLength(0);

    const inaccessibleQuoteResponse = await request(getHttpServer(app))
      .get(`/quotes/${firstQuoteId}`)
      .set("Authorization", `Bearer ${secondEstablishmentAuth.accessToken}`);

    expect(inaccessibleQuoteResponse.status).toBe(404);
    expect(
      errorResponseSchema.parse(inaccessibleQuoteResponse.body),
    ).toMatchObject({
      code: "QUOTE_NOT_FOUND",
    });
    await request(getHttpServer(app))
      .get(`/quotes/${firstQuoteId}/pdf`)
      .set("Authorization", `Bearer ${secondEstablishmentAuth.accessToken}`)
      .expect(404);
    await request(getHttpServer(app))
      .post(`/quotes/${firstQuoteId}/register-customer`)
      .set("Authorization", `Bearer ${secondEstablishmentAuth.accessToken}`)
      .send({
        email: "tenant-two@example.com",
      })
      .expect(404);
    await request(getHttpServer(app))
      .post(`/quotes/${firstQuoteId}/approve`)
      .set("Authorization", `Bearer ${secondEstablishmentAuth.accessToken}`)
      .send({
        startsAt: "2026-06-01T10:00:00.000Z",
        endsAt: "2026-06-01T12:00:00.000Z",
      })
      .expect(404);
  });

  it("should reject employee write workflows when required quote features are missing", async () => {
    const establishmentAuth = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const employeeAuth = await makeEmployeeAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      establishment: establishmentAuth.establishment,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishmentAuth.establishment.id,
    });

    const createResponse = await request(getHttpServer(app))
      .post("/quotes")
      .set("Authorization", `Bearer ${establishmentAuth.accessToken}`)
      .send({
        customer: { name: "Default Feature Employee Prospect" },
        vehicle: { brand: "Honda", model: "HR-V" },
        serviceItems: [{ serviceId: service.id.toString() }],
        paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
      });
    const quoteId = quoteResponseSchema.parse(createResponse.body).quote.id;

    const listResponse = await request(getHttpServer(app))
      .get("/quotes")
      .set("Authorization", `Bearer ${employeeAuth.accessToken}`);
    const getResponse = await request(getHttpServer(app))
      .get(`/quotes/${quoteId}`)
      .set("Authorization", `Bearer ${employeeAuth.accessToken}`);

    expect(createResponse.status).toBe(201);
    expect(listResponse.status).toBe(200);
    expect(getResponse.status).toBe(200);

    await request(getHttpServer(app))
      .post("/quotes")
      .set("Authorization", `Bearer ${employeeAuth.accessToken}`)
      .send({
        customer: { name: "Forbidden Prospect" },
        serviceItems: [{ serviceId: service.id.toString() }],
        paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
      })
      .expect(403);
    await request(getHttpServer(app))
      .post(`/quotes/${quoteId}/register-customer`)
      .set("Authorization", `Bearer ${employeeAuth.accessToken}`)
      .send({
        email: "forbidden-register@example.com",
      })
      .expect(403);
    await request(getHttpServer(app))
      .post(`/quotes/${quoteId}/approve`)
      .set("Authorization", `Bearer ${employeeAuth.accessToken}`)
      .send({
        startsAt: "2026-06-01T10:00:00.000Z",
        endsAt: "2026-06-01T12:00:00.000Z",
      })
      .expect(403);
  });

  it("should reject registering a prospect quote with a duplicated customer document", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: CustomerDocument.create("52998224725"),
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });

    const createResponse = await request(getHttpServer(app))
      .post("/quotes")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        customer: {
          name: "Duplicated Document Prospect",
          cpfCnpj: "52998224725",
        },
        vehicle: { brand: "Honda", model: "HR-V" },
        serviceItems: [{ serviceId: service.id.toString() }],
        paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
      });
    const quoteId = quoteResponseSchema.parse(createResponse.body).quote.id;

    const registerResponse = await request(getHttpServer(app))
      .post(`/quotes/${quoteId}/register-customer`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        email: "duplicated-document@example.com",
        createVehicleFromQuote: true,
      });

    expect(createResponse.status).toBe(201);
    expect(registerResponse.status).toBe(409);
    expect(errorResponseSchema.parse(registerResponse.body)).toMatchObject({
      code: "CUSTOMER_ALREADY_EXISTS",
    });
  });

  it("should reject approving a quote that was already converted", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });
    const createResponse = await request(getHttpServer(app))
      .post("/quotes")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        customer: { name: "Already Converted Prospect" },
        vehicle: { brand: "Honda", model: "HR-V" },
        serviceItems: [{ serviceId: service.id.toString() }],
        paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
      });
    const quoteId = quoteResponseSchema.parse(createResponse.body).quote.id;

    const registerResponse = await request(getHttpServer(app))
      .post(`/quotes/${quoteId}/register-customer`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        email: "already-converted@example.com",
        createVehicleFromQuote: true,
      });

    const firstApproveResponse = await request(getHttpServer(app))
      .post(`/quotes/${quoteId}/approve`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        startsAt: "2026-06-01T10:00:00.000Z",
        endsAt: "2026-06-01T12:00:00.000Z",
      });
    const secondApproveResponse = await request(getHttpServer(app))
      .post(`/quotes/${quoteId}/approve`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        startsAt: "2026-06-02T10:00:00.000Z",
        endsAt: "2026-06-02T12:00:00.000Z",
      });

    expect(registerResponse.status).toBe(201);
    expect(firstApproveResponse.status).toBe(201);
    expect(secondApproveResponse.status).toBe(400);
    expect(errorResponseSchema.parse(secondApproveResponse.body)).toMatchObject(
      {
        code: "QUOTE_ALREADY_CONVERTED",
      },
    );
  });

  it("should reject creating a vehicle from a quote without vehicle snapshot", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });

    const createResponse = await request(getHttpServer(app))
      .post("/quotes")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        customer: { name: "No Vehicle Prospect" },
        serviceItems: [{ serviceId: service.id.toString() }],
        paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
      });
    const quoteId = quoteResponseSchema.parse(createResponse.body).quote.id;

    const registerResponse = await request(getHttpServer(app))
      .post(`/quotes/${quoteId}/register-customer`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        email: "no-vehicle@example.com",
        createVehicleFromQuote: true,
      });

    expect(createResponse.status).toBe(201);
    expect(registerResponse.status).toBe(400);
    expect(errorResponseSchema.parse(registerResponse.body)).toMatchObject({
      code: "QUOTE_VEHICLE_SNAPSHOT_MISSING",
    });
  });
});
