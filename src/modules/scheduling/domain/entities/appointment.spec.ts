import {
  InvalidMoneyError,
  Money,
} from "../../../catalog/domain/value-objects/money";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeServiceCategoryRef } from "../../../../../tests/helpers/service-category-ref";
import { InvalidAppointmentInputError } from "../errors/invalid-appointment-input-error";
import { Appointment } from "./appointment";

const washCategory = makeServiceCategoryRef("Lavagem");
const detailingCategory = makeServiceCategoryRef("Detailing Automotivo");

const baseProps = {
  establishmentId: new UniqueEntityId("establishment-1"),
  customerId: new UniqueEntityId("customer-1"),
  customer: {
    fullName: "Maria Silva",
  },
  vehicleId: null,
  services: [
    {
      serviceId: new UniqueEntityId("service-1"),
      serviceName: "Lavagem simples",
      category: washCategory,
      durationInMinutes: 60,
      priceInCents: 3000,
    },
  ],
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

  it("should accept a vehicle snapshot without a vehicle id", () => {
    const appointment = Appointment.create({
      ...baseProps,
      vehicleId: null,
      vehicle: {
        plate: "ABC1D23",
        brand: "Honda",
        model: "HR-V",
        color: "Branco",
        year: 2025,
      },
    });

    expect(appointment.vehicleId).toBeNull();
    expect(appointment.vehicle?.model).toBe("HR-V");
  });

  it("should not accept an end date before the start date", () => {
    expect(() =>
      Appointment.create({
        ...baseProps,
        endsAt: new Date("2026-04-27T09:00:00.000Z"),
      }),
    ).toThrow(InvalidAppointmentInputError);
  });

  it("should not accept appointments without services", () => {
    expect(() =>
      Appointment.create({
        ...baseProps,
        services: [],
      }),
    ).toThrow(InvalidAppointmentInputError);
  });

  it("should not accept appointments without a customer full name snapshot", () => {
    expect(() =>
      Appointment.create({
        ...baseProps,
        customer: {
          fullName: " ",
        },
      }),
    ).toThrow(InvalidAppointmentInputError);
  });

  it("should not accept duplicate services", () => {
    const duplicatedService = baseProps.services[0]!;

    expect(() =>
      Appointment.create({
        ...baseProps,
        services: [duplicatedService, duplicatedService],
      }),
    ).toThrow(InvalidAppointmentInputError);
  });

  it("should calculate total services price", () => {
    const firstService = baseProps.services[0]!;

    const total = Appointment.totalServicesPriceInCents([
      { ...firstService, priceInCents: 1000 },
      {
        ...firstService,
        serviceId: new UniqueEntityId("service-2"),
        priceInCents: 2500,
      },
    ]);

    expect(total).toEqual(3500);
  });

  it("should accept a discount money value", () => {
    const discountInCents = Money.create(500);

    const appointment = Appointment.create({ ...baseProps, discountInCents });

    expect(appointment.discountInCents?.amountInCents).toEqual(500);
  });

  it("should not accept zero discount", () => {
    expect(() =>
      Appointment.create({
        ...baseProps,
        discountInCents: Money.create(0),
      }),
    ).toThrow(InvalidAppointmentInputError);
  });

  it("should not accept discount greater than total services price", () => {
    expect(() =>
      Appointment.create({
        ...baseProps,
        discountInCents: Money.create(3001),
      }),
    ).toThrow(InvalidAppointmentInputError);
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

  it("should update editable appointment fields", () => {
    const discountInCents = Money.create(750);
    const doneAt = new Date("2026-04-27T12:00:00.000Z");
    const appointment = Appointment.create({
      ...baseProps,
      status: "DONE",
      doneAt,
    });
    const updatedService = {
      serviceId: new UniqueEntityId("service-2"),
      serviceName: "Lavagem completa",
      category: detailingCategory,
      durationInMinutes: 120,
      priceInCents: 12000,
    };
    const vehicleId = new UniqueEntityId("vehicle-1");

    appointment.update({
      customerId: new UniqueEntityId("customer-2"),
      vehicleId,
      services: [updatedService],
      vehicle: {
        plate: "DEF4G56",
        brand: "Toyota",
        model: "Corolla",
        color: "Prata",
        year: 2022,
      },
      startsAt: new Date("2026-04-28T14:00:00.000Z"),
      endsAt: new Date("2026-04-28T16:00:00.000Z"),
      description: "  Cliente prefere lavagem interna.  ",
      discountInCents,
    });

    expect(appointment.customerId.toString()).toBe("customer-2");
    expect(appointment.vehicleId).toEqual(vehicleId);
    expect(appointment.services).toEqual([updatedService]);
    expect(appointment.vehicle).toEqual({
      plate: "DEF4G56",
      brand: "Toyota",
      model: "Corolla",
      color: "Prata",
      year: 2022,
    });
    expect(appointment.startsAt).toEqual(new Date("2026-04-28T14:00:00.000Z"));
    expect(appointment.endsAt).toEqual(new Date("2026-04-28T16:00:00.000Z"));
    expect(appointment.description).toBe("Cliente prefere lavagem interna.");
    expect(appointment.discountInCents).toEqual(discountInCents);
    expect(appointment.status).toBe("DONE");
    expect(appointment.doneAt).toEqual(doneAt);
  });

  it("should clear nullable appointment fields", () => {
    const appointment = Appointment.create({
      ...baseProps,
      vehicleId: new UniqueEntityId("vehicle-1"),
      vehicle: {
        plate: "ABC1D23",
        brand: "Honda",
        model: "HR-V",
        color: "Branco",
        year: 2025,
      },
      endsAt: new Date("2026-04-27T11:00:00.000Z"),
      description: "Observacao",
      discountInCents: Money.create(500),
    });

    appointment.update({
      vehicleId: null,
      vehicle: null,
      endsAt: null,
      description: "   ",
      discountInCents: null,
    });

    expect(appointment.vehicleId).toBeNull();
    expect(appointment.vehicle).toBeNull();
    expect(appointment.endsAt).toBeNull();
    expect(appointment.description).toBeNull();
    expect(appointment.discountInCents).toBeNull();
  });

  it("should not keep invalid update state", () => {
    const appointment = Appointment.create({
      ...baseProps,
      endsAt: new Date("2026-04-27T11:00:00.000Z"),
    });

    expect(() =>
      appointment.update({
        startsAt: new Date("2026-04-27T12:00:00.000Z"),
      }),
    ).toThrow(InvalidAppointmentInputError);

    expect(appointment.startsAt).toEqual(new Date("2026-04-27T10:00:00.000Z"));
    expect(appointment.endsAt).toEqual(new Date("2026-04-27T11:00:00.000Z"));
  });
});
