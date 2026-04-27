import {
  InvalidMoneyError,
  Money,
} from "../../../catalog/domain/value-objects/money";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { InvalidAppointmentInputError } from "../errors/invalid-appointment-input-error";
import { Appointment } from "./appointment";

const baseProps = {
  establishmentId: new UniqueEntityId("establishment-1"),
  customerId: new UniqueEntityId("customer-1"),
  vehicleId: null,
  service: {
    serviceId: new UniqueEntityId("service-1"),
    serviceName: "Lavagem simples",
    category: "WASH" as const,
    durationInMinutes: 60,
    priceInCents: 3000,
  },
  vehicle: null,
  startsAt: new Date("2026-04-27T10:00:00.000Z"),
  endsAt: null,
  description: null,
  discountInCents: null,
};

describe("Appointment", () => {
  it("should start as scheduled", () => {
    const appointment = Appointment.create(baseProps);

    expect(appointment.status).toEqual("SCHEDULED");
  });

  it("should accept appointments without an end date", () => {
    const appointment = Appointment.create({ ...baseProps, endsAt: null });

    expect(appointment.endsAt).toBeNull();
  });

  it("should not accept an end date before the start date", () => {
    expect(() =>
      Appointment.create({
        ...baseProps,
        endsAt: new Date("2026-04-27T09:00:00.000Z"),
      }),
    ).toThrow(InvalidAppointmentInputError);
  });

  it("should accept a discount money value", () => {
    const discountInCents = Money.create(500);

    const appointment = Appointment.create({ ...baseProps, discountInCents });

    expect(appointment.discountInCents?.amountInCents).toEqual(500);
  });

  it("should rely on money validation for discounts", () => {
    expect(() => Money.create(-1)).toThrow(InvalidMoneyError);
  });

  it("should mark an appointment as done", () => {
    const appointment = Appointment.create({
      ...baseProps,
      cancelledAt: new Date("2026-04-27T10:30:00.000Z"),
    });
    const referenceDate = new Date("2026-04-27T11:00:00.000Z");

    appointment.changeStatus("DONE", referenceDate);

    expect(appointment.status).toEqual("DONE");
    expect(appointment.doneAt).toEqual(referenceDate);
    expect(appointment.cancelledAt).toBeNull();
  });

  it("should cancel an appointment", () => {
    const appointment = Appointment.create({
      ...baseProps,
      doneAt: new Date("2026-04-27T10:30:00.000Z"),
    });
    const referenceDate = new Date("2026-04-27T11:00:00.000Z");

    appointment.changeStatus("CANCELLED", referenceDate);

    expect(appointment.status).toEqual("CANCELLED");
    expect(appointment.cancelledAt).toEqual(referenceDate);
    expect(appointment.doneAt).toBeNull();
  });

  it("should reschedule an appointment status", () => {
    const appointment = Appointment.create({
      ...baseProps,
      status: "DONE",
      doneAt: new Date("2026-04-27T10:30:00.000Z"),
    });

    appointment.changeStatus("SCHEDULED", new Date("2026-04-27T11:00:00.000Z"));

    expect(appointment.status).toEqual("SCHEDULED");
    expect(appointment.doneAt).toBeNull();
    expect(appointment.cancelledAt).toBeNull();
  });
});
