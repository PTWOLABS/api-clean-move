import { describe, expect, it } from "vitest";

import { appointmentIntersectsRange } from "./appointment-intersects-range";

describe("appointmentIntersectsRange", () => {
  const rangeStartsAt = new Date("2026-04-10T08:00:00.000Z");
  const rangeEndsAt = new Date("2026-04-17T08:00:00.000Z");

  it("should include an appointment that starts before the range and ends within it", () => {
    const intersects = appointmentIntersectsRange(
      new Date("2026-04-09T10:00:00.000Z"),
      new Date("2026-04-12T10:00:00.000Z"),
      rangeStartsAt,
      rangeEndsAt,
    );

    expect(intersects).toBe(true);
  });

  it("should include an appointment that starts within the range and ends after it", () => {
    const intersects = appointmentIntersectsRange(
      new Date("2026-04-15T10:00:00.000Z"),
      new Date("2026-04-20T10:00:00.000Z"),
      rangeStartsAt,
      rangeEndsAt,
    );

    expect(intersects).toBe(true);
  });

  it("should include an appointment fully inside the range", () => {
    const intersects = appointmentIntersectsRange(
      new Date("2026-04-11T10:00:00.000Z"),
      new Date("2026-04-12T10:00:00.000Z"),
      rangeStartsAt,
      rangeEndsAt,
    );

    expect(intersects).toBe(true);
  });

  it("should not include an appointment fully outside the range", () => {
    const intersects = appointmentIntersectsRange(
      new Date("2026-04-20T10:00:00.000Z"),
      new Date("2026-04-21T10:00:00.000Z"),
      rangeStartsAt,
      rangeEndsAt,
    );

    expect(intersects).toBe(false);
  });

  it("should include a point-in-time appointment when startsAt falls inside the range", () => {
    const intersects = appointmentIntersectsRange(
      new Date("2026-04-12T10:00:00.000Z"),
      null,
      rangeStartsAt,
      rangeEndsAt,
    );

    expect(intersects).toBe(true);
  });

  it("should not include a point-in-time appointment outside the range", () => {
    const intersects = appointmentIntersectsRange(
      new Date("2026-04-20T10:00:00.000Z"),
      null,
      rangeStartsAt,
      rangeEndsAt,
    );

    expect(intersects).toBe(false);
  });
});
