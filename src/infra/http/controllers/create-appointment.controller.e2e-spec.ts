import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

import { CustomerFactory } from "../../../../tests/factories/customer-factory";
import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { ServiceFactory } from "../../../../tests/factories/service-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  getHttpServer,
  loginUser,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

const appointmentStatusSchema = z.enum(["SCHEDULED", "DONE", "CANCELLED"]);

const appointmentResponseSchema = z.object({
  appointment: z.object({
    id: z.uuid(),
    establishmentId: z.uuid(),
    customerId: z.uuid(),
    vehicleId: z.uuid().nullable(),
    service: z.object({
      id: z.uuid(),
      name: z.string(),
      category: z.string().nullable(),
      durationInMinutes: z.number().int().nullable(),
      priceInCents: z.number().int(),
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
    startsAt: z.string(),
    endsAt: z.string().nullable(),
    description: z.string().nullable(),
    discountInCents: z.number().int().nullable(),
    status: appointmentStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
    doneAt: z.string().nullable(),
    cancelledAt: z.string().nullable(),
  }),
});

const listAppointmentsResponseSchema = z.object({
  appointments: z.array(appointmentResponseSchema.shape.appointment),
});

function appointmentPayload({
  customerId,
  serviceId,
  vehicleId,
  startsAt = "2026-04-27T10:00:00.000Z",
  endsAt,
  description,
  discountInCents,
}: {
  customerId: string;
  serviceId: string;
  vehicleId?: string | null;
  startsAt?: string;
  endsAt?: string | null;
  description?: string | null;
  discountInCents?: number | null;
}) {
  return {
    customerId,
    serviceId,
    startsAt,
    ...(vehicleId !== undefined ? { vehicleId } : {}),
    ...(endsAt !== undefined ? { endsAt } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(discountInCents !== undefined ? { discountInCents } : {}),
  };
}

async function makeEstablishmentAccessToken({
  app,
  prisma,
  userFactory,
  establishmentFactory,
  envService,
}: {
  app: INestApplication;
  prisma: PrismaService;
  userFactory: UserFactory;
  establishmentFactory: EstablishmentFactory;
  envService: EnvService;
}) {
  const { user, plainPassword } = await userFactory.makePrismaUser({
    role: "ESTABLISHMENT",
    plainPassword: "strong-password",
  });
  const establishment = await establishmentFactory.makePrismaEstablishment({
    ownerId: user.id,
  });
  const login = await loginUser({
    app,
    prisma,
    userId: user.id.toString(),
    email: user.email.toString(),
    password: plainPassword ?? "",
  });
  const expiredAccessToken = await new JwtService({
    secret: envService.get("JWT_ACCESS_SECRET"),
  }).signAsync(
    {
      sub: user.id.toString(),
      role: user.role,
      sid: login.sessionId,
      type: "access",
    },
    {
      expiresIn: "-1s",
    },
  );

  return {
    accessToken: login.loginBody.accessToken,
    expiredAccessToken,
    establishment,
  };
}

async function makeCustomerAccessToken({
  app,
  prisma,
  userFactory,
}: {
  app: INestApplication;
  prisma: PrismaService;
  userFactory: UserFactory;
}) {
  const { user, plainPassword } = await userFactory.makePrismaUser({
    role: "CUSTOMER",
    plainPassword: "strong-password",
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
  };
}

describe("Appointment controllers (e2e)", () => {
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

  it("should create an appointment without endsAt", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });

    const response = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        appointmentPayload({
          customerId: customer.id.toString(),
          serviceId: service.id.toString(),
        }),
      );
    const responseBody = appointmentResponseSchema.parse(response.body);

    expect(response.status).toBe(201);
    expect(responseBody.appointment.establishmentId).toBe(
      establishment.id.toString(),
    );
    expect(responseBody.appointment.customerId).toBe(customer.id.toString());
    expect(responseBody.appointment.service.id).toBe(service.id.toString());
    expect(responseBody.appointment.endsAt).toBeNull();
    expect(responseBody.appointment.status).toBe("SCHEDULED");
  });

  it("should create an appointment with vehicleId and vehicle snapshot", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });
    const vehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: customer.id.toString(),
        plate: "ABC1D23",
        brand: "Toyota",
        model: "Corolla",
        color: "Prata",
        year: 2022,
      },
    });

    const response = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        appointmentPayload({
          customerId: customer.id.toString(),
          serviceId: service.id.toString(),
          vehicleId: vehicle.id,
          endsAt: "2026-04-27T11:00:00.000Z",
          description: "Lavagem completa",
          discountInCents: 500,
        }),
      );
    const responseBody = appointmentResponseSchema.parse(response.body);

    expect(response.status).toBe(201);
    expect(responseBody.appointment.vehicleId).toBe(vehicle.id);
    expect(responseBody.appointment.discountInCents).toBe(500);
    expect(responseBody.appointment.description).toBe("Lavagem completa");
    expect(responseBody.appointment.vehicle).toEqual({
      plate: "ABC1D23",
      brand: "Toyota",
      model: "Corolla",
      color: "Prata",
      year: 2022,
    });
  });

  it("should allow two appointments at the same startsAt", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });
    const payload = appointmentPayload({
      customerId: customer.id.toString(),
      serviceId: service.id.toString(),
    });

    const firstResponse = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(payload);
    const secondResponse = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(payload);

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(await prisma.appointment.count()).toBe(2);
  });

  it("should enforce authentication and establishment role on all appointment endpoints", async () => {
    const { accessToken, expiredAccessToken, establishment } =
      await makeEstablishmentAccessToken({
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
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });
    const createResponse = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        appointmentPayload({
          customerId: customer.id.toString(),
          serviceId: service.id.toString(),
        }),
      );
    const appointmentId = appointmentResponseSchema.parse(createResponse.body)
      .appointment.id;

    const endpoints = [
      {
        withoutToken: () =>
          request(getHttpServer(app))
            .post("/appointments")
            .send(
              appointmentPayload({
                customerId: customer.id.toString(),
                serviceId: service.id.toString(),
                startsAt: "2026-04-27T12:00:00.000Z",
              }),
            ),
        withToken: (token: string) =>
          request(getHttpServer(app))
            .post("/appointments")
            .set("Authorization", `Bearer ${token}`)
            .send(
              appointmentPayload({
                customerId: customer.id.toString(),
                serviceId: service.id.toString(),
                startsAt: "2026-04-27T12:00:00.000Z",
              }),
            ),
      },
      {
        withoutToken: () => request(getHttpServer(app)).get("/appointments"),
        withToken: (token: string) =>
          request(getHttpServer(app))
            .get("/appointments")
            .set("Authorization", `Bearer ${token}`),
      },
      {
        withoutToken: () =>
          request(getHttpServer(app))
            .patch(`/appointments/${appointmentId}/status`)
            .send({ status: "DONE" }),
        withToken: (token: string) =>
          request(getHttpServer(app))
            .patch(`/appointments/${appointmentId}/status`)
            .set("Authorization", `Bearer ${token}`)
            .send({ status: "DONE" }),
      },
    ];

    for (const endpoint of endpoints) {
      const noTokenResponse = await endpoint.withoutToken();
      const invalidTokenResponse = await endpoint.withToken("invalid-token");
      const expiredTokenResponse = await endpoint.withToken(expiredAccessToken);
      const customerRoleResponse = await endpoint.withToken(
        customerRole.accessToken,
      );

      expect(noTokenResponse.status).toBe(401);
      expect(invalidTokenResponse.status).toBe(401);
      expect(expiredTokenResponse.status).toBe(401);
      expect(customerRoleResponse.status).toBe(403);
    }
  });

  it("should reject invalid appointment payloads, query params and route params", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });

    const missingRequiredResponse = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        customerId: customer.id.toString(),
      });
    const invalidUuidResponse = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        appointmentPayload({
          customerId: "not-a-uuid",
          serviceId: service.id.toString(),
        }),
      );
    const invalidDateResponse = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        appointmentPayload({
          customerId: customer.id.toString(),
          serviceId: service.id.toString(),
          startsAt: "not-a-date",
        }),
      );
    const invalidDateRangeResponse = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        appointmentPayload({
          customerId: customer.id.toString(),
          serviceId: service.id.toString(),
          startsAt: "2026-04-27T10:00:00.000Z",
          endsAt: "2026-04-27T09:00:00.000Z",
        }),
      );
    const negativeDiscountResponse = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        appointmentPayload({
          customerId: customer.id.toString(),
          serviceId: service.id.toString(),
          discountInCents: -1,
        }),
      );
    const invalidListQueryResponse = await request(getHttpServer(app))
      .get("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ customerId: "not-a-uuid" });
    const invalidAppointmentIdResponse = await request(getHttpServer(app))
      .patch("/appointments/not-a-uuid/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "DONE" });
    const invalidStatusResponse = await request(getHttpServer(app))
      .patch(`${"/appointments"}/${randomUUID()}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "FINISHED" });

    expect(missingRequiredResponse.status).toBe(400);
    expect(invalidUuidResponse.status).toBe(400);
    expect(invalidDateResponse.status).toBe(400);
    expect(invalidDateRangeResponse.status).toBe(400);
    expect(negativeDiscountResponse.status).toBe(400);
    expect(invalidListQueryResponse.status).toBe(400);
    expect(invalidAppointmentIdResponse.status).toBe(400);
    expect(invalidStatusResponse.status).toBe(400);
  });

  it("should reject deleted customers, deleted vehicles and vehicles from another customer", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const deletedCustomer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const activeCustomer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const otherCustomer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });
    await prisma.customer.update({
      where: {
        id: deletedCustomer.id.toString(),
      },
      data: {
        deletedAt: new Date(),
      },
    });
    const deletedVehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: activeCustomer.id.toString(),
        plate: "ABC1D23",
        deletedAt: new Date(),
      },
    });
    const otherCustomerVehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: otherCustomer.id.toString(),
        plate: "DEF4G56",
      },
    });

    const deletedCustomerResponse = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        appointmentPayload({
          customerId: deletedCustomer.id.toString(),
          serviceId: service.id.toString(),
        }),
      );
    const deletedVehicleResponse = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        appointmentPayload({
          customerId: activeCustomer.id.toString(),
          serviceId: service.id.toString(),
          vehicleId: deletedVehicle.id,
        }),
      );
    const wrongCustomerVehicleResponse = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        appointmentPayload({
          customerId: activeCustomer.id.toString(),
          serviceId: service.id.toString(),
          vehicleId: otherCustomerVehicle.id,
        }),
      );

    expect(deletedCustomerResponse.status).toBe(404);
    expect(deletedVehicleResponse.status).toBe(404);
    expect(wrongCustomerVehicleResponse.status).toBe(404);
  });

  it("should change appointment status to DONE, CANCELLED and SCHEDULED", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });
    const createResponse = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        appointmentPayload({
          customerId: customer.id.toString(),
          serviceId: service.id.toString(),
        }),
      );
    const appointmentId = appointmentResponseSchema.parse(createResponse.body)
      .appointment.id;

    const doneResponse = await request(getHttpServer(app))
      .patch(`/appointments/${appointmentId}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "DONE" });
    const doneBody = appointmentResponseSchema.parse(doneResponse.body);
    const cancelledResponse = await request(getHttpServer(app))
      .patch(`/appointments/${appointmentId}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "CANCELLED" });
    const cancelledBody = appointmentResponseSchema.parse(
      cancelledResponse.body,
    );
    const scheduledResponse = await request(getHttpServer(app))
      .patch(`/appointments/${appointmentId}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "SCHEDULED" });
    const scheduledBody = appointmentResponseSchema.parse(
      scheduledResponse.body,
    );

    expect(doneResponse.status).toBe(200);
    expect(doneBody.appointment.status).toBe("DONE");
    expect(doneBody.appointment.doneAt).not.toBeNull();
    expect(doneBody.appointment.cancelledAt).toBeNull();
    expect(cancelledResponse.status).toBe(200);
    expect(cancelledBody.appointment.status).toBe("CANCELLED");
    expect(cancelledBody.appointment.doneAt).toBeNull();
    expect(cancelledBody.appointment.cancelledAt).not.toBeNull();
    expect(scheduledResponse.status).toBe(200);
    expect(scheduledBody.appointment.status).toBe("SCHEDULED");
    expect(scheduledBody.appointment.doneAt).toBeNull();
    expect(scheduledBody.appointment.cancelledAt).toBeNull();
  });

  it("should list appointments by status, customer, service, vehicle and date range", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const firstCustomer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const secondCustomer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const firstService = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });
    const secondService = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });
    const vehicle = await prisma.customerVehicle.create({
      data: {
        establishmentId: establishment.id.toString(),
        customerId: firstCustomer.id.toString(),
        plate: "ABC1D23",
      },
    });

    const firstResponse = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        appointmentPayload({
          customerId: firstCustomer.id.toString(),
          serviceId: firstService.id.toString(),
          vehicleId: vehicle.id,
          startsAt: "2026-04-27T10:00:00.000Z",
        }),
      );
    const firstAppointment = appointmentResponseSchema.parse(
      firstResponse.body,
    ).appointment;
    const secondResponse = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        appointmentPayload({
          customerId: firstCustomer.id.toString(),
          serviceId: secondService.id.toString(),
          startsAt: "2026-04-27T12:00:00.000Z",
        }),
      );
    const secondAppointment = appointmentResponseSchema.parse(
      secondResponse.body,
    ).appointment;
    const thirdResponse = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        appointmentPayload({
          customerId: secondCustomer.id.toString(),
          serviceId: firstService.id.toString(),
          startsAt: "2026-04-28T10:00:00.000Z",
        }),
      );
    const thirdAppointment = appointmentResponseSchema.parse(
      thirdResponse.body,
    ).appointment;

    await request(getHttpServer(app))
      .patch(`/appointments/${firstAppointment.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "DONE" });
    await request(getHttpServer(app))
      .patch(`/appointments/${thirdAppointment.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "CANCELLED" });

    const doneResponse = await request(getHttpServer(app))
      .get("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ status: "DONE" });
    const customerResponse = await request(getHttpServer(app))
      .get("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ customerId: firstCustomer.id.toString() });
    const serviceResponse = await request(getHttpServer(app))
      .get("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ serviceId: firstService.id.toString() });
    const vehicleResponse = await request(getHttpServer(app))
      .get("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ vehicleId: vehicle.id });
    const dateRangeResponse = await request(getHttpServer(app))
      .get("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({
        startsAt: "2026-04-27T09:00:00.000Z",
        endsAt: "2026-04-27T13:00:00.000Z",
      });

    const doneBody = listAppointmentsResponseSchema.parse(doneResponse.body);
    const customerBody = listAppointmentsResponseSchema.parse(
      customerResponse.body,
    );
    const serviceBody = listAppointmentsResponseSchema.parse(
      serviceResponse.body,
    );
    const vehicleBody = listAppointmentsResponseSchema.parse(
      vehicleResponse.body,
    );
    const dateRangeBody = listAppointmentsResponseSchema.parse(
      dateRangeResponse.body,
    );

    expect(doneResponse.status).toBe(200);
    expect(doneBody.appointments.map((appointment) => appointment.id)).toEqual([
      firstAppointment.id,
    ]);
    expect(customerResponse.status).toBe(200);
    expect(
      customerBody.appointments.map((appointment) => appointment.id),
    ).toEqual(
      expect.arrayContaining([firstAppointment.id, secondAppointment.id]),
    );
    expect(customerBody.appointments).toHaveLength(2);
    expect(serviceResponse.status).toBe(200);
    expect(
      serviceBody.appointments.map((appointment) => appointment.id),
    ).toEqual(
      expect.arrayContaining([firstAppointment.id, thirdAppointment.id]),
    );
    expect(serviceBody.appointments).toHaveLength(2);
    expect(vehicleResponse.status).toBe(200);
    expect(
      vehicleBody.appointments.map((appointment) => appointment.id),
    ).toEqual([firstAppointment.id]);
    expect(dateRangeResponse.status).toBe(200);
    expect(
      dateRangeBody.appointments.map((appointment) => appointment.id),
    ).toEqual(
      expect.arrayContaining([firstAppointment.id, secondAppointment.id]),
    );
    expect(dateRangeBody.appointments).toHaveLength(2);
  });

  it("should not expose or mutate appointments from another establishment", async () => {
    const firstOwner = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const secondOwner = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: firstOwner.establishment.id,
      cpfCnpj: null,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: firstOwner.establishment.id,
    });
    const createResponse = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .send(
        appointmentPayload({
          customerId: customer.id.toString(),
          serviceId: service.id.toString(),
        }),
      );
    const appointmentId = appointmentResponseSchema.parse(createResponse.body)
      .appointment.id;

    const crossEstablishmentCreateResponse = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${secondOwner.accessToken}`)
      .send(
        appointmentPayload({
          customerId: customer.id.toString(),
          serviceId: service.id.toString(),
          startsAt: "2026-04-27T12:00:00.000Z",
        }),
      );
    const crossEstablishmentListResponse = await request(getHttpServer(app))
      .get("/appointments")
      .set("Authorization", `Bearer ${secondOwner.accessToken}`);
    const crossEstablishmentUpdateResponse = await request(getHttpServer(app))
      .patch(`/appointments/${appointmentId}/status`)
      .set("Authorization", `Bearer ${secondOwner.accessToken}`)
      .send({ status: "DONE" });
    const crossEstablishmentListBody = listAppointmentsResponseSchema.parse(
      crossEstablishmentListResponse.body,
    );

    expect(crossEstablishmentCreateResponse.status).toBe(404);
    expect(crossEstablishmentListResponse.status).toBe(200);
    expect(crossEstablishmentListBody.appointments).toHaveLength(0);
    expect(crossEstablishmentUpdateResponse.status).toBe(404);
  });
});
