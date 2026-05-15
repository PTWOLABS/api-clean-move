import { describe, expect, it } from "vitest";

import {
  dashboardDynamicMetricsQuerySchema,
  dashboardMetricsQuerySchema,
  dashboardPopularServicesMetricsQuerySchema,
} from "./dashboard-metrics-http";

describe("dashboard dynamic metrics query schemas", () => {
  it.each(["this-month", "last-7-days", "last-30-days"])(
    "should accept period=%s",
    (period) => {
      const result = dashboardDynamicMetricsQuerySchema.safeParse({ period });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.period).toBe(period);
      }
    },
  );

  it.each(["auto", "daily", "weekly", "monthly"])(
    "should accept granularity=%s",
    (granularity) => {
      const result = dashboardDynamicMetricsQuerySchema.safeParse({
        granularity,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.granularity).toBe(granularity);
      }
    },
  );

  it("should accept comma-separated categories", () => {
    const result = dashboardDynamicMetricsQuerySchema.safeParse({
      categories: "WASH,PROTECTION",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.categories).toEqual(["WASH", "PROTECTION"]);
    }
  });

  it("should accept repeated categories values", () => {
    const result = dashboardDynamicMetricsQuerySchema.safeParse({
      categories: ["WASH", "PROTECTION"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.categories).toEqual(["WASH", "PROTECTION"]);
    }
  });

  it("should accept comma-separated appointment statuses", () => {
    const result = dashboardDynamicMetricsQuerySchema.safeParse({
      status: "DONE,CANCELLED",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toEqual(["DONE", "CANCELLED"]);
    }
  });

  it("should accept repeated appointment status values", () => {
    const result = dashboardDynamicMetricsQuerySchema.safeParse({
      status: ["DONE", "CANCELLED"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toEqual(["DONE", "CANCELLED"]);
    }
  });

  it("should reject an unsupported period", () => {
    const result = dashboardDynamicMetricsQuerySchema.safeParse({
      period: "year",
    });

    expect(result.success).toBe(false);
  });

  it("should reject an unsupported granularity", () => {
    const result = dashboardDynamicMetricsQuerySchema.safeParse({
      granularity: "yearly",
    });

    expect(result.success).toBe(false);
  });

  it("should reject endsAt without startsAt", () => {
    const result = dashboardDynamicMetricsQuerySchema.safeParse({
      endsAt: "2026-05-31T23:59:59.999-03:00",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["endsAt"],
            message: "endsAt requires startsAt.",
          }),
        ]),
      );
    }
  });

  it("should reject endsAt before startsAt", () => {
    const result = dashboardDynamicMetricsQuerySchema.safeParse({
      startsAt: "2026-05-31T23:59:59.999-03:00",
      endsAt: "2026-05-01T00:00:00.000-03:00",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["endsAt"],
            message: "endsAt must be greater than or equal to startsAt.",
          }),
        ]),
      );
    }
  });

  it("should reject invalid calendar dates", () => {
    const result = dashboardDynamicMetricsQuerySchema.safeParse({
      startsAt: "2026-02-31T00:00:00.000-03:00",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["startsAt"],
            message: "Invalid calendar date.",
          }),
        ]),
      );
    }
  });

  it("should keep the overview query schema compatible with endsAt-only filters", () => {
    const result = dashboardMetricsQuerySchema.safeParse({
      endsAt: "2026-05-31T23:59:59.999-03:00",
    });

    expect(result.success).toBe(true);
  });
});

describe("dashboard popular services metrics query schema", () => {
  it("should default page and size", () => {
    const result = dashboardPopularServicesMetricsQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.size).toBe(5);
    }
  });

  it.each([{ page: "0" }, { size: "0" }, { page: "1.5" }, { size: "2.5" }])(
    "should reject invalid pagination values %o",
    (query) => {
      const result =
        dashboardPopularServicesMetricsQuerySchema.safeParse(query);

      expect(result.success).toBe(false);
    },
  );

  it("should coerce positive integer pagination values", () => {
    const result = dashboardPopularServicesMetricsQuerySchema.safeParse({
      page: "2",
      size: "10",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.size).toBe(10);
    }
  });
});
