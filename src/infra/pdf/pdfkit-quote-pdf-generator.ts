import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";

import { QuotePdfGenerator } from "../../modules/application/gateways/quote-pdf-generator";
import { Quote } from "../../modules/quotes/domain/entities/quote";

@Injectable()
export class PdfkitQuotePdfGenerator implements QuotePdfGenerator {
  async generate(quote: Quote): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({ margin: 48, size: "A4" });
      const chunks: Buffer[] = [];

      document.on("data", (chunk: Buffer) => chunks.push(chunk));
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);

      document.fontSize(18).text(quote.establishment.name, { align: "left" });
      document.fontSize(10).text(`CNPJ: ${quote.establishment.cnpj}`);
      if (quote.establishment.address) {
        document.text(
          `${quote.establishment.address.street}, ${quote.establishment.address.city} - ${quote.establishment.address.state}`,
        );
      }

      document.moveDown();
      document.fontSize(20).text("Orçamento", { align: "center" });
      document.moveDown();
      document.fontSize(12).text(`Cliente: ${quote.customer.name}`);
      if (quote.customer.phone) {
        document.text(`Telefone: ${quote.customer.phone}`);
      }
      if (quote.customer.cpfCnpj) {
        document.text(`Documento: ${quote.customer.cpfCnpj}`);
      }

      if (quote.vehicle) {
        document.moveDown();
        document.text(
          `Veiculo: ${quote.vehicle.model ?? "-"} ${quote.vehicle.year ?? ""}`,
        );
        document.text(`Placa: ${quote.vehicle.plate ?? "-"}`);
        document.text(`Cor: ${quote.vehicle.color ?? "-"}`);
      }

      document.moveDown();
      document.fontSize(14).text("Servicos");
      quote.services.forEach((service) => {
        const price = service.isCourtesy
          ? "CORTESIA"
          : formatCurrency(service.priceInCents);
        document.fontSize(11).text(`${service.serviceName} - ${price}`);
      });

      document.moveDown();
      document
        .fontSize(12)
        .text(`Subtotal: ${formatCurrency(quote.subtotalInCents)}`);
      document.text(
        `Cortesias: ${formatCurrency(quote.totalCourtesyValueInCents)}`,
      );

      document.moveDown();
      document.fontSize(14).text("Formas de pagamento");
      quote.paymentOptions.forEach((option) => {
        document
          .fontSize(11)
          .text(`${option.label}: ${formatCurrency(option.totalInCents)}`);
      });

      if (quote.description) {
        document.moveDown();
        document.fontSize(14).text("Observacoes");
        document.fontSize(11).text(quote.description);
      }

      if (quote.termsAndConditions) {
        document.moveDown();
        document.fontSize(14).text("Termos e Condições");
        document.fontSize(11).text(quote.termsAndConditions);
      }

      if (quote.expiresAt) {
        document.moveDown();
        document
          .fontSize(10)
          .text(`Validade: ${quote.expiresAt.toISOString().slice(0, 10)}`);
      }

      document.end();
    });
  }
}

function formatCurrency(amountInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountInCents / 100);
}
