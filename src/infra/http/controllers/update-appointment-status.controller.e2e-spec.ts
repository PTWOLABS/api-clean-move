import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CustomerFactory } from "../../../../tests/factories/customer-factory";
import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { ServiceFactory } from "../../../../tests/factories/service-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  appointmentPayload,
  appointmentResponseSchema,
  makeCustomerAuth,
  makeEstablishmentAuth,
} from "../../../../tests/helpers/establishment-operated-scheduling.e2e-helpers";
import { getHttpServer } from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";
import { UniqueEntityId } from "../../../shared/entities/unique-entity-id";

describe("UpdateAppointmentStatusController (e2e)", () => {
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
          serviceId: service.id.toString(),
        }),
      );

    return appointmentResponseSchema.parse(response.body).appointment;
  }

  it("should change appointment status to DONE, CANCELLED and SCHEDULED", async () => {
    const { accessToken, establishment } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const appointment = await createAppointment(accessToken, establishment.id);

    const doneResponse = await request(getHttpServer(app))
      .patch(`/appointments/${appointment.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "DONE" });
    const doneBody = appointmentResponseSchema.parse(doneResponse.body);
    const cancelledResponse = await request(getHttpServer(app))
      .patch(`/appointments/${appointment.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "CANCELLED" });
    const cancelledBody = appointmentResponseSchema.parse(
      cancelledResponse.body,
    );
    const scheduledResponse = await request(getHttpServer(app))
      .patch(`/appointments/${appointment.id}/status`)
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

  it("should enforce authentication and establishment role", async () => {
    const { accessToken, expiredAccessToken, establishment } =
      await makeEstablishmentAuth({
        app,
        prisma,
        userFactory,
        establishmentFactory,
        envService,
      });
    const customerRole = await makeCustomerAuth({
      app,
      prisma,
      userFactory,
    });
    const appointment = await createAppointment(accessToken, establishment.id);

    const noTokenResponse = await request(getHttpServer(app))
      .patch(`/appointments/${appointment.id}/status`)
      .send({ status: "DONE" });
    const invalidTokenResponse = await request(getHttpServer(app))
      .patch(`/appointments/${appointment.id}/status`)
      .set("Authorization", "Bearer invalid-token")
      .send({ status: "DONE" });
    const expiredTokenResponse = await request(getHttpServer(app))
      .patch(`/appointments/${appointment.id}/status`)
      .set("Authorization", `Bearer ${expiredAccessToken}`)
      .send({ status: "DONE" });
    const customerRoleResponse = await request(getHttpServer(app))
      .patch(`/appointments/${appointment.id}/status`)
      .set("Authorization", `Bearer ${customerRole.accessToken}`)
      .send({ status: "DONE" });

    expect(noTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.status).toBe(401);
    expect(expiredTokenResponse.status).toBe(401);
    expect(customerRoleResponse.status).toBe(403);
  });

  it("should reject invalid appointment ids and status values", async () => {
    const { accessToken, establishment } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const appointment = await createAppointment(accessToken, establishment.id);

    const invalidAppointmentIdResponse = await request(getHttpServer(app))
      .patch("/appointments/not-a-uuid/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "DONE" });
    const invalidStatusResponse = await request(getHttpServer(app))
      .patch(`/appointments/${appointment.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "FINISHED" });

    expect(invalidAppointmentIdResponse.status).toBe(400);
    expect(invalidStatusResponse.status).toBe(400);
  });

  it("should not update appointments from another establishment", async () => {
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

    const crossEstablishmentResponse = await request(getHttpServer(app))
      .patch(`/appointments/${appointment.id}/status`)
      .set("Authorization", `Bearer ${secondOwner.accessToken}`)
      .send({ status: "DONE" });
    const missingAppointmentResponse = await request(getHttpServer(app))
      .patch(`/appointments/${randomUUID()}/status`)
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .send({ status: "DONE" });

    expect(crossEstablishmentResponse.status).toBe(404);
    expect(missingAppointmentResponse.status).toBe(404);
  });
});
