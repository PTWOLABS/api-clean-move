import { afterEach, describe, expect, it, vi } from "vitest";

import { makeQuote } from "../../../tests/factories/quote-factory";
import { UniqueEntityId } from "../../shared/entities/unique-entity-id";
import { PdfkitQuotePdfGenerator } from "./pdfkit-quote-pdf-generator";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("PdfkitQuotePdfGenerator", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should generate a professional PDF with all supported quote data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(ONE_PIXEL_PNG, {
          headers: { "content-type": "image/png" },
          status: 200,
        }),
      ),
    );
    const quote = makeQuote({
      establishment: {
        name: "Clean Move Estética Automotiva",
        legalBusinessName: "Clean Move Estética Automotiva LTDA",
        cnpj: "61911322000187",
        bannerImageUrl: "https://cdn.example.com/clean-move.png",
        address: {
          street: "Estrada Farmacêutico Oswaldo Paiva, 100",
          complement: null,
          city: "Socorro",
          state: "SP",
          zipCode: "13960000",
          country: "Brasil",
        },
      },
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
          discountType: "PERCENTAGE",
          discountValue: 10,
        },
      ],
    });

    const pdf = await new PdfkitQuotePdfGenerator().generate(quote);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5_000);
    expect(countPdfPages(pdf)).toBeGreaterThanOrEqual(1);
    expect(countPdfPages(pdf)).toBeLessThanOrEqual(2);
  });

  it("should fall back safely when the logo is invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("invalid png", {
          headers: { "content-type": "image/png" },
          status: 200,
        }),
      ),
    );
    const quote = makeQuote({
      establishment: {
        ...makeQuote().establishment,
        bannerImageUrl: "https://cdn.example.com/invalid.png",
      },
    });

    const pdf = await new PdfkitQuotePdfGenerator().generate(quote);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("should paginate long service lists", async () => {
    const services = Array.from({ length: 55 }, (_, index) => ({
      quoteServiceId: new UniqueEntityId(),
      serviceId: new UniqueEntityId(),
      serviceName: `Serviço detalhado número ${index + 1}`,
      durationInMinutes: 30 + index,
      priceInCents: 10_000 + index * 100,
      isCourtesy: index % 9 === 0,
    }));
    const quote = makeQuote({
      description:
        "O veículo deve ser avaliado antes da execução dos serviços.",
      services,
    });

    const pdf = await new PdfkitQuotePdfGenerator().generate(quote);

    expect(countPdfPages(pdf)).toBeGreaterThanOrEqual(3);
  });
});

function countPdfPages(pdf: Buffer) {
  return pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;
}
