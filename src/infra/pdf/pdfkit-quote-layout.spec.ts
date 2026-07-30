import PDFDocument from "pdfkit";
import { describe, expect, it, vi } from "vitest";

import { makeQuote } from "../../../tests/factories/quote-factory";
import { UniqueEntityId } from "../../shared/entities/unique-entity-id";
import { PdfkitQuoteLayout } from "./pdfkit-quote-layout";

describe("PdfkitQuoteLayout", () => {
  it("should render the quote content required by the design", () => {
    const quote = makeQuote({
      customer: {
        name: "Roberto Contador",
        phone: "11999998888",
        email: "roberto@example.com",
        cpfCnpj: "12345678901",
        address: null,
      },
      services: [
        {
          quoteServiceId: new UniqueEntityId(),
          serviceId: new UniqueEntityId(),
          serviceName: "Lavagem detalhada",
          durationInMinutes: 120,
          priceInCents: 65_000,
          isCourtesy: false,
        },
        {
          quoteServiceId: new UniqueEntityId(),
          serviceId: new UniqueEntityId(),
          serviceName: "Vitrificação do couro",
          durationInMinutes: 45,
          priceInCents: 20_000,
          isCourtesy: true,
        },
      ],
      paymentOptions: [
        {
          method: "CARD",
          label: "Cartão em até 10x",
          installments: 10,
          interestFree: true,
          discountType: null,
          discountValue: null,
        },
        {
          method: "PIX",
          label: "Pagamento à vista no Pix",
          installments: 1,
          interestFree: true,
          discountType: "AMOUNT",
          discountValue: 5_000,
        },
      ],
    });

    const { texts } = renderQuote(quote);

    expect(texts).toContain("ORÇAMENTO");
    expect(texts).toContain("Válido até 31/05/2026");
    expect(texts).toContain("Roberto Contador");
    expect(texts).toContain("(11) 99999-8888");
    expect(texts).toContain("123.456.789-01");
    expect(texts).toContain("Honda HR-V");
    expect(texts).toContain("Lavagem detalhada");
    expect(texts).toContain("2h");
    expect(texts).toContain("Vitrificação do couro");
    expect(texts).toContain("CORTESIA");
    expect(texts).toContain("R$ 650,00");
    expect(texts).toContain("Cartão em até 10x");
    expect(texts).toContain("Pagamento à vista no Pix");
    expect(
      texts.some((text) => text.includes("10 parcelas  •  sem juros")),
    ).toBe(true);
    expect(texts.some((text) => text.includes("R$ 50,00 de desconto"))).toBe(
      true,
    );
    expect(texts).toContain("Observações");
    expect(texts).toContain("Termos e condições");
  });

  it("should omit absent optional sections and render contextual fallbacks", () => {
    const quote = makeQuote({
      customer: {
        name: "Cliente sem cadastro completo",
        phone: null,
        email: null,
        cpfCnpj: null,
        address: null,
      },
      description: null,
      expiresAt: null,
      termsAndConditions: null,
      vehicle: null,
    });

    const { texts } = renderQuote(quote);

    expect(texts).not.toContain("Observações");
    expect(texts).not.toContain("Termos e condições");
    expect(texts).not.toContain("CPF / CNPJ");
    expect(texts).not.toContain("Telefone");
    expect(texts).not.toContain("E-mail");
    expect(texts).toContain("Não informado");
    expect(texts.some((text) => text.includes("Sem data de validade"))).toBe(
      true,
    );
  });

  it("should paginate long text inside page bounds with continuation headings", () => {
    const longTerms = Array.from(
      { length: 1_500 },
      (_, index) => `condição-${index + 1}`,
    ).join(" ");
    const quote = makeQuote({
      description: null,
      termsAndConditions: longTerms,
    });

    const { pageCount, roundedRectangles, texts } = renderQuote(quote);

    expect(pageCount).toBeGreaterThan(2);
    expect(texts).toContain("Termos e condições (continuação)");
    expect(texts.filter((text) => text.startsWith("Página "))).toHaveLength(
      pageCount,
    );

    for (const rectangle of roundedRectangles) {
      expect(rectangle.y + rectangle.height).toBeLessThanOrEqual(
        rectangle.pageHeight - 64,
      );
    }
  });

  it("should repeat the services table header on additional pages", () => {
    const services = Array.from({ length: 55 }, (_, index) => ({
      quoteServiceId: new UniqueEntityId(),
      serviceId: new UniqueEntityId(),
      serviceName: `Serviço número ${index + 1}`,
      durationInMinutes: 30,
      priceInCents: 10_000,
      isCourtesy: false,
    }));
    const quote = makeQuote({ services });

    const { pageCount, texts } = renderQuote(quote);

    expect(pageCount).toBeGreaterThan(2);
    expect(texts.filter((text) => text === "DESCRIÇÃO").length).toBeGreaterThan(
      1,
    );
    expect(texts).toContain("Serviço número 1");
    expect(texts).toContain("Serviço número 55");
  });
});

function renderQuote(quote: ReturnType<typeof makeQuote>) {
  const document = new PDFDocument({
    bufferPages: true,
    margins: {
      bottom: 64,
      left: 46,
      right: 46,
      top: 42,
    },
    size: "A4",
  });
  const textSpy = vi.spyOn(document, "text");
  const roundedRectangleSpy = vi.spyOn(document, "roundedRect");

  document.on("data", () => undefined);
  new PdfkitQuoteLayout(document).render(quote, null);

  const pageCount = document.bufferedPageRange().count;
  const pageHeight = document.page.height;
  const texts = textSpy.mock.calls.map(([text]) => String(text));
  const roundedRectangles = roundedRectangleSpy.mock.calls.map(
    ([, y, , height]) => ({
      height,
      pageHeight,
      y,
    }),
  );

  document.end();

  return {
    pageCount,
    roundedRectangles,
    texts,
  };
}
