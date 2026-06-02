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
import {
  getHttpServer,
  makeEmployeeAccessToken,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

const rangeStartsAt = "2026-04-10T08:00:00.000Z";
const rangeEndsAt = "2026-04-17T08:00:00.000Z";

describe("ListCalendarAppointmentsController (e2e)", () => {
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
    customerId: string,
    serviceId: string,
    startsAt: string,
    endsAt: string,
  ) {
    const response = await request(getHttpServer(app))
      .post("/appointments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        appointmentPayload({
          customerId,
          serviceIds: [serviceId],
          startsAt,
          endsAt,
        }),
      );

    return appointmentResponseSchema.parse(response.body).appointment;
  }

  it("should list appointments that intersect the requested range", async () => {
    const { accessToken, establishment } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
      fullName: "Cliente Agenda",
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });

    const startsBeforeEndsWithin = await createAppointment(
      accessToken,
      customer.id.toString(),
      service.id.toString(),
      "2026-04-09T10:00:00.000Z",
      "2026-04-12T10:00:00.000Z",
    );
    const startsWithinEndsAfter = await createAppointment(
      accessToken,
      customer.id.toString(),
      service.id.toString(),
      "2026-04-15T10:00:00.000Z",
      "2026-04-20T10:00:00.000Z",
    );
    const fullyInside = await createAppointment(
      accessToken,
      customer.id.toString(),
      service.id.toString(),
      "2026-04-11T10:00:00.000Z",
      "2026-04-12T10:00:00.000Z",
    );
    await createAppointment(
      accessToken,
      customer.id.toString(),
      service.id.toString(),
      "2026-04-20T10:00:00.000Z",
      "2026-04-21T10:00:00.000Z",
    );

    await prisma.customer.update({
      where: {
        id: customer.id.toString(),
      },
      data: {
        fullName: "Cliente Agenda Atualizado",
      },
    });

    const response = await request(getHttpServer(app))
      .get("/appointments/calendar")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({
        startsAt: rangeStartsAt,
        endsAt: rangeEndsAt,
      });
    const body = listAppointmentsResponseSchema.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.appointments.map((appointment) => appointment.id)).toEqual([
      startsBeforeEndsWithin.id,
      fullyInside.id,
      startsWithinEndsAfter.id,
    ]);
    expect(body.totalItems).toBe(3);
    expect(
      body.appointments.map((appointment) => appointment.startsAt),
    ).toEqual([
      startsBeforeEndsWithin.startsAt,
      fullyInside.startsAt,
      startsWithinEndsAfter.startsAt,
    ]);
    expect(
      body.appointments.map((appointment) => appointment.customer),
    ).toEqual([
      { fullName: "Cliente Agenda" },
      { fullName: "Cliente Agenda" },
      { fullName: "Cliente Agenda" },
    ]);
  });

  it("should return an empty list when there are no appointments in the range", async () => {
    const { accessToken } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .get("/appointments/calendar")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({
        startsAt: rangeStartsAt,
        endsAt: rangeEndsAt,
      });
    const body = listAppointmentsResponseSchema.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.appointments).toEqual([]);
    expect(body.totalItems).toBe(0);
  });

  it("should filter appointments by status", async () => {
    const { accessToken, establishment } = await makeEstablishmentAuth({
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

    const scheduledAppointment = await createAppointment(
      accessToken,
      customer.id.toString(),
      service.id.toString(),
      "2026-04-11T10:00:00.000Z",
      "2026-04-12T10:00:00.000Z",
    );
    const doneAppointment = await createAppointment(
      accessToken,
      customer.id.toString(),
      service.id.toString(),
      "2026-04-12T10:00:00.000Z",
      "2026-04-13T10:00:00.000Z",
    );

    await request(getHttpServer(app))
      .patch(`/appointments/${doneAppointment.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "DONE" });

    const response = await request(getHttpServer(app))
      .get("/appointments/calendar")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({
        startsAt: rangeStartsAt,
        endsAt: rangeEndsAt,
        status: "DONE",
      });
    const body = listAppointmentsResponseSchema.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.appointments.map((appointment) => appointment.id)).toEqual([
      doneAppointment.id,
    ]);
    expect(body.totalItems).toBe(1);
    expect(body.appointments[0]?.status).toBe("DONE");
    expect(
      body.appointments.some(
        (appointment) => appointment.id === scheduledAppointment.id,
      ),
    ).toBe(false);
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

    const noTokenResponse = await request(getHttpServer(app))
      .get("/appointments/calendar")
      .query({
        startsAt: rangeStartsAt,
        endsAt: rangeEndsAt,
      });
    const invalidTokenResponse = await request(getHttpServer(app))
      .get("/appointments/calendar")
      .set("Authorization", "Bearer invalid-token")
      .query({
        startsAt: rangeStartsAt,
        endsAt: rangeEndsAt,
      });
    const expiredTokenResponse = await request(getHttpServer(app))
      .get("/appointments/calendar")
      .set("Authorization", `Bearer ${expiredAccessToken}`)
      .query({
        startsAt: rangeStartsAt,
        endsAt: rangeEndsAt,
      });
    const customerRoleResponse = await request(getHttpServer(app))
      .get("/appointments/calendar")
      .set("Authorization", `Bearer ${customerRole.accessToken}`)
      .query({
        startsAt: rangeStartsAt,
        endsAt: rangeEndsAt,
      });
    const validResponse = await request(getHttpServer(app))
      .get("/appointments/calendar")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({
        startsAt: rangeStartsAt,
        endsAt: rangeEndsAt,
      });

    expect(noTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.status).toBe(401);
    expect(expiredTokenResponse.status).toBe(401);
    expect(customerRoleResponse.status).toBe(403);
    expect(validResponse.status).toBe(200);
  });

  it("should reject invalid calendar query parameters", async () => {
    const { accessToken } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const missingStartsAtResponse = await request(getHttpServer(app))
      .get("/appointments/calendar")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ endsAt: rangeEndsAt });
    const missingEndsAtResponse = await request(getHttpServer(app))
      .get("/appointments/calendar")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ startsAt: rangeStartsAt });
    const invalidStartsAtResponse = await request(getHttpServer(app))
      .get("/appointments/calendar")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({
        startsAt: "not-a-date",
        endsAt: rangeEndsAt,
      });
    const invalidEndsAtResponse = await request(getHttpServer(app))
      .get("/appointments/calendar")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({
        startsAt: rangeStartsAt,
        endsAt: "not-a-date",
      });
    const invalidRangeResponse = await request(getHttpServer(app))
      .get("/appointments/calendar")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({
        startsAt: rangeStartsAt,
        endsAt: rangeStartsAt,
      });
    const tooLongRangeResponse = await request(getHttpServer(app))
      .get("/appointments/calendar")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({
        startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2026-03-15T00:00:00.000Z",
      });

    expect(missingStartsAtResponse.status).toBe(400);
    expect(missingEndsAtResponse.status).toBe(400);
    expect(invalidStartsAtResponse.status).toBe(400);
    expect(invalidEndsAtResponse.status).toBe(400);
    expect(invalidRangeResponse.status).toBe(400);
    expect(tooLongRangeResponse.status).toBe(400);
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

    await createAppointment(
      firstOwner.accessToken,
      customer.id.toString(),
      service.id.toString(),
      "2026-04-11T10:00:00.000Z",
      "2026-04-12T10:00:00.000Z",
    );

    const response = await request(getHttpServer(app))
      .get("/appointments/calendar")
      .set("Authorization", `Bearer ${secondOwner.accessToken}`)
      .query({
        startsAt: rangeStartsAt,
        endsAt: rangeEndsAt,
      });
    const body = listAppointmentsResponseSchema.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.appointments).toHaveLength(0);
    expect(body.totalItems).toBe(0);
  });

  it("should allow employee with read appointments feature", async () => {
    const owner = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const employee = await makeEmployeeAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      establishment: owner.establishment,
    });
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: owner.establishment.id,
      cpfCnpj: null,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: owner.establishment.id,
    });

    const appointment = await createAppointment(
      owner.accessToken,
      customer.id.toString(),
      service.id.toString(),
      "2026-04-11T10:00:00.000Z",
      "2026-04-12T10:00:00.000Z",
    );

    const response = await request(getHttpServer(app))
      .get("/appointments/calendar")
      .set("Authorization", `Bearer ${employee.accessToken}`)
      .query({
        startsAt: rangeStartsAt,
        endsAt: rangeEndsAt,
      });
    const body = listAppointmentsResponseSchema.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.appointments.map((item) => item.id)).toEqual([appointment.id]);
    expect(body.totalItems).toBe(1);
  });
});
