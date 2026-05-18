import { InvalidDashboardMetricsRangeError } from "./dashboard-metrics-range-resolver";
import {
  buildDashboardOverviewBuckets,
  buildDashboardMetricBuckets,
  calculatePercentPointDifference,
  calculateTrendPercent,
  resolveDashboardOverviewGranularity,
  getDashboardMetricBucketKey,
  resolveDashboardMetricGranularity,
} from "./dashboard-metrics-bucket-builder";

function range(startsAt: string, endsAt: string) {
  return {
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
  };
}

describe("resolveDashboardMetricGranularity", () => {
  const referenceDate = new Date("2026-05-15T12:00:00.000Z");

  it("should accept compatible explicit granularities", () => {
    expect(
      resolveDashboardMetricGranularity({
        requestedGranularity: "daily",
        range: range("2026-05-01T00:00:00.000Z", "2026-05-31T23:59:59.999Z"),
        referenceDate,
      }),
    ).toBe("daily");

    expect(
      resolveDashboardMetricGranularity({
        requestedGranularity: "weekly",
        range: range("2026-01-01T00:00:00.000Z", "2026-06-29T23:59:59.999Z"),
        referenceDate,
      }),
    ).toBe("weekly");
  });

  it("should reject explicit daily ranges above 31 days", () => {
    expect(() =>
      resolveDashboardMetricGranularity({
        requestedGranularity: "daily",
        range: range("2026-05-01T00:00:00.000Z", "2026-06-01T23:59:59.999Z"),
        referenceDate,
      }),
    ).toThrow(InvalidDashboardMetricsRangeError);
  });

  it("should reject explicit weekly ranges above 180 days", () => {
    expect(() =>
      resolveDashboardMetricGranularity({
        requestedGranularity: "weekly",
        range: range("2026-01-01T00:00:00.000Z", "2026-06-30T23:59:59.999Z"),
        referenceDate,
      }),
    ).toThrow(InvalidDashboardMetricsRangeError);
  });

  it("should reject explicit monthly ranges above 24 calendar months", () => {
    expect(() =>
      resolveDashboardMetricGranularity({
        requestedGranularity: "monthly",
        range: range("2024-05-15T00:00:00.000Z", "2026-05-16T00:00:00.000Z"),
        referenceDate,
      }),
    ).toThrow(InvalidDashboardMetricsRangeError);
  });

  it("should resolve auto granularity for preset periods", () => {
    expect(
      resolveDashboardMetricGranularity({
        requestedGranularity: "auto",
        period: "last-7-days",
        range: range("2026-05-09T00:00:00.000Z", "2026-05-15T23:59:59.999Z"),
        referenceDate,
      }),
    ).toBe("daily");

    expect(
      resolveDashboardMetricGranularity({
        period: "last-30-days",
        range: range("2026-04-16T00:00:00.000Z", "2026-05-15T23:59:59.999Z"),
        referenceDate,
      }),
    ).toBe("weekly");
  });

  it("should resolve this-month as daily through day 15 and weekly from day 16", () => {
    expect(
      resolveDashboardMetricGranularity({
        period: "this-month",
        range: range("2026-05-01T00:00:00.000Z", "2026-05-15T23:59:59.999Z"),
        referenceDate: new Date("2026-05-15T12:00:00.000Z"),
      }),
    ).toBe("daily");

    expect(
      resolveDashboardMetricGranularity({
        period: "this-month",
        range: range("2026-05-01T00:00:00.000Z", "2026-05-16T23:59:59.999Z"),
        referenceDate: new Date("2026-05-16T12:00:00.000Z"),
      }),
    ).toBe("weekly");
  });

  it("should resolve auto custom ranges", () => {
    expect(
      resolveDashboardMetricGranularity({
        range: range("2026-05-01T00:00:00.000Z", "2026-05-31T23:59:59.999Z"),
        referenceDate,
      }),
    ).toBe("weekly");

    expect(
      resolveDashboardMetricGranularity({
        range: range("2026-01-01T00:00:00.000Z", "2026-06-29T23:59:59.999Z"),
        referenceDate,
      }),
    ).toBe("monthly");

    expect(
      resolveDashboardMetricGranularity({
        range: range("2024-05-15T00:00:00.000Z", "2026-05-15T23:59:59.999Z"),
        referenceDate,
      }),
    ).toBe("monthly");
  });
});

describe("buildDashboardMetricBuckets", () => {
  it("should build daily buckets including an empty middle bucket", () => {
    const buckets = buildDashboardMetricBuckets(
      range("2026-05-10T09:30:00.000Z", "2026-05-12T10:00:00.000Z"),
      "daily",
    );

    expect(buckets).toEqual([
      {
        date: "2026-05-10",
        label: "10/05",
        startsAt: new Date("2026-05-10T09:30:00.000Z"),
        endsAt: new Date("2026-05-10T23:59:59.999Z"),
      },
      {
        date: "2026-05-11",
        label: "11/05",
        startsAt: new Date("2026-05-11T00:00:00.000Z"),
        endsAt: new Date("2026-05-11T23:59:59.999Z"),
      },
      {
        date: "2026-05-12",
        label: "12/05",
        startsAt: new Date("2026-05-12T00:00:00.000Z"),
        endsAt: new Date("2026-05-12T10:00:00.000Z"),
      },
    ]);
  });

  it("should build weekly buckets starting on Monday and trim a mid-week range", () => {
    const buckets = buildDashboardMetricBuckets(
      range("2026-05-13T09:30:00.000Z", "2026-05-26T10:00:00.000Z"),
      "weekly",
    );

    expect(buckets).toEqual([
      {
        date: "2026-05-11",
        label: "11/05",
        startsAt: new Date("2026-05-13T09:30:00.000Z"),
        endsAt: new Date("2026-05-17T23:59:59.999Z"),
      },
      {
        date: "2026-05-18",
        label: "18/05",
        startsAt: new Date("2026-05-18T00:00:00.000Z"),
        endsAt: new Date("2026-05-24T23:59:59.999Z"),
      },
      {
        date: "2026-05-25",
        label: "25/05",
        startsAt: new Date("2026-05-25T00:00:00.000Z"),
        endsAt: new Date("2026-05-26T10:00:00.000Z"),
      },
    ]);
  });

  it("should build monthly buckets with Portuguese month labels", () => {
    const buckets = buildDashboardMetricBuckets(
      range("2026-01-15T08:00:00.000Z", "2026-04-10T18:00:00.000Z"),
      "monthly",
    );

    expect(
      buckets.map(({ date, label, startsAt, endsAt }) => ({
        date,
        label,
        startsAt,
        endsAt,
      })),
    ).toEqual([
      {
        date: "2026-01",
        label: "Jan",
        startsAt: new Date("2026-01-15T08:00:00.000Z"),
        endsAt: new Date("2026-01-31T23:59:59.999Z"),
      },
      {
        date: "2026-02",
        label: "Fev",
        startsAt: new Date("2026-02-01T00:00:00.000Z"),
        endsAt: new Date("2026-02-28T23:59:59.999Z"),
      },
      {
        date: "2026-03",
        label: "Mar",
        startsAt: new Date("2026-03-01T00:00:00.000Z"),
        endsAt: new Date("2026-03-31T23:59:59.999Z"),
      },
      {
        date: "2026-04",
        label: "Abr",
        startsAt: new Date("2026-04-01T00:00:00.000Z"),
        endsAt: new Date("2026-04-10T18:00:00.000Z"),
      },
    ]);
  });

  it("should map dates inside buckets to bucket keys and outside dates to null", () => {
    const buckets = buildDashboardMetricBuckets(
      range("2026-05-13T09:30:00.000Z", "2026-05-26T10:00:00.000Z"),
      "weekly",
    );

    expect(
      getDashboardMetricBucketKey(
        new Date("2026-05-18T12:00:00.000Z"),
        buckets,
      ),
    ).toBe("2026-05-18");
    expect(
      getDashboardMetricBucketKey(
        new Date("2026-05-13T09:29:59.999Z"),
        buckets,
      ),
    ).toBeNull();
    expect(
      getDashboardMetricBucketKey(
        new Date("2026-05-26T10:00:00.001Z"),
        buckets,
      ),
    ).toBeNull();
  });
});

describe("dashboard overview buckets", () => {
  it("should resolve overview granularity automatically from the range length", () => {
    expect(
      resolveDashboardOverviewGranularity(
        range("2026-05-09T00:00:00.000Z", "2026-05-15T23:59:59.999Z"),
      ),
    ).toBe("daily");

    expect(
      resolveDashboardOverviewGranularity(
        range("2026-05-01T00:00:00.000Z", "2026-06-12T23:59:59.999Z"),
      ),
    ).toBe("weekly");

    expect(
      resolveDashboardOverviewGranularity(
        range("2026-01-01T00:00:00.000Z", "2026-08-31T23:59:59.999Z"),
      ),
    ).toBe("monthly");
  });

  it("should compact overview buckets to at most seven points while preserving order", () => {
    const weeklyBuckets = buildDashboardOverviewBuckets(
      range("2026-01-01T00:00:00.000Z", "2026-02-18T23:59:59.999Z"),
    );
    const monthlyBuckets = buildDashboardOverviewBuckets(
      range("2025-01-01T00:00:00.000Z", "2025-10-31T23:59:59.999Z"),
    );

    expect(weeklyBuckets).toHaveLength(7);
    expect(weeklyBuckets[0]).toEqual({
      date: "2025-12-29",
      label: "29/12",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-01-11T23:59:59.999Z"),
    });
    expect(weeklyBuckets[6]).toEqual({
      date: "2026-02-16",
      label: "16/02",
      startsAt: new Date("2026-02-16T00:00:00.000Z"),
      endsAt: new Date("2026-02-18T23:59:59.999Z"),
    });

    expect(monthlyBuckets).toHaveLength(7);
    expect(monthlyBuckets[0]).toEqual({
      date: "2025-01",
      label: "Jan",
      startsAt: new Date("2025-01-01T00:00:00.000Z"),
      endsAt: new Date("2025-02-28T23:59:59.999Z"),
    });
    expect(monthlyBuckets[6]).toEqual({
      date: "2025-10",
      label: "Out",
      startsAt: new Date("2025-10-01T00:00:00.000Z"),
      endsAt: new Date("2025-10-31T23:59:59.999Z"),
    });
  });
});

describe("dashboard metric rounding helpers", () => {
  it("should calculate rounded trend percent and return null when previous value is zero", () => {
    expect(calculateTrendPercent(125, 100)).toBe(25);
    expect(calculateTrendPercent(96, 120)).toBe(-20);
    expect(calculateTrendPercent(10, 0)).toBeNull();
  });

  it("should calculate percent point difference with one decimal and return null without a previous percent", () => {
    expect(calculatePercentPointDifference(66.66, 50.02)).toBe(16.6);
    expect(calculatePercentPointDifference(50.02, 66.66)).toBe(-16.6);
    expect(calculatePercentPointDifference(10, null)).toBeNull();
    expect(calculatePercentPointDifference(10, undefined)).toBeNull();
  });
});
