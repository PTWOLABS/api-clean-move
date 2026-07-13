import { describe, expect, it } from "vitest";

import { getSaoPauloDayBounds } from "./get-sao-paulo-day-bounds";

describe("getSaoPauloDayBounds", () => {
  it("should return UTC bounds for the Sao Paulo calendar day", () => {
    const bounds = getSaoPauloDayBounds(new Date("2026-07-13T12:00:00.000Z"));

    expect(bounds.todayStart).toEqual(new Date("2026-07-13T03:00:00.000Z"));
    expect(bounds.tomorrowStart).toEqual(new Date("2026-07-14T03:00:00.000Z"));
  });
});
