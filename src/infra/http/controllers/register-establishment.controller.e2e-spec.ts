import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import z from "zod";

import { DEFAULT_SERVICE_CATEGORY_NAMES } from "../../../modules/catalog/domain/constants/default-service-categories";
import { PersistenceError } from "../../../shared/errors/persistence-error";
import { AppModule } from "../../app.module";
import { PrismaEstablishmentMapper } from "../../database/prisma/mappers/prisma-establishment-mapper";
import { PrismaServiceCategoryMapper } from "../../database/prisma/mappers/prisma-service-category-mapper";
import { PrismaEstablishmentRepository } from "../../database/prisma/repositories/prisma-establishments-repository";
import { PrismaServiceCategoriesRepository } from "../../database/prisma/repositories/prisma-service-categories-repository";
import { PrismaUnitOfWork } from "../../database/prisma/prisma-unit-of-work";
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

function calculateCnpjCheckDigit(digits: number[], weights: number[]) {
  const sum = digits.reduce((total, digit, index) => {
    return total + digit * weights[index]!;
  }, 0);
  const remainder = sum % 11;

  return remainder < 2 ? 0 : 11 - remainder;
}

function makeValidCnpj(sequence: number) {
  const base = `11222333${String(sequence).padStart(4, "0")}`;
  const baseDigits = Array.from(base, Number);
  const firstDigit = calculateCnpjCheckDigit(
    baseDigits,
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  const secondDigit = calculateCnpjCheckDigit(
    [...baseDigits, firstDigit],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );

  return `${base}${firstDigit}${secondDigit}`;
}

function makeConcurrentRegisterEstablishmentPayload(index: number) {
  const sequence = index + 1;

  return {
    ...makeRegisterEstablishmentPayload(),
    name: `Concurrent Owner ${sequence}`,
    tradeName: `Concurrent Establishment ${sequence}`,
    legalBusinessName: `CONCURRENT BUSINESS ${sequence} LTDA`,
    email: `concurrent-establishment-${sequence}@example.com`,
    cnpj: makeValidCnpj(sequence),
    phone: `1198765432${index}`,
    address: {
      street: `concurrent-street-${sequence}`,
      country: "country-1",
      state: "state-1",
      zipCode: "11111-111",
      city: `concurrent-city-${sequence}`,
    },
  };
}

function createBarrier(expectedParticipants: number) {
  let participants = 0;
  let release!: () => void;
  const allParticipantsArrived = new Promise<void>((resolve) => {
    release = resolve;
  });

  return {
    async wait() {
      participants += 1;

      if (participants === expectedParticipants) {
        release();
      }

      await allParticipantsArrived;
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
    expect(
      await prisma.serviceCategory.count({
        where: { establishmentId: responseBody.establishmentId },
      }),
    ).toBe(DEFAULT_SERVICE_CATEGORY_NAMES.length);
  });

  it("should keep domain events isolated when registering establishments concurrently", async () => {
    const concurrentRequestsCount = 5;
    const payloads = Array.from(
      { length: concurrentRequestsCount },
      (_, index) => makeConcurrentRegisterEstablishmentPayload(index),
    );
    const repositoryBarrier = createBarrier(concurrentRequestsCount);

    vi.spyOn(
      PrismaEstablishmentRepository.prototype,
      "create",
    ).mockImplementation(async function (
      this: PrismaEstablishmentRepository,
      establishment,
    ) {
      await PrismaUnitOfWork.getClient(prisma).establishment.create({
        data: PrismaEstablishmentMapper.toPrisma(establishment),
      });
      await repositoryBarrier.wait();
    });

    const responses = await Promise.all(
      payloads.map((payload) =>
        request(getHttpServer(app))
          .post("/register/establishment")
          .send(payload),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual(
      Array.from({ length: concurrentRequestsCount }, () => 201),
    );

    const establishmentIds = responses.map((response) => {
      return registerEstablishmentResponseSchema.parse(response.body)
        .establishmentId;
    });

    expect(new Set(establishmentIds).size).toBe(concurrentRequestsCount);
    expect(
      await prisma.user.count({
        where: {
          email: {
            in: payloads.map((payload) => payload.email),
          },
        },
      }),
    ).toBe(concurrentRequestsCount);
    expect(
      await prisma.establishment.count({
        where: {
          id: {
            in: establishmentIds,
          },
        },
      }),
    ).toBe(concurrentRequestsCount);

    const categoryCounts = await Promise.all(
      establishmentIds.map((establishmentId) =>
        prisma.serviceCategory.count({
          where: { establishmentId },
        }),
      ),
    );

    expect(categoryCounts).toEqual(
      Array.from(
        { length: concurrentRequestsCount },
        () => DEFAULT_SERVICE_CATEGORY_NAMES.length,
      ),
    );
  });

  it("should rollback user and establishment when default category creation fails", async () => {
    const payload = {
      ...makeRegisterEstablishmentPayload(),
      name: "Rollback Owner",
      tradeName: "Rollback Establishment",
      legalBusinessName: "ROLLBACK BUSINESS LTDA",
      email: "rollback-establishment@example.com",
      cnpj: makeValidCnpj(90),
      phone: "11987654390",
    };
    const createManySpy = vi
      .spyOn(PrismaServiceCategoriesRepository.prototype, "createMany")
      .mockRejectedValueOnce(
        new PersistenceError("Could not persist default service categories."),
      );

    const response = await request(getHttpServer(app))
      .post("/register/establishment")
      .send(payload);

    expect(createManySpy).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(500);
    expect(singleMessageResponseSchema.parse(response.body).message).toBe(
      "An unexpected error ocurred.",
    );
    expect(
      await prisma.user.count({
        where: { email: payload.email },
      }),
    ).toBe(0);
    expect(
      await prisma.establishment.count({
        where: { cnpj: payload.cnpj },
      }),
    ).toBe(0);
    expect(await prisma.serviceCategory.count()).toBe(0);
  });

  it("should keep a concurrent successful registration committed when another registration category creation fails", async () => {
    const successfulPayload = {
      ...makeRegisterEstablishmentPayload(),
      name: "Mixed Success Owner",
      tradeName: "Mixed Success Establishment",
      legalBusinessName: "MIXED SUCCESS BUSINESS LTDA",
      email: "mixed-success-establishment@example.com",
      cnpj: makeValidCnpj(91),
      phone: "11987654391",
    };
    const failingPayload = {
      ...makeRegisterEstablishmentPayload(),
      name: "Mixed Failure Owner",
      tradeName: "Mixed Failure Establishment",
      legalBusinessName: "MIXED FAILURE BUSINESS LTDA",
      email: "mixed-failure-establishment@example.com",
      cnpj: makeValidCnpj(92),
      phone: "11987654392",
    };
    const repositoryBarrier = createBarrier(2);
    let failingEstablishmentId: string | null = null;

    vi.spyOn(
      PrismaEstablishmentRepository.prototype,
      "create",
    ).mockImplementation(async function (
      this: PrismaEstablishmentRepository,
      establishment,
    ) {
      await PrismaUnitOfWork.getClient(prisma).establishment.create({
        data: PrismaEstablishmentMapper.toPrisma(establishment),
      });

      if (establishment.tradeName === failingPayload.tradeName) {
        failingEstablishmentId = establishment.id.toString();
      }

      await repositoryBarrier.wait();
    });

    vi.spyOn(
      PrismaServiceCategoriesRepository.prototype,
      "createMany",
    ).mockImplementation(async function (
      this: PrismaServiceCategoriesRepository,
      categories,
    ) {
      const establishmentId = categories[0]?.establishmentId.toString();

      if (establishmentId === failingEstablishmentId) {
        throw new PersistenceError(
          "Could not persist default service categories.",
        );
      }

      await PrismaUnitOfWork.getClient(prisma).serviceCategory.createMany({
        data: categories.map((category) =>
          PrismaServiceCategoryMapper.toPrisma(category),
        ),
      });
    });

    const [successfulResponse, failingResponse] = await Promise.all([
      request(getHttpServer(app))
        .post("/register/establishment")
        .send(successfulPayload),
      request(getHttpServer(app))
        .post("/register/establishment")
        .send(failingPayload),
    ]);

    expect(successfulResponse.status).toBe(201);
    expect(failingResponse.status).toBe(500);
    expect(
      singleMessageResponseSchema.parse(failingResponse.body).message,
    ).toBe("An unexpected error ocurred.");

    const successfulEstablishmentId = registerEstablishmentResponseSchema.parse(
      successfulResponse.body,
    ).establishmentId;

    expect(
      await prisma.user.count({
        where: { email: successfulPayload.email },
      }),
    ).toBe(1);
    expect(
      await prisma.establishment.count({
        where: { id: successfulEstablishmentId },
      }),
    ).toBe(1);
    expect(
      await prisma.serviceCategory.count({
        where: { establishmentId: successfulEstablishmentId },
      }),
    ).toBe(DEFAULT_SERVICE_CATEGORY_NAMES.length);
    expect(
      await prisma.user.count({
        where: { email: failingPayload.email },
      }),
    ).toBe(0);
    expect(
      await prisma.establishment.count({
        where: { cnpj: failingPayload.cnpj },
      }),
    ).toBe(0);
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

    const responseBody = registerEstablishmentResponseSchema.parse(
      response.body,
    );

    expect(
      await prisma.serviceCategory.count({
        where: { establishmentId: responseBody.establishmentId },
      }),
    ).toBe(DEFAULT_SERVICE_CATEGORY_NAMES.length);
  });
});
