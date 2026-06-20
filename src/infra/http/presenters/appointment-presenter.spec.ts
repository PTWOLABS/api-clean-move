import { describe, expect, it } from "vitest";

import { makeAppointment } from "../../../../tests/factories/appointment-factory";
import { AppointmentPresenter } from "./appointment-presenter";

describe("AppointmentPresenter", () => {
  it("should derive vehicle display name from available snapshot fields", () => {
    const appointment = makeAppointment({
      vehicle: {
        plate: "ABC1D23",
        brand: "Honda",
        model: "Civic",
        color: "Prata",
        year: 2011,
      },
    });

    const http = AppointmentPresenter.toHTTP(appointment);

    expect(http.vehicle).toEqual({
      plate: "ABC1D23",
      brand: "Honda",
      model: "Civic",
      color: "Prata",
      year: 2011,
      displayName: "Honda Civic 2011",
      currentResourceStatus: "UNCHANGED",
    });
  });

  it("should return null display name when the vehicle has no searchable name parts", () => {
    const appointment = makeAppointment({
      vehicle: {
        plate: "ABC1D23",
        brand: null,
        model: null,
        color: "Prata",
        year: null,
      },
    });

    const http = AppointmentPresenter.toHTTP(appointment);

    expect(http.vehicle?.displayName).toBeNull();
  });
});
