import { INestApplication } from "@nestjs/common";
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
  makeEmployeeAccessToken,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import {
  appointmentPayload,
  appointmentResponseSchema,
  makeEstablishmentAuth,
} from "../../../../tests/helpers/establishment-operated-scheduling.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { UniqueEntityId } from "../../../shared/entities/unique-entity-id";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

const appointmentListResponseSchema = z.object({
  appointments: z.array(z.object({ id: z.string() })),
});
const appointmentMetricsResponseSchema = z.object({
  total: z.number(),
});

describe("DeleteAppointmentController (e2e)", () => {
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

  async function createAppointment(
    accessToken: string,
    establishmentId: UniqueEntityId,
  ) {
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId,
      cpfCnpj: null,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId,
    });
    const response = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        appointmentPayload({
          customerId: customer.id.toString(),
          serviceIds: [service.id.toString()],
        }),
      );

    return appointmentResponseSchema.parse(response.body).appointment;
  }

  it("should delete an appointment", async () => {
    const { accessToken, establishment } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const appointment = await createAppointment(accessToken, establishment.id);

    const response = await request(getHttpServer(app))
      .delete(`/appointments/${appointment.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const appointmentRecord = await prisma.appointment.findUnique({
      where: {
        id: appointment.id,
      },
    });
    const listResponse = await request(getHttpServer(app))
      .get("/appointments")
      .set("Authorization", `Bearer ${accessToken}`);
    const calendarResponse = await request(getHttpServer(app))
      .get("/appointments/calendar")
      .query({
        startsAt: "2026-04-20T00:00:00.000Z",
        endsAt: "2026-05-01T00:00:00.000Z",
      })
      .set("Authorization", `Bearer ${accessToken}`);
    const updateResponse = await request(getHttpServer(app))
      .patch(`/appointments/${appointment.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ description: "Nao deve atualizar" });
    const statusResponse = await request(getHttpServer(app))
      .patch(`/appointments/${appointment.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "CANCELLED" });
    const metricsResponse = await request(getHttpServer(app))
      .get("/dashboard/metrics/appointments")
      .query({
        startsAt: "2026-04-20T00:00:00.000Z",
        endsAt: "2026-05-01T00:00:00.000Z",
      })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(appointmentRecord?.deletedAt).toBeInstanceOf(Date);
    const listBody = appointmentListResponseSchema.parse(listResponse.body);
    const calendarBody = appointmentListResponseSchema.parse(
      calendarResponse.body,
    );

    expect(
      listBody.appointments.some((item) => item.id === appointment.id),
    ).toBe(false);
    expect(
      calendarBody.appointments.some((item) => item.id === appointment.id),
    ).toBe(false);
    expect(updateResponse.status).toBe(404);
    expect(statusResponse.status).toBe(404);
    expect(
      appointmentMetricsResponseSchema.parse(metricsResponse.body).total,
    ).toBe(0);
  });

  it("should reject invalid, missing, and cross-establishment appointments", async () => {
    const firstOwner = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const secondOwner = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const appointment = await createAppointment(
      firstOwner.accessToken,
      firstOwner.establishment.id,
    );

    const invalidAppointmentIdResponse = await request(getHttpServer(app))
      .delete("/appointments/not-a-uuid")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`);
    const missingAppointmentResponse = await request(getHttpServer(app))
      .delete(`/appointments/${randomUUID()}`)
      .set("Authorization", `Bearer ${firstOwner.accessToken}`);
    const crossEstablishmentResponse = await request(getHttpServer(app))
      .delete(`/appointments/${appointment.id}`)
      .set("Authorization", `Bearer ${secondOwner.accessToken}`);

    expect(invalidAppointmentIdResponse.status).toBe(400);
    expect(missingAppointmentResponse.status).toBe(404);
    expect(crossEstablishmentResponse.status).toBe(404);
  });

  it("should enforce delete appointments feature for employees", async () => {
    const owner = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const allowedEmployee = await makeEmployeeAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      establishment: owner.establishment,
      extraFeatures: ["delete:appointments"],
    });
    const forbiddenEmployee = await makeEmployeeAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      establishment: owner.establishment,
    });
    const allowedAppointment = await createAppointment(
      owner.accessToken,
      owner.establishment.id,
    );
    const forbiddenAppointment = await createAppointment(
      owner.accessToken,
      owner.establishment.id,
    );

    const allowedResponse = await request(getHttpServer(app))
      .delete(`/appointments/${allowedAppointment.id}`)
      .set("Authorization", `Bearer ${allowedEmployee.accessToken}`);
    const forbiddenResponse = await request(getHttpServer(app))
      .delete(`/appointments/${forbiddenAppointment.id}`)
      .set("Authorization", `Bearer ${forbiddenEmployee.accessToken}`);
    const forbiddenAppointmentRecord = await prisma.appointment.findUnique({
      where: {
        id: forbiddenAppointment.id,
      },
    });

    expect(allowedResponse.status).toBe(204);
    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenAppointmentRecord).not.toBeNull();
    expect(forbiddenAppointmentRecord?.deletedAt).toBeNull();
  });

  it("should not delete done appointments", async () => {
    const { accessToken, establishment } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const appointment = await createAppointment(accessToken, establishment.id);

    await request(getHttpServer(app))
      .patch(`/appointments/${appointment.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "DONE" });

    const response = await request(getHttpServer(app))
      .delete(`/appointments/${appointment.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const appointmentRecord = await prisma.appointment.findUnique({
      where: {
        id: appointment.id,
      },
    });

    expect(response.status).toBe(400);
    expect(appointmentRecord?.deletedAt).toBeNull();
  });
});
