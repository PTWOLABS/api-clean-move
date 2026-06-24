import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { expect } from "vitest";
import z from "zod";

import { CustomerFactory } from "../factories/customer-factory";
import { Establishment } from "../../src/modules/establishments/domain/entities/establishment";
import { PrismaService } from "../../src/infra/database/prisma/prisma.service";
import { ServiceFactory } from "../factories/service-factory";
import { ServiceName } from "../../src/modules/catalog/domain/value-objects/service-name";
import { getHttpServer } from "./auth-session.e2e-helpers";
import {
  appointmentPayload,
  appointmentResponseSchema,
} from "./establishment-operated-scheduling.e2e-helpers";

type AppointmentListItem = z.infer<
  typeof appointmentResponseSchema
>["appointment"];

type CreateAppointmentResourceStatusScenarioInput = {
  app: INestApplication;
  prisma: PrismaService;
  accessToken: string;
  establishment: Establishment;
  customerFactory: CustomerFactory;
  serviceFactory: ServiceFactory;
};

export type AppointmentResourceStatusScenario = {
  unchangedAppointmentId: string;
  updatedAppointmentId: string;
  deletedAppointmentId: string;
};

export async function createAppointmentResourceStatusScenario({
  app,
  prisma,
  accessToken,
  establishment,
  customerFactory,
  serviceFactory,
}: CreateAppointmentResourceStatusScenarioInput): Promise<AppointmentResourceStatusScenario> {
  const unchangedAppointment = await createAppointmentWithResources({
    app,
    prisma,
    accessToken,
    establishment,
    customerFactory,
    serviceFactory,
    customerName: "Cliente sem alteracao",
    serviceName: "Servico sem alteracao",
    vehicleModel: "Corolla",
    startsAt: "2026-04-13T10:00:00.000Z",
  });
  const updatedAppointment = await createAppointmentWithResources({
    app,
    prisma,
    accessToken,
    establishment,
    customerFactory,
    serviceFactory,
    customerName: "Cliente original",
    serviceName: "Lavagem completa",
    vehicleModel: "Civic",
    startsAt: "2026-04-13T11:00:00.000Z",
  });
  const deletedAppointment = await createAppointmentWithResources({
    app,
    prisma,
    accessToken,
    establishment,
    customerFactory,
    serviceFactory,
    customerName: "Cliente removido",
    serviceName: "Servico removido",
    vehicleModel: "Fit",
    startsAt: "2026-04-13T12:00:00.000Z",
  });

  await prisma.customer.update({
    where: { id: updatedAppointment.customerId },
    data: { fullName: "Cliente atualizado" },
  });
  await prisma.service.update({
    where: { id: updatedAppointment.serviceId },
    data: { serviceName: "Lavagem detalhada" },
  });
  await prisma.customerVehicle.update({
    where: { id: updatedAppointment.vehicleId },
    data: { model: "Civic Touring" },
  });

  const deletedAt = new Date("2026-04-13T13:00:00.000Z");

  await prisma.customer.update({
    where: { id: deletedAppointment.customerId },
    data: { deletedAt },
  });
  await prisma.service.update({
    where: { id: deletedAppointment.serviceId },
    data: { deletedAt },
  });
  await prisma.customerVehicle.update({
    where: { id: deletedAppointment.vehicleId },
    data: { deletedAt },
  });

  return {
    unchangedAppointmentId: unchangedAppointment.appointment.id,
    updatedAppointmentId: updatedAppointment.appointment.id,
    deletedAppointmentId: deletedAppointment.appointment.id,
  };
}

export function expectAppointmentResourceStatusScenario(
  appointments: AppointmentListItem[],
  scenario: AppointmentResourceStatusScenario,
) {
  const unchangedAppointment = findAppointment(
    appointments,
    scenario.unchangedAppointmentId,
  );
  const updatedAppointment = findAppointment(
    appointments,
    scenario.updatedAppointmentId,
  );
  const deletedAppointment = findAppointment(
    appointments,
    scenario.deletedAppointmentId,
  );

  expectResourceStatuses(unchangedAppointment, "UNCHANGED");
  expectResourceStatuses(updatedAppointment, "UPDATED");
  expectResourceStatuses(deletedAppointment, "DELETED");

  expect(updatedAppointment.customer.fullName).toBe("Cliente original");
  expect(updatedAppointment.services[0]?.name).toBe("Lavagem completa");
  expect(updatedAppointment.vehicle?.model).toBe("Civic");
}

async function createAppointmentWithResources({
  app,
  prisma,
  accessToken,
  establishment,
  customerFactory,
  serviceFactory,
  customerName,
  serviceName,
  vehicleModel,
  startsAt,
}: CreateAppointmentResourceStatusScenarioInput & {
  customerName: string;
  serviceName: string;
  vehicleModel: string;
  startsAt: string;
}) {
  const customer = await customerFactory.makePrismaCustomer({
    establishmentId: establishment.id,
    cpfCnpj: null,
    fullName: customerName,
  });
  const service = await serviceFactory.makePrismaService({
    establishmentId: establishment.id,
    serviceName: ServiceName.create(serviceName),
  });
  const vehicle = await prisma.customerVehicle.create({
    data: {
      establishmentId: establishment.id.toString(),
      customerId: customer.id.toString(),
      plate: null,
      brand: "Honda",
      model: vehicleModel,
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
        serviceIds: [service.id.toString()],
        vehicleId: vehicle.id,
        startsAt,
        endsAt: "2026-04-13T13:00:00.000Z",
      }),
    );

  expect(response.status).toBe(201);

  return {
    appointment: appointmentResponseSchema.parse(response.body).appointment,
    customerId: customer.id.toString(),
    serviceId: service.id.toString(),
    vehicleId: vehicle.id,
  };
}

function findAppointment(appointments: AppointmentListItem[], id: string) {
  const appointment = appointments.find((item) => item.id === id);

  expect(appointment).toBeDefined();

  return appointment!;
}

function expectResourceStatuses(
  appointment: AppointmentListItem,
  status: "UNCHANGED" | "UPDATED" | "DELETED",
) {
  expect(appointment.customer.currentResourceStatus).toBe(status);
  expect(appointment.services[0]?.currentResourceStatus).toBe(status);
  expect(appointment.vehicle?.currentResourceStatus).toBe(status);
}
