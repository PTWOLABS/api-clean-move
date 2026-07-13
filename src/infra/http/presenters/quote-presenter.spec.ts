import { describe, expect, it } from "vitest";

import { makeQuote } from "../../../../tests/factories/quote-factory";
import { QuotePresenter } from "./quote-presenter";

describe("QuotePresenter", () => {
  it("should classify the Sao Paulo end of day as expiring today", () => {
    const quote = makeQuote({
      expiresAt: new Date("2026-07-14T02:59:59.999Z"),
    });

    const result = QuotePresenter.toListItem(
      quote,
      new Date("2026-07-13T12:00:00.000Z"),
    );

    expect(result.status).toBe("EXPIRES_TODAY");
  });
});
