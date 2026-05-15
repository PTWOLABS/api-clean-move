import {
  InvalidDashboardMetricsRangeError,
  resolveDashboardMetricsRange,
} from "./dashboard-metrics-range-resolver";

const referenceDate = new Date("2026-05-15T12:00:00.000Z");

function expectRange(
  range: { startsAt: Date; endsAt: Date },
  startsAt: string,
  endsAt: string,
) {
  expect(range.startsAt).toEqual(new Date(startsAt));
  expect(range.endsAt).toEqual(new Date(endsAt));
}

describe("resolveDashboardMetricsRange", () => {
  it("should resolve last-7-days and its previous 7 calendar days", () => {
    const result = resolveDashboardMetricsRange(
      { period: "last-7-days" },
      { referenceDate },
    );

    expect(result.period).toBe("last-7-days");
    expectRange(
      result.current,
      "2026-05-09T00:00:00.000Z",
      "2026-05-15T23:59:59.999Z",
    );
    expectRange(
      result.comparison,
      "2026-05-02T00:00:00.000Z",
      "2026-05-08T23:59:59.999Z",
    );
  });

  it("should resolve last-30-days and its previous 30 calendar days", () => {
    const result = resolveDashboardMetricsRange(
      { period: "last-30-days" },
      { referenceDate },
    );

    expect(result.period).toBe("last-30-days");
    expectRange(
      result.current,
      "2026-04-16T00:00:00.000Z",
      "2026-05-15T23:59:59.999Z",
    );
    expectRange(
      result.comparison,
      "2026-03-17T00:00:00.000Z",
      "2026-04-15T23:59:59.999Z",
    );
  });

  it("should resolve this-month and its equivalent elapsed interval in previous month", () => {
    const result = resolveDashboardMetricsRange(
      { period: "this-month" },
      { referenceDate },
    );

    expect(result.period).toBe("this-month");
    expectRange(
      result.current,
      "2026-05-01T00:00:00.000Z",
      "2026-05-15T23:59:59.999Z",
    );
    expectRange(
      result.comparison,
      "2026-04-01T00:00:00.000Z",
      "2026-04-15T23:59:59.999Z",
    );
  });

  it("should default to this-month when no period or custom range is provided", () => {
    const result = resolveDashboardMetricsRange({}, { referenceDate });

    expect(result.period).toBe("this-month");
    expectRange(
      result.current,
      "2026-05-01T00:00:00.000Z",
      "2026-05-15T23:59:59.999Z",
    );
    expectRange(
      result.comparison,
      "2026-04-01T00:00:00.000Z",
      "2026-04-15T23:59:59.999Z",
    );
  });

  it("should resolve startsAt without endsAt through the end of the reference day", () => {
    const result = resolveDashboardMetricsRange(
      {
        period: "last-7-days",
        startsAt: new Date("2026-05-10T09:30:00.000Z"),
      },
      { referenceDate },
    );

    expect(result.period).toBeUndefined();
    expectRange(
      result.current,
      "2026-05-10T09:30:00.000Z",
      "2026-05-15T23:59:59.999Z",
    );
    expectRange(
      result.comparison,
      "2026-05-04T19:00:00.000Z",
      "2026-05-10T09:29:59.999Z",
    );
  });

  it("should reject endsAt without startsAt", () => {
    expect(() =>
      resolveDashboardMetricsRange(
        {
          endsAt: new Date("2026-05-15T23:59:59.999Z"),
        },
        { referenceDate },
      ),
    ).toThrow(
      new InvalidDashboardMetricsRangeError("endsAt requires startsAt."),
    );
  });

  it("should reject future startsAt", () => {
    expect(() =>
      resolveDashboardMetricsRange(
        {
          startsAt: new Date("2026-05-15T12:00:00.001Z"),
        },
        { referenceDate },
      ),
    ).toThrow(
      new InvalidDashboardMetricsRangeError(
        "startsAt cannot be in the future.",
      ),
    );
  });

  it("should reject endsAt before startsAt", () => {
    expect(() =>
      resolveDashboardMetricsRange(
        {
          startsAt: new Date("2026-05-10T00:00:00.000Z"),
          endsAt: new Date("2026-05-09T23:59:59.999Z"),
        },
        { referenceDate },
      ),
    ).toThrow(
      new InvalidDashboardMetricsRangeError(
        "endsAt must be greater than or equal to startsAt.",
      ),
    );
  });

  it("should accept a range with exactly 24 calendar months", () => {
    const result = resolveDashboardMetricsRange(
      {
        startsAt: new Date("2024-05-15T00:00:00.000Z"),
        endsAt: new Date("2026-05-15T23:59:59.999Z"),
      },
      { referenceDate },
    );

    expectRange(
      result.current,
      "2024-05-15T00:00:00.000Z",
      "2026-05-15T23:59:59.999Z",
    );
  });

  it("should reject a range above 24 calendar months", () => {
    expect(() =>
      resolveDashboardMetricsRange(
        {
          startsAt: new Date("2024-05-15T00:00:00.000Z"),
          endsAt: new Date("2026-05-16T00:00:00.000Z"),
        },
        { referenceDate },
      ),
    ).toThrow(
      new InvalidDashboardMetricsRangeError(
        "Range cannot exceed 24 calendar months.",
      ),
    );
  });

  it("should compare a closed full-month custom range with the full previous month", () => {
    const result = resolveDashboardMetricsRange(
      {
        startsAt: new Date("2026-04-01T00:00:00.000Z"),
        endsAt: new Date("2026-04-30T23:59:59.999Z"),
      },
      { referenceDate },
    );

    expectRange(
      result.current,
      "2026-04-01T00:00:00.000Z",
      "2026-04-30T23:59:59.999Z",
    );
    expectRange(
      result.comparison,
      "2026-03-01T00:00:00.000Z",
      "2026-03-31T23:59:59.999Z",
    );
  });

  it("should compare a generic custom range with the immediately previous same duration", () => {
    const result = resolveDashboardMetricsRange(
      {
        startsAt: new Date("2026-05-10T10:00:00.000Z"),
        endsAt: new Date("2026-05-12T10:00:00.000Z"),
        granularity: "daily",
      },
      { referenceDate },
    );

    expect(result.granularity).toBe("daily");
    expectRange(
      result.current,
      "2026-05-10T10:00:00.000Z",
      "2026-05-12T10:00:00.000Z",
    );
    expectRange(
      result.comparison,
      "2026-05-08T09:59:59.999Z",
      "2026-05-10T09:59:59.999Z",
    );
  });
});
