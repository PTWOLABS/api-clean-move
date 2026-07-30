import { describe, expect, it } from "vitest";

import {
  formatAddress,
  formatCurrency,
  formatDiscount,
  formatDocument,
  formatDuration,
  formatPaymentMethod,
  formatPhone,
  formatQuoteDate,
} from "./quote-pdf-formatters";

describe("quote PDF formatters", () => {
  it("should format Brazilian presentation values", () => {
    expect(formatCurrency(1_085_000)).toBe("R$ 10.850,00");
    expect(formatDocument("50224464000150")).toBe("50.224.464/0001-50");
    expect(formatDocument("12345678901")).toBe("123.456.789-01");
    expect(formatPhone("11999998888")).toBe("(11) 99999-8888");
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(95)).toBe("1h 35min");
  });

  it("should format dates using the Sao Paulo calendar day", () => {
    expect(formatQuoteDate(new Date("2026-07-14T02:59:59.999Z"))).toBe(
      "13/07/2026",
    );
  });

  it("should format complete and partial addresses", () => {
    expect(
      formatAddress({
        street: "Rua Praxedes Domingues de Oliveira, 500",
        complement: "Sala 2",
        city: "São Paulo",
        state: "SP",
        zipCode: "01234567",
        country: "Brasil",
      }),
    ).toBe(
      "Rua Praxedes Domingues de Oliveira, 500, Sala 2 • São Paulo - SP • CEP 01234-567 • Brasil",
    );

    expect(
      formatAddress({
        street: null,
        complement: null,
        city: "Socorro",
        state: "SP",
        zipCode: null,
        country: null,
      }),
    ).toBe("Socorro - SP");
    expect(formatAddress(null)).toBeNull();
  });

  it("should format every payment detail", () => {
    expect(formatPaymentMethod("CASH")).toBe("Dinheiro");
    expect(formatPaymentMethod("PIX")).toBe("Pix");
    expect(formatPaymentMethod("CARD")).toBe("Cartão");
    expect(formatPaymentMethod("OTHER")).toBe("Outro");
    expect(formatDiscount("PERCENTAGE", 10)).toBe("10% de desconto");
    expect(formatDiscount("AMOUNT", 55_000)).toBe("R$ 550,00 de desconto");
  });
});
