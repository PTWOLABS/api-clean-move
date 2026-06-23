import { INestApplication } from "@nestjs/common";
import { buildCustomerVehiclePrismaData } from "../../../../tests/helpers/customer-vehicle.e2e-helpers";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
import { ServicePriceSpecification } from "../../../modules/catalog/domain/value-objects/service-price-specification";
import { UniqueEntityId } from "../../../shared/entities/unique-entity-id";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

describe("UpdateAppointmentController (e2e)", () => {
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
          endsAt: "2026-04-27T11:00:00.000Z",
          description: "Descricao original",
          discountInCents: 500,
        }),
      );

    return appointmentResponseSchema.parse(response.body).appointment;
  }

  it("should update appointment editable fields", async () => {
    const { accessToken, establishment } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const appointment = await createAppointment(accessToken, establishment.id);
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
    });
    const vehicle = await prisma.customerVehicle.create({
      data: buildCustomerVehiclePrismaData({
        establishmentId: establishment.id.toString(),
        customerId: customer.id.toString(),
        plate: "DEF4G56",
        brand: "Honda",
        model: "Civic",
        color: "Preto",
        year: 2024,
      }),
    });

    const response = await request(getHttpServer(app))
      .patch(`/appointments/${appointment.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        customerId: customer.id.toString(),
        serviceIds: [service.id.toString()],
        vehicleId: vehicle.id,
        startsAt: "2026-05-01T10:00:00.000Z",
        endsAt: "2026-05-01T12:00:00.000Z",
        description: "  Cliente prefere cera premium.  ",
        discountInCents: 1500,
      });
    const body = appointmentResponseSchema.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.appointment.id).toBe(appointment.id);
    expect(body.appointment.customerId).toBe(customer.id.toString());
    expect(body.appointment.services[0]?.id).toBe(service.id.toString());
    expect(body.appointment.vehicleId).toBe(vehicle.id);
    expect(body.appointment.vehicle).toEqual({
      plate: "DEF4G56",
      brand: "Honda",
      model: "Civic",
      displayName: "Honda Civic 2024",
      color: "Preto",
      year: 2024,
      currentResourceStatus: "UNCHANGED",
    });
    expect(body.appointment.startsAt).toBe("2026-05-01T10:00:00.000Z");
    expect(body.appointment.endsAt).toBe("2026-05-01T12:00:00.000Z");
    expect(body.appointment.description).toBe("Cliente prefere cera premium.");
    expect(body.appointment.discountInCents).toBe(1500);
    expect(body.appointment.status).toBe("SCHEDULED");
  });

  it("should update appointment services using explicit service item price", async () => {
    const { accessToken, establishment } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const appointment = await createAppointment(accessToken, establishment.id);
    const service = await serviceFactory.makePrismaService({
      establishmentId: establishment.id,
      priceSpecification: ServicePriceSpecification.create({
        type: "STARTING_AT",
        minPriceInCents: 25000,
      }),
    });

    const response = await request(getHttpServer(app))
      .patch(`/appointments/${appointment.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        services: [
          {
            serviceId: service.id.toString(),
            priceInCents: 35000,
          },
        ],
      });
    const body = appointmentResponseSchema.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.appointment.services[0]).toEqual(
      expect.objectContaining({
        id: service.id.toString(),
        priceInCents: 35000,
      }),
    );
  });

  it("should clear nullable appointment fields", async () => {
    const { accessToken, establishment } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const appointment = await createAppointment(accessToken, establishment.id);

    const response = await request(getHttpServer(app))
      .patch(`/appointments/${appointment.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        vehicleId: null,
        endsAt: null,
        description: null,
        discountInCents: null,
      });
    const body = appointmentResponseSchema.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.appointment.customerId).toBe(appointment.customerId);
    expect(body.appointment.services).toEqual(appointment.services);
    expect(body.appointment.vehicleId).toBeNull();
    expect(body.appointment.vehicle).toBeNull();
    expect(body.appointment.endsAt).toBeNull();
    expect(body.appointment.description).toBeNull();
    expect(body.appointment.discountInCents).toBeNull();
  });

  it("should reject invalid appointment ids and invalid payloads", async () => {
    const { accessToken, establishment } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const appointment = await createAppointment(accessToken, establishment.id);

    const invalidAppointmentIdResponse = await request(getHttpServer(app))
      .patch("/appointments/not-a-uuid")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ description: "Nova descricao" });
    const emptyPayloadResponse = await request(getHttpServer(app))
      .patch(`/appointments/${appointment.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});
    const invalidPayloadResponse = await request(getHttpServer(app))
      .patch(`/appointments/${appointment.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        customerId: "not-a-uuid",
        serviceIds: [],
        discountInCents: -1,
      });

    expect(invalidAppointmentIdResponse.status).toBe(400);
    expect(emptyPayloadResponse.status).toBe(400);
    expect(invalidPayloadResponse.status).toBe(400);
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
      .patch(`/appointments/${appointment.id}`)
      .set("Authorization", `Bearer ${secondOwner.accessToken}`)
      .send({ description: "Nao permitido" });
    const missingAppointmentResponse = await request(getHttpServer(app))
      .patch(`/appointments/${randomUUID()}`)
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .send({ description: "Nao encontrado" });

    expect(crossEstablishmentResponse.status).toBe(404);
    expect(missingAppointmentResponse.status).toBe(404);
  });

  it("should enforce update appointments feature for employees", async () => {
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
      extraFeatures: ["update:appointments"],
    });
    const forbiddenEmployee = await makeEmployeeAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      establishment: owner.establishment,
    });
    const appointment = await createAppointment(
      owner.accessToken,
      owner.establishment.id,
    );

    const allowedResponse = await request(getHttpServer(app))
      .patch(`/appointments/${appointment.id}`)
      .set("Authorization", `Bearer ${allowedEmployee.accessToken}`)
      .send({ description: "Atualizado pelo funcionario" });
    const allowedBody = appointmentResponseSchema.parse(allowedResponse.body);
    const forbiddenResponse = await request(getHttpServer(app))
      .patch(`/appointments/${appointment.id}`)
      .set("Authorization", `Bearer ${forbiddenEmployee.accessToken}`)
      .send({ description: "Nao deve atualizar" });

    expect(allowedResponse.status).toBe(200);
    expect(allowedBody.appointment.description).toBe(
      "Atualizado pelo funcionario",
    );
    expect(forbiddenResponse.status).toBe(403);
  });
});
