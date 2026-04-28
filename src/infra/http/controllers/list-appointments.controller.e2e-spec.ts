import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CustomerFactory } from "../../../../tests/factories/customer-factory";
import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { ServiceFactory } from "../../../../tests/factories/service-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  appointmentPayload,
  appointmentResponseSchema,
  listAppointmentsResponseSchema,
  makeCustomerAuth,
  makeEstablishmentAuth,
} from "../../../../tests/helpers/establishment-operated-scheduling.e2e-helpers";
import { getHttpServer } from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

describe("ListAppointmentsController (e2e)", () => {
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

  it("should list appointments by status, customer, service, vehicle and date range", async () => {
    const { accessToken, establishment } = await makeEstablishmentAuth({
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
    const firstAppointment = appointmentResponseSchema.parse(
      firstResponse.body,
    ).appointment;
    const secondAppointment = appointmentResponseSchema.parse(
      secondResponse.body,
    ).appointment;
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

  it("should enforce authentication and establishment role", async () => {
    const { accessToken, expiredAccessToken } = await makeEstablishmentAuth({
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

    const noTokenResponse = await request(getHttpServer(app)).get(
      "/appointments",
    );
    const invalidTokenResponse = await request(getHttpServer(app))
      .get("/appointments")
      .set("Authorization", "Bearer invalid-token");
    const expiredTokenResponse = await request(getHttpServer(app))
      .get("/appointments")
      .set("Authorization", `Bearer ${expiredAccessToken}`);
    const customerRoleResponse = await request(getHttpServer(app))
      .get("/appointments")
      .set("Authorization", `Bearer ${customerRole.accessToken}`);
    const validResponse = await request(getHttpServer(app))
      .get("/appointments")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(noTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.status).toBe(401);
    expect(expiredTokenResponse.status).toBe(401);
    expect(customerRoleResponse.status).toBe(403);
    expect(validResponse.status).toBe(200);
  });

  it("should reject invalid filters", async () => {
    const { accessToken } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const invalidCustomerResponse = await request(getHttpServer(app))
      .get("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ customerId: "not-a-uuid" });
    const invalidStatusResponse = await request(getHttpServer(app))
      .get("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ status: "FINISHED" });
    const invalidDateResponse = await request(getHttpServer(app))
      .get("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ startsAt: "not-a-date" });
    const invalidPageResponse = await request(getHttpServer(app))
      .get("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ page: 0 });

    expect(invalidCustomerResponse.status).toBe(400);
    expect(invalidStatusResponse.status).toBe(400);
    expect(invalidDateResponse.status).toBe(400);
    expect(invalidPageResponse.status).toBe(400);
  });

  it("should not expose appointments from another establishment", async () => {
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
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: firstOwner.establishment.id,
      cpfCnpj: null,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: firstOwner.establishment.id,
    });

    await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .send(
        appointmentPayload({
          customerId: customer.id.toString(),
          serviceId: service.id.toString(),
        }),
      );

    const response = await request(getHttpServer(app))
      .get("/appointments")
      .set("Authorization", `Bearer ${secondOwner.accessToken}`);
    const body = listAppointmentsResponseSchema.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.appointments).toHaveLength(0);
  });
});
