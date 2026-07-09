import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

import {
  QuoteZodValidationPipe,
  formatQuoteValidationIssues,
} from "./quote-zod-validation.pipe";

describe("QuoteZodValidationPipe", () => {
  it("should format Zod issues as stable quote field errors", () => {
    const schema = z.object({
      customer: z.object({
        email: z.email(),
        name: z.string(),
      }),
      serviceItems: z.array(z.string()).min(1),
      priceInCents: z.number().min(0),
    });
    const result = schema.safeParse({
      customer: { email: "invalid" },
      serviceItems: [],
      priceInCents: -1,
    });

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected schema parsing to fail");
    }

    expect(formatQuoteValidationIssues(result.error)).toEqual([
      { field: "customer.email", code: "INVALID_FORMAT" },
      { field: "customer.name", code: "REQUIRED" },
      { field: "serviceItems", code: "MIN_ITEMS" },
      { field: "priceInCents", code: "OUT_OF_RANGE" },
    ]);
  });

  it("should return the quote validation response contract", () => {
    const pipe = new QuoteZodValidationPipe(
      z.object({
        customer: z.object({
          name: z.string(),
        }),
      }),
    );

    expect(() => pipe.transform({})).toThrowError(BadRequestException);

    try {
      pipe.transform({});
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toEqual({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        errors: [{ field: "customer", code: "REQUIRED" }],
      });
    }
  });
});
