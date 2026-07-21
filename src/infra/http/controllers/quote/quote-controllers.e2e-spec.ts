import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type SuperAgentResponse from "superagent/lib/node/response";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

import { Email } from "../../../../modules/accounts/domain/value-objects/email";
import { Phone } from "../../../../modules/accounts/domain/value-objects/phone";
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
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { getSaoPauloDayBounds } from "../../../../shared/utils/get-sao-paulo-day-bounds";
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

const quoteApprovalAnalysisSchema = z.object({
  status: z.enum(["READY", "REQUIRES_RESOLUTION"]),
  automaticResolutions: z.array(
    z.object({
      resource: z.enum(["CUSTOMER"]),
      action: z.enum(["LINK_EXISTING"]),
      resourceId: z.uuid(),
      matchedBy: z.enum(["CPF_CNPJ"]),
    }),
  ),
  customer: z.object({
    status: z.enum([
      "RESOLVED",
      "AUTO_LINK",
      "CANDIDATES_FOUND",
      "CREATE_REQUIRED",
      "LINKED_RESOURCE_DELETED",
    ]),
    requiresResolution: z.boolean(),
    automaticCustomerId: z.uuid().nullable(),
    candidates: z.array(
      z.object({
        customerId: z.uuid(),
        matchedBy: z.array(z.enum(["CPF_CNPJ", "PHONE", "EMAIL", "NAME"])),
        conflictingFields: z.array(z.enum(["NAME", "PHONE", "EMAIL"])),
        advisoryOnly: z.boolean(),
      }),
    ),
  }),
  vehicle: z.object({
    status: z.enum([
      "NONE",
      "RESOLVED",
      "CANDIDATE_FOUND",
      "SNAPSHOT_ONLY",
      "OWNERSHIP_CONFLICT",
      "LINKED_RESOURCE_DELETED",
    ]),
    requiresResolution: z.boolean(),
    candidateVehicleId: z.uuid().nullable(),
    candidateCustomerId: z.uuid().nullable(),
    allowedActions: z.array(
      z.enum([
        "LINK_EXISTING",
        "CREATE_FROM_SNAPSHOT",
        "KEEP_SNAPSHOT_ONLY",
        "EDIT_SNAPSHOT_PLATE",
      ]),
    ),
  }),
  services: z.array(
    z.object({
      quoteServiceId: z.uuid(),
      status: z.enum([
        "RESOLVED",
        "READY_TO_CREATE",
        "CANDIDATE_FOUND",
        "LINKED_SERVICE_INACTIVE",
        "LINKED_SERVICE_DELETED",
        "LINKED_SERVICE_MISSING",
      ]),
      requiresResolution: z.boolean(),
      serviceId: z.uuid().nullable(),
      candidateServiceId: z.uuid().nullable(),
      snapshot: z.object({
        name: z.string().min(1),
        priceInCents: z.number().int().nonnegative(),
        durationInMinutes: z.number().int().nullable(),
        categoryId: z.uuid().nullable(),
        categoryName: z.string().nullable(),
        isCourtesy: z.boolean(),
      }),
      candidate: z
        .object({
          serviceId: z.uuid(),
          name: z.string().min(1),
          isActive: z.boolean(),
          priceSpecification: z.discriminatedUnion("type", [
            z.object({
              type: z.literal("FIXED"),
              fixedPriceInCents: z.number().int().nonnegative(),
            }),
            z.object({
              type: z.literal("STARTING_AT"),
              minPriceInCents: z.number().int().nonnegative(),
            }),
            z.object({
              type: z.literal("RANGE"),
              minPriceInCents: z.number().int().nonnegative(),
              maxPriceInCents: z.number().int().nonnegative(),
            }),
          ]),
          durationInMinutes: z.number().int().nullable(),
          categoryId: z.uuid().nullable(),
          categoryName: z.string().nullable(),
        })
        .nullable(),
      differences: z.array(
        z.enum([
          "NAME",
          "CATEGORY",
          "DURATION",
          "PRICE_SPECIFICATION",
          "PRICE",
        ]),
      ),
      allowedActions: z.array(
        z.enum([
          "ASSOCIATE_EXISTING",
          "KEEP_INACTIVE_LINK",
          "RENAME_DETACHED",
          "RECREATE_FROM_SNAPSHOT",
        ]),
      ),
    }),
  ),
});

const approvalAnalysisResponseSchema = z.object({
  analysis: quoteApprovalAnalysisSchema,
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
  analysis: quoteApprovalAnalysisSchema.optional(),
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

describe.sequential("Quote controllers (e2e)", () => {
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

  function uniqueName(prefix: string) {
    return `${prefix} ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;
  }

  async function createCustomerQuoteWithLinkedActiveService(input: {
    accessToken: string;
    establishmentId: UniqueEntityId;
    serviceName?: string;
    servicePriceInCents?: number;
    customerName?: string;
    vehicle?: {
      plate?: string;
      brand: string;
      model: string;
      color?: string;
      year?: number;
    } | null;
  }) {
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: input.establishmentId,
      fullName: input.customerName ?? uniqueName("Approval Customer"),
      cpfCnpj: null,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: customer.establishmentId,
      serviceName: ServiceName.create(
        input.serviceName ?? uniqueName("Approval Linked Service"),
      ),
      priceSpecification: ServicePriceSpecification.create({
        type: "FIXED",
        fixedPriceInCents: input.servicePriceInCents ?? 30000,
      }),
    });
    let vehicleId: string | undefined;

    if (input.vehicle) {
      const vehicle = await prisma.customerVehicle.create({
        data: {
          establishmentId: input.establishmentId.toString(),
          customerId: customer.id.toString(),
          plate: input.vehicle.plate ?? null,
          brand: input.vehicle.brand,
          model: input.vehicle.model,
          color: input.vehicle.color ?? null,
          year: input.vehicle.year ?? null,
        },
      });
      vehicleId = vehicle.id;
    }

    const createResponse = await request(getHttpServer(app))
      .post("/quotes")
      .set("Authorization", `Bearer ${input.accessToken}`)
      .send({
        customerId: customer.id.toString(),
        ...(vehicleId ? { vehicleId } : {}),
        serviceItems: [{ serviceId: service.id.toString() }],
        paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
      });
    const body = quoteResponseSchema.parse(createResponse.body);

    expect(createResponse.status).toBe(201);

    return {
      quoteId: body.quote.id,
      customerId: customer.id.toString(),
      vehicleId,
      serviceId: service.id.toString(),
    };
  }

  async function createProspectQuoteWithEvidence(input: {
    accessToken: string;
    serviceId: string;
    name: string;
    phone?: string;
    cpfCnpj?: string;
    email?: string;
    vehicle?: {
      plate?: string;
      brand: string;
      model: string;
      color?: string;
      year?: number;
    };
  }) {
    const createResponse = await request(getHttpServer(app))
      .post("/quotes")
      .set("Authorization", `Bearer ${input.accessToken}`)
      .send({
        customer: {
          name: input.name,
          ...(input.phone ? { phone: input.phone } : {}),
          ...(input.cpfCnpj ? { cpfCnpj: input.cpfCnpj } : {}),
        },
        ...(input.vehicle ? { vehicle: input.vehicle } : {}),
        serviceItems: [{ serviceId: input.serviceId }],
        paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
      });
    const body = quoteResponseSchema.parse(createResponse.body);

    expect(createResponse.status).toBe(201);

    if (input.email) {
      await prisma.quote.update({
        where: { id: body.quote.id },
        data: { customerEmail: input.email },
      });
    }

    return { quoteId: body.quote.id };
  }

  async function createDetachedServiceQuote(input: {
    accessToken: string;
    customerId: string;
    serviceName: string;
    priceInCents: number;
  }) {
    const createResponse = await request(getHttpServer(app))
      .post("/quotes")
      .set("Authorization", `Bearer ${input.accessToken}`)
      .send({
        customerId: input.customerId,
        serviceItems: [
          {
            serviceName: input.serviceName,
            priceInCents: input.priceInCents,
          },
        ],
        paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
      });
    const body = quoteResponseSchema.parse(createResponse.body);

    expect(createResponse.status).toBe(201);

    return { quoteId: body.quote.id };
  }

  async function analyzeQuote(accessToken: string, quoteId: string) {
    const response = await request(getHttpServer(app))
      .post(`/quotes/${quoteId}/approval-analysis`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ startsAt: "2026-08-01T10:00:00.000Z" });

    expect(response.status).toBe(200);

    return approvalAnalysisResponseSchema.parse(response.body).analysis;
  }

  async function approveQuote(
    accessToken: string,
    quoteId: string,
    body: Record<string, unknown> = {},
  ) {
    return request(getHttpServer(app))
      .post(`/quotes/${quoteId}/approve`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        startsAt: "2026-08-01T10:00:00.000Z",
        ...body,
      });
  }

  async function changeServicePriceSpecification(input: {
    serviceId: string;
    type: "FIXED" | "STARTING_AT";
    priceInCents: number;
  }) {
    await prisma.service.update({
      where: { id: input.serviceId },
      data: {
        priceSpecificationType: input.type,
        priceInCents: input.priceInCents,
        priceRangeMaxInCents: null,
      },
    });
  }

  async function markLinkedServiceInactive(serviceId: string) {
    await prisma.service.update({
      where: { id: serviceId },
      data: { isActive: false },
    });
  }

  async function softDeleteLinkedService(serviceId: string) {
    await prisma.service.update({
      where: { id: serviceId },
      data: { deletedAt: new Date() },
    });
  }

  it.sequential(
    "should create, list, get, export, register prospect, and approve quote",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
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
      expect(createBody.quote.paymentOptions[0]?.totalInCents).toBeGreaterThan(
        0,
      );

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
      const approveBody = approveQuoteResponseSchema.parse(
        approveResponse.body,
      );

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
    },
  );

  it.sequential(
    "should reject quote creation with an invalid prospect phone",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
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
    },
  );

  it.sequential(
    "should reject quote creation with an incomplete vehicle snapshot",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
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
      const invalidYearTypeResponse = await request(getHttpServer(app))
        .post("/quotes")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          customer: { name: "Veiculo Com Ano Invalido" },
          vehicle: { brand: "Honda", model: "HR-V", year: "2025" },
          serviceItems: [{ serviceId: service.id.toString() }],
          paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
        });

      expect(withoutBrandResponse.status).toBe(400);
      expect(withoutModelResponse.status).toBe(400);
      expect(invalidYearTypeResponse.status).toBe(400);
      expect(
        errorResponseSchema.parse(withoutBrandResponse.body),
      ).toMatchObject({
        code: "VALIDATION_ERROR",
        errors: [{ field: "vehicle.brand", code: "REQUIRED" }],
      });
      expect(
        errorResponseSchema.parse(withoutModelResponse.body),
      ).toMatchObject({
        code: "VALIDATION_ERROR",
        errors: [{ field: "vehicle.model", code: "REQUIRED" }],
      });
      expect(
        errorResponseSchema.parse(invalidYearTypeResponse.body),
      ).toMatchObject({
        code: "VALIDATION_ERROR",
        errors: [{ field: "vehicle.year", code: "INVALID_TYPE" }],
      });
    },
  );

  it.sequential(
    "should return a stable code when a quote contains an inactive service",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
      const service = await serviceFactory.makePrismaService({
        establishmentId: establishment.id,
        isActive: false,
      });

      const response = await request(getHttpServer(app))
        .post("/quotes")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          customer: { name: "Servico Inativo" },
          serviceItems: [{ serviceId: service.id.toString() }],
          paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
        });

      expect(response.status).toBe(400);
      expect(errorResponseSchema.parse(response.body)).toMatchObject({
        code: "QUOTE_SERVICE_INACTIVE",
      });
    },
  );

  it.sequential(
    "should create a prospect quote with vehicle snapshot and detached service",
    async () => {
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
    },
  );

  it.sequential(
    "should analyze a document match as ready and auto-link the customer on approval",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
      const customer = await customerFactory.makePrismaCustomer({
        establishmentId: establishment.id,
        fullName: "Existing Document Customer",
        cpfCnpj: CustomerDocument.create("52998224725"),
      });
      const service = await serviceFactory.makePrismaService({
        establishmentId: establishment.id,
        serviceName: ServiceName.create(uniqueName("Document Auto Service")),
      });
      const { quoteId } = await createProspectQuoteWithEvidence({
        accessToken,
        serviceId: service.id.toString(),
        name: "Prospect With Document",
        cpfCnpj: "529.982.247-25",
      });

      const analysis = await analyzeQuote(accessToken, quoteId);

      expect(analysis.status).toBe("READY");
      expect(analysis.customer).toMatchObject({
        status: "AUTO_LINK",
        requiresResolution: false,
        automaticCustomerId: customer.id.toString(),
      });
      expect(analysis.automaticResolutions).toEqual([
        {
          resource: "CUSTOMER",
          action: "LINK_EXISTING",
          resourceId: customer.id.toString(),
          matchedBy: "CPF_CNPJ",
        },
      ]);

      const approveResponse = await approveQuote(accessToken, quoteId);
      const approveBody = approveQuoteResponseSchema.parse(
        approveResponse.body,
      );

      expect(approveResponse.status).toBe(201);
      expect(approveBody.quote.customerId).toBe(customer.id.toString());
    },
  );

  it.sequential(
    "should require explicit customer resolution for phone and email evidence",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
      const customer = await customerFactory.makePrismaCustomer({
        establishmentId: establishment.id,
        fullName: "Evidence Customer",
        phone: Phone.create("11977776666"),
        email: new Email("evidence@example.com"),
        cpfCnpj: null,
      });
      const service = await serviceFactory.makePrismaService({
        establishmentId: establishment.id,
        serviceName: ServiceName.create(uniqueName("Evidence Service")),
      });
      const { quoteId } = await createProspectQuoteWithEvidence({
        accessToken,
        serviceId: service.id.toString(),
        name: "Different Evidence Name",
        phone: "(11) 97777-6666",
        email: "evidence@example.com",
      });

      const analysis = await analyzeQuote(accessToken, quoteId);

      expect(analysis.status).toBe("REQUIRES_RESOLUTION");
      expect(analysis.customer.status).toBe("CANDIDATES_FOUND");
      expect(analysis.customer.candidates).toEqual([
        expect.objectContaining({
          customerId: customer.id.toString(),
          matchedBy: ["PHONE", "EMAIL"],
          conflictingFields: ["NAME"],
          advisoryOnly: false,
        }),
      ]);

      const unresolvedResponse = await approveQuote(accessToken, quoteId);
      expect(unresolvedResponse.status).toBe(409);
      expect(errorResponseSchema.parse(unresolvedResponse.body)).toMatchObject({
        code: "QUOTE_APPROVAL_RESOLUTION_REQUIRED",
        analysis: {
          customer: {
            status: "CANDIDATES_FOUND",
          },
        },
      });

      const approveResponse = await approveQuote(accessToken, quoteId, {
        customerResolution: {
          action: "LINK_EXISTING",
          customerId: customer.id.toString(),
        },
      });
      const approveBody = approveQuoteResponseSchema.parse(
        approveResponse.body,
      );

      expect(approveResponse.status).toBe(201);
      expect(approveBody.quote.customerId).toBe(customer.id.toString());
    },
  );

  it.sequential(
    "should require explicit customer resolution for advisory-only candidates",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
      const sharedName = uniqueName("Advisory Customer");
      const advisoryCustomer = await customerFactory.makePrismaCustomer({
        establishmentId: establishment.id,
        fullName: sharedName,
        phone: Phone.create("11911112222"),
        email: new Email("advisory-existing@example.com"),
        cpfCnpj: null,
      });
      const service = await serviceFactory.makePrismaService({
        establishmentId: establishment.id,
        serviceName: ServiceName.create(uniqueName("Advisory Service")),
      });
      const { quoteId } = await createProspectQuoteWithEvidence({
        accessToken,
        serviceId: service.id.toString(),
        name: sharedName,
      });

      const analysis = await analyzeQuote(accessToken, quoteId);

      expect(analysis.status).toBe("REQUIRES_RESOLUTION");
      expect(analysis.customer).toMatchObject({
        status: "CANDIDATES_FOUND",
        requiresResolution: true,
      });
      expect(analysis.customer.candidates).toEqual([
        expect.objectContaining({
          customerId: advisoryCustomer.id.toString(),
          matchedBy: ["NAME"],
          advisoryOnly: true,
        }),
      ]);

      const unresolvedResponse = await approveQuote(accessToken, quoteId);
      expect(unresolvedResponse.status).toBe(409);
      expect(errorResponseSchema.parse(unresolvedResponse.body)).toMatchObject({
        code: "QUOTE_APPROVAL_RESOLUTION_REQUIRED",
        analysis: {
          customer: {
            status: "CANDIDATES_FOUND",
            requiresResolution: true,
          },
        },
      });

      const approveResponse = await approveQuote(accessToken, quoteId, {
        customerResolution: {
          action: "CREATE_NEW",
          email: "advisory-created@example.com",
          phone: "11933334444",
        },
      });
      const approveBody = approveQuoteResponseSchema.parse(
        approveResponse.body,
      );

      expect(approveResponse.status).toBe(201);
      expect(approveBody.quote.customerId).not.toBe(
        advisoryCustomer.id.toString(),
      );
      expect(approveBody.quote.customer.phone).toBeNull();
    },
  );

  it.sequential(
    "should expose vehicle ownership conflicts and approve keeping only the snapshot",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
      const quoteCustomer = await customerFactory.makePrismaCustomer({
        establishmentId: establishment.id,
        fullName: "Vehicle Snapshot Customer",
      });
      const vehicleOwner = await customerFactory.makePrismaCustomer({
        establishmentId: establishment.id,
        fullName: "Vehicle Owner Customer",
        cpfCnpj: null,
      });
      const conflictingVehicle = await prisma.customerVehicle.create({
        data: {
          establishmentId: establishment.id.toString(),
          customerId: vehicleOwner.id.toString(),
          plate: "OWN1R23",
          brand: "Toyota",
          model: "Corolla",
        },
      });
      const service = await serviceFactory.makePrismaService({
        establishmentId: establishment.id,
        serviceName: ServiceName.create(uniqueName("Vehicle Conflict Service")),
      });
      const createResponse = await request(getHttpServer(app))
        .post("/quotes")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          customerId: quoteCustomer.id.toString(),
          vehicle: {
            plate: "OWN-1R23",
            brand: "Honda",
            model: "Civic",
            color: "Prata",
            year: 2024,
          },
          serviceItems: [{ serviceId: service.id.toString() }],
          paymentOptions: [{ method: "PIX", label: "Pix", installments: 1 }],
        });
      const quoteId = quoteResponseSchema.parse(createResponse.body).quote.id;

      const analysis = await analyzeQuote(accessToken, quoteId);

      expect(createResponse.status).toBe(201);
      expect(analysis.status).toBe("REQUIRES_RESOLUTION");
      expect(analysis.vehicle).toMatchObject({
        status: "OWNERSHIP_CONFLICT",
        candidateVehicleId: conflictingVehicle.id,
        candidateCustomerId: vehicleOwner.id.toString(),
        allowedActions: ["EDIT_SNAPSHOT_PLATE", "KEEP_SNAPSHOT_ONLY"],
      });

      const approveResponse = await approveQuote(accessToken, quoteId, {
        vehicleResolution: { action: "KEEP_SNAPSHOT_ONLY" },
      });
      const approveBody = approveQuoteResponseSchema.parse(
        approveResponse.body,
      );
      const appointment = await prisma.appointment.findUniqueOrThrow({
        where: { id: approveBody.appointment.id },
      });

      expect(approveResponse.status).toBe(201);
      expect(approveBody.quote.vehicleId).toBeNull();
      expect(approveBody.quote.vehicle).toMatchObject({
        plate: "OWN1R23",
        brand: "Honda",
        model: "Civic",
      });
      expect(appointment.vehicleId).toBeNull();
      expect(appointment.vehiclePlate).toBe("OWN1R23");
      expect(appointment.vehicleBrand).toBe("Honda");
    },
  );

  it.sequential(
    "should associate a detached service candidate and preserve the quote snapshot price",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
      const customer = await customerFactory.makePrismaCustomer({
        establishmentId: establishment.id,
        fullName: "Detached Association Customer",
      });
      const detachedName = uniqueName("Detached Shared Service");
      const firstQuote = await createDetachedServiceQuote({
        accessToken,
        customerId: customer.id.toString(),
        serviceName: detachedName,
        priceInCents: 41000,
      });
      const secondQuote = await createDetachedServiceQuote({
        accessToken,
        customerId: customer.id.toString(),
        serviceName: detachedName,
        priceInCents: 52000,
      });

      const firstApproveResponse = await approveQuote(
        accessToken,
        firstQuote.quoteId,
      );
      expect(firstApproveResponse.status).toBe(201);

      const createdService = await prisma.service.findFirstOrThrow({
        where: {
          establishmentId: establishment.id.toString(),
          serviceName: detachedName,
          deletedAt: null,
        },
      });

      const analysis = await analyzeQuote(accessToken, secondQuote.quoteId);
      const serviceAnalysis = analysis.services[0];

      expect(analysis.status).toBe("REQUIRES_RESOLUTION");
      expect(serviceAnalysis).toMatchObject({
        status: "CANDIDATE_FOUND",
        candidateServiceId: createdService.id,
        allowedActions: ["ASSOCIATE_EXISTING", "RENAME_DETACHED"],
      });

      const approveResponse = await approveQuote(
        accessToken,
        secondQuote.quoteId,
        {
          serviceResolutions: [
            {
              quoteServiceId: serviceAnalysis?.quoteServiceId,
              action: "ASSOCIATE_EXISTING",
              serviceId: createdService.id,
            },
          ],
        },
      );
      const approveBody = approveQuoteResponseSchema.parse(
        approveResponse.body,
      );
      const bookedService =
        await prisma.appointmentBookedService.findFirstOrThrow({
          where: { appointmentId: approveBody.appointment.id },
        });

      expect(approveResponse.status).toBe(201);
      expect(bookedService.serviceId).toBe(createdService.id);
      expect(bookedService.serviceName).toBe(detachedName);
      expect(bookedService.servicePriceInCents).toBe(52000);
    },
  );

  it.sequential(
    "should retain the original linked-service snapshot after catalog pricing changes",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
      const serviceName = uniqueName("Starting At Snapshot Service");
      const service = await serviceFactory.makePrismaService({
        establishmentId: establishment.id,
        serviceName: ServiceName.create(serviceName),
        priceSpecification: ServicePriceSpecification.create({
          type: "STARTING_AT",
          minPriceInCents: 4000,
        }),
      });
      const { quoteId } = await createCustomerQuoteWithLinkedActiveService({
        accessToken,
        establishmentId: establishment.id,
        serviceName: uniqueName("Unused Service"),
      });

      await prisma.quoteService.updateMany({
        where: { quoteId },
        data: {
          serviceId: service.id.toString(),
          serviceName,
          servicePriceInCents: 4000,
        },
      });
      await changeServicePriceSpecification({
        serviceId: service.id.toString(),
        type: "FIXED",
        priceInCents: 2222,
      });

      const analysis = await analyzeQuote(accessToken, quoteId);
      expect(analysis.status).toBe("READY");
      expect(analysis.services[0]).toMatchObject({
        status: "RESOLVED",
        differences: ["PRICE_SPECIFICATION", "PRICE"],
      });

      const approveResponse = await approveQuote(accessToken, quoteId);
      const approveBody = approveQuoteResponseSchema.parse(
        approveResponse.body,
      );
      const bookedService =
        await prisma.appointmentBookedService.findFirstOrThrow({
          where: { appointmentId: approveBody.appointment.id },
        });

      expect(approveResponse.status).toBe(201);
      expect(bookedService.serviceId).toBe(service.id.toString());
      expect(bookedService.serviceName).toBe(serviceName);
      expect(bookedService.servicePriceInCents).toBe(4000);
    },
  );

  it.sequential(
    "should validate detached service renames and keep commercial snapshot values",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
      const customer = await customerFactory.makePrismaCustomer({
        establishmentId: establishment.id,
        fullName: "Detached Rename Customer",
      });
      const originalName = uniqueName("Rename Candidate Service");
      const unavailableName = uniqueName("Rename Unavailable Service");
      const validName = uniqueName("Rename Valid Service");

      const { quoteId } = await createDetachedServiceQuote({
        accessToken,
        customerId: customer.id.toString(),
        serviceName: originalName,
        priceInCents: 61000,
      });
      await serviceFactory.makePrismaService({
        establishmentId: establishment.id,
        serviceName: ServiceName.create(originalName),
      });
      await serviceFactory.makePrismaService({
        establishmentId: establishment.id,
        serviceName: ServiceName.create(unavailableName),
      });
      const paymentOption = await prisma.quotePaymentOption.findFirstOrThrow({
        where: { quoteId },
      });

      const analysis = await analyzeQuote(accessToken, quoteId);
      const serviceAnalysis = analysis.services[0];

      expect(serviceAnalysis).toMatchObject({
        status: "CANDIDATE_FOUND",
      });

      const unavailableRenameResponse = await approveQuote(
        accessToken,
        quoteId,
        {
          serviceResolutions: [
            {
              quoteServiceId: serviceAnalysis?.quoteServiceId,
              action: "RENAME_DETACHED",
              serviceName: unavailableName,
            },
          ],
        },
      );

      expect(unavailableRenameResponse.status).toBe(400);
      expect(
        errorResponseSchema.parse(unavailableRenameResponse.body),
      ).toMatchObject({
        code: "QUOTE_SERVICE_NAME_UNAVAILABLE",
      });

      const approveResponse = await approveQuote(accessToken, quoteId, {
        serviceResolutions: [
          {
            quoteServiceId: serviceAnalysis?.quoteServiceId,
            action: "RENAME_DETACHED",
            serviceName: validName,
          },
        ],
      });
      const approveBody = approveQuoteResponseSchema.parse(
        approveResponse.body,
      );
      const bookedService =
        await prisma.appointmentBookedService.findFirstOrThrow({
          where: { appointmentId: approveBody.appointment.id },
        });
      const quoteService = await prisma.quoteService.findFirstOrThrow({
        where: { quoteId },
      });
      const createdService = await prisma.service.findFirstOrThrow({
        where: {
          establishmentId: establishment.id.toString(),
          serviceName: validName,
          deletedAt: null,
        },
      });
      const updatedPaymentOption =
        await prisma.quotePaymentOption.findFirstOrThrow({
          where: { quoteId },
        });

      expect(approveResponse.status).toBe(201);
      expect(quoteService.serviceName).toBe(validName);
      expect(createdService.priceInCents).toBe(61000);
      expect(bookedService.serviceName).toBe(validName);
      expect(bookedService.servicePriceInCents).toBe(61000);
      expect(updatedPaymentOption.totalInCents).toBe(
        paymentOption.totalInCents,
      );
    },
  );

  it.sequential(
    "should require explicit handling for inactive and deleted linked services",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
      const inactiveQuote = await createCustomerQuoteWithLinkedActiveService({
        accessToken,
        establishmentId: establishment.id,
        serviceName: uniqueName("Inactive Linked Service"),
        servicePriceInCents: 33000,
      });

      await markLinkedServiceInactive(inactiveQuote.serviceId);

      const inactiveAnalysis = await analyzeQuote(
        accessToken,
        inactiveQuote.quoteId,
      );
      expect(inactiveAnalysis.status).toBe("REQUIRES_RESOLUTION");
      expect(inactiveAnalysis.services[0]).toMatchObject({
        status: "LINKED_SERVICE_INACTIVE",
        serviceId: inactiveQuote.serviceId,
        allowedActions: ["KEEP_INACTIVE_LINK", "ASSOCIATE_EXISTING"],
      });

      const unresolvedInactiveResponse = await approveQuote(
        accessToken,
        inactiveQuote.quoteId,
      );
      expect(unresolvedInactiveResponse.status).toBe(409);
      expect(
        errorResponseSchema.parse(unresolvedInactiveResponse.body),
      ).toMatchObject({
        code: "QUOTE_APPROVAL_RESOLUTION_REQUIRED",
        analysis: {
          services: [
            expect.objectContaining({
              status: "LINKED_SERVICE_INACTIVE",
            }),
          ],
        },
      });

      const keepInactiveResponse = await approveQuote(
        accessToken,
        inactiveQuote.quoteId,
        {
          serviceResolutions: [
            {
              quoteServiceId: inactiveAnalysis.services[0]?.quoteServiceId,
              action: "KEEP_INACTIVE_LINK",
            },
          ],
        },
      );
      expect(keepInactiveResponse.status).toBe(201);

      const deletedQuote = await createCustomerQuoteWithLinkedActiveService({
        accessToken,
        establishmentId: establishment.id,
        serviceName: uniqueName("Deleted Linked Service"),
        servicePriceInCents: 47000,
      });

      await softDeleteLinkedService(deletedQuote.serviceId);

      const deletedAnalysis = await analyzeQuote(
        accessToken,
        deletedQuote.quoteId,
      );
      expect(deletedAnalysis.services[0]).toMatchObject({
        status: "LINKED_SERVICE_DELETED",
        serviceId: deletedQuote.serviceId,
        allowedActions: ["ASSOCIATE_EXISTING", "RECREATE_FROM_SNAPSHOT"],
      });

      const keepDeletedResponse = await approveQuote(
        accessToken,
        deletedQuote.quoteId,
        {
          serviceResolutions: [
            {
              quoteServiceId: deletedAnalysis.services[0]?.quoteServiceId,
              action: "KEEP_INACTIVE_LINK",
            },
          ],
        },
      );
      expect(keepDeletedResponse.status).toBe(400);
      expect(errorResponseSchema.parse(keepDeletedResponse.body)).toMatchObject(
        {
          code: "QUOTE_INVALID_RESOLUTION_ACTION",
        },
      );

      const recreateResponse = await approveQuote(
        accessToken,
        deletedQuote.quoteId,
        {
          serviceResolutions: [
            {
              quoteServiceId: deletedAnalysis.services[0]?.quoteServiceId,
              action: "RECREATE_FROM_SNAPSHOT",
            },
          ],
        },
      );
      const recreateBody = approveQuoteResponseSchema.parse(
        recreateResponse.body,
      );
      const recreatedQuoteService = await prisma.quoteService.findFirstOrThrow({
        where: { quoteId: deletedQuote.quoteId },
      });
      const bookedService =
        await prisma.appointmentBookedService.findFirstOrThrow({
          where: { appointmentId: recreateBody.appointment.id },
        });

      expect(recreateResponse.status).toBe(201);
      expect(recreatedQuoteService.serviceId).not.toBe(deletedQuote.serviceId);
      expect(bookedService.serviceId).toBe(recreatedQuoteService.serviceId);
      expect(bookedService.servicePriceInCents).toBe(47000);
    },
  );

  it.sequential(
    "should reject stale service analysis with the current approval analysis",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
      const customer = await customerFactory.makePrismaCustomer({
        establishmentId: establishment.id,
        fullName: "Stale Service Customer",
      });
      const serviceName = uniqueName("Stale Candidate Service");
      const { quoteId } = await createDetachedServiceQuote({
        accessToken,
        customerId: customer.id.toString(),
        serviceName,
        priceInCents: 39000,
      });
      const staleCandidate = await serviceFactory.makePrismaService({
        establishmentId: establishment.id,
        serviceName: ServiceName.create(serviceName),
      });
      const staleAnalysis = await analyzeQuote(accessToken, quoteId);
      const staleServiceAnalysis = staleAnalysis.services[0];
      const currentCandidate = await serviceFactory.makePrismaService({
        establishmentId: establishment.id,
        serviceName: ServiceName.create(uniqueName("Temporary Service Name")),
      });

      await prisma.service.update({
        where: { id: staleCandidate.id.toString() },
        data: { serviceName: uniqueName("Renamed Stale Candidate") },
      });
      await prisma.service.update({
        where: { id: currentCandidate.id.toString() },
        data: { serviceName },
      });

      const response = await approveQuote(accessToken, quoteId, {
        serviceResolutions: [
          {
            quoteServiceId: staleServiceAnalysis?.quoteServiceId,
            action: "ASSOCIATE_EXISTING",
            serviceId: staleCandidate.id.toString(),
          },
        ],
      });
      const body = errorResponseSchema.parse(response.body);

      expect(response.status).toBe(409);
      expect(body).toMatchObject({
        code: "QUOTE_APPROVAL_CONFLICTS_CHANGED",
        analysis: {
          services: [
            expect.objectContaining({
              status: "CANDIDATE_FOUND",
              candidateServiceId: currentCandidate.id.toString(),
            }),
          ],
        },
      });
    },
  );

  it.sequential(
    "should convert only one appointment when the same quote is approved concurrently",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
      const { quoteId } = await createCustomerQuoteWithLinkedActiveService({
        accessToken,
        establishmentId: establishment.id,
        serviceName: uniqueName("Concurrent Same Quote Service"),
      });

      const responses = await Promise.all([
        approveQuote(accessToken, quoteId, {
          startsAt: "2026-08-02T10:00:00.000Z",
        }),
        approveQuote(accessToken, quoteId, {
          startsAt: "2026-08-02T10:00:00.000Z",
        }),
      ]);
      const statuses = responses.map((response) => response.status).sort();
      const failedResponse = responses.find(
        (response) => response.status !== 201,
      );
      const convertedQuote = await prisma.quote.findUniqueOrThrow({
        where: { id: quoteId },
      });
      const appointmentCount = await prisma.appointment.count({
        where: { establishmentId: establishment.id.toString() },
      });

      expect(statuses).toEqual([201, 400]);
      expect(errorResponseSchema.parse(failedResponse?.body)).toMatchObject({
        code: "QUOTE_ALREADY_CONVERTED",
      });
      expect(convertedQuote.convertedAppointmentId).toBeTruthy();
      expect(appointmentCount).toBe(1);
    },
  );

  it.sequential(
    "should roll back one concurrent detached-service materialization on name uniqueness",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
      const customer = await customerFactory.makePrismaCustomer({
        establishmentId: establishment.id,
        fullName: "Concurrent Detached Customer",
      });
      const serviceName = uniqueName("Concurrent Detached Unique");
      const firstQuote = await createDetachedServiceQuote({
        accessToken,
        customerId: customer.id.toString(),
        serviceName,
        priceInCents: 71000,
      });
      const secondQuote = await createDetachedServiceQuote({
        accessToken,
        customerId: customer.id.toString(),
        serviceName,
        priceInCents: 72000,
      });

      await expect(
        analyzeQuote(accessToken, firstQuote.quoteId),
      ).resolves.toMatchObject({
        status: "READY",
        services: [expect.objectContaining({ status: "READY_TO_CREATE" })],
      });
      await expect(
        analyzeQuote(accessToken, secondQuote.quoteId),
      ).resolves.toMatchObject({
        status: "READY",
        services: [expect.objectContaining({ status: "READY_TO_CREATE" })],
      });

      const responses = await Promise.all([
        approveQuote(accessToken, firstQuote.quoteId, {
          startsAt: "2026-08-03T10:00:00.000Z",
        }),
        approveQuote(accessToken, secondQuote.quoteId, {
          startsAt: "2026-08-03T11:00:00.000Z",
        }),
      ]);
      const successResponses = responses.filter(
        (response) => response.status === 201,
      );
      const conflictResponse = responses.find(
        (response) => response.status === 409,
      );
      const conflictBody = errorResponseSchema.parse(conflictResponse?.body);
      const serviceCount = await prisma.service.count({
        where: {
          establishmentId: establishment.id.toString(),
          serviceName,
          deletedAt: null,
        },
      });
      const convertedQuoteCount = await prisma.quote.count({
        where: {
          id: { in: [firstQuote.quoteId, secondQuote.quoteId] },
          convertedAppointmentId: { not: null },
        },
      });
      const appointmentCount = await prisma.appointment.count({
        where: {
          establishmentId: establishment.id.toString(),
          id: {
            in: (
              await prisma.quote.findMany({
                where: {
                  id: { in: [firstQuote.quoteId, secondQuote.quoteId] },
                },
                select: { convertedAppointmentId: true },
              })
            )
              .map((quote) => quote.convertedAppointmentId)
              .filter((id): id is string => id !== null),
          },
        },
      });

      expect(successResponses).toHaveLength(1);
      expect(conflictBody).toMatchObject({
        code: "QUOTE_APPROVAL_CONFLICTS_CHANGED",
        analysis: {
          services: [expect.objectContaining({ status: "CANDIDATE_FOUND" })],
        },
      });
      expect(serviceCount).toBe(1);
      expect(appointmentCount).toBe(1);
      expect(convertedQuoteCount).toBe(1);
    },
  );

  it.sequential("should filter, paginate, and sort listed quotes", async () => {
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
    const { todayStart, tomorrowStart } = getSaoPauloDayBounds(new Date());
    const todayNoon = new Date(todayStart.getTime() + 12 * 60 * 60 * 1000);
    const yesterdayNoon = new Date(todayStart.getTime() - 12 * 60 * 60 * 1000);
    const tomorrowNoon = new Date(
      tomorrowStart.getTime() + 12 * 60 * 60 * 1000,
    );
    const saoPauloTodayEnd = new Date(tomorrowStart.getTime() - 1);

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
    const saoPauloEndOfDayQuoteId = await createQuote({
      customerName: "Filtro Prospect Fim do Dia",
      vehiclePlate: "TZD1A23",
      vehicleBrand: "Fiat",
      vehicleModel: "Uno",
      serviceId: polishingService.id.toString(),
      expiresAt: saoPauloTodayEnd,
      createdAt: new Date("2026-06-23T12:00:00.000Z"),
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
      saoPauloEndOfDayQuoteId,
      recentQuoteId,
      middleQuoteId,
      oldestQuoteId,
    ]);
    expect(oldestList.quotes.map((quote) => quote.id)).toEqual([
      oldestQuoteId,
      middleQuoteId,
      recentQuoteId,
      saoPauloEndOfDayQuoteId,
    ]);
    expect(paginatedList.totalItems).toBe(4);
    expect(paginatedList.quotes.map((quote) => quote.id)).toEqual([
      middleQuoteId,
    ]);
    expect(recentList.summary).toEqual({
      valid: 0,
      expiresToday: 2,
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
      [saoPauloEndOfDayQuoteId]: "EXPIRES_TODAY",
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

  it.sequential(
    "should require resolution before approving a prospect quote",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
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

      expect(response.status).toBe(409);
      expect(errorResponseSchema.parse(response.body)).toMatchObject({
        code: "QUOTE_APPROVAL_RESOLUTION_REQUIRED",
        analysis: {
          customer: {
            status: "CREATE_REQUIRED",
          },
        },
      });
    },
  );

  it.sequential(
    "should not create a vehicle when createVehicleFromQuote is false",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
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
    },
  );

  it.sequential(
    "should enforce authentication on quote endpoints",
    async () => {
      const quoteId = "00000000-0000-4000-8000-000000000001";

      await request(getHttpServer(app)).post("/quotes").send({}).expect(401);
      await request(getHttpServer(app)).get("/quotes").expect(401);
      await request(getHttpServer(app))
        .get(`/quotes/${quoteId}/pdf`)
        .expect(401);
      await request(getHttpServer(app))
        .post(`/quotes/${quoteId}/approve`)
        .send({
          startsAt: "2026-06-01T10:00:00.000Z",
        })
        .expect(401);
      await request(getHttpServer(app))
        .post(`/quotes/${quoteId}/approval-analysis`)
        .send({
          startsAt: "2026-06-01T10:00:00.000Z",
        })
        .expect(401);
    },
  );

  it.sequential(
    "should allow employees with quote features to create and approve quotes",
    async () => {
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
    },
  );

  it.sequential("should isolate quote workflows by establishment", async () => {
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
    await request(getHttpServer(app))
      .post(`/quotes/${firstQuoteId}/approval-analysis`)
      .set("Authorization", `Bearer ${secondEstablishmentAuth.accessToken}`)
      .send({
        startsAt: "2026-06-01T10:00:00.000Z",
        endsAt: "2026-06-01T12:00:00.000Z",
      })
      .expect(404);
  });

  it.sequential(
    "should reject employee write workflows when required quote features are missing",
    async () => {
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
      await request(getHttpServer(app))
        .post(`/quotes/${quoteId}/approval-analysis`)
        .set("Authorization", `Bearer ${employeeAuth.accessToken}`)
        .send({
          startsAt: "2026-06-01T10:00:00.000Z",
          endsAt: "2026-06-01T12:00:00.000Z",
        })
        .expect(403);
    },
  );

  it.sequential(
    "should auto-link an existing customer when registering a prospect with an exact document match",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
      const existingCustomer = await customerFactory.makePrismaCustomer({
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
      expect(registerResponse.status).toBe(201);
      const registerBody = registerQuoteProspectResponseSchema.parse(
        registerResponse.body,
      );
      expect(registerBody.customer.id).toBe(existingCustomer.id.toString());
      expect(registerBody.quote.customerId).toBe(
        existingCustomer.id.toString(),
      );
    },
  );

  it.sequential(
    "should reject approving a quote that was already converted",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
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
      expect(
        errorResponseSchema.parse(secondApproveResponse.body),
      ).toMatchObject({
        code: "QUOTE_ALREADY_CONVERTED",
      });
    },
  );

  it.sequential(
    "should reject creating a vehicle from a quote without vehicle snapshot",
    async () => {
      const { accessToken, establishment } = await makeEstablishmentAccessToken(
        {
          app,
          prisma,
          userFactory,
          establishmentFactory,
          envService,
        },
      );
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
    },
  );
});
