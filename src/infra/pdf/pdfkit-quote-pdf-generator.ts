import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";

import { QuotePdfGenerator } from "../../modules/application/gateways/quote-pdf-generator";
import { Quote } from "../../modules/quotes/domain/entities/quote";
import { PdfkitQuoteLayout } from "./pdfkit-quote-layout";
import { loadQuoteLogo } from "./quote-logo-loader";

@Injectable()
export class PdfkitQuotePdfGenerator implements QuotePdfGenerator {
  async generate(quote: Quote): Promise<Buffer> {
    const logo = await loadQuoteLogo(quote.establishment.bannerImageUrl);

    return new Promise((resolve, reject) => {
      const document = new PDFDocument({
        bufferPages: true,
        info: {
          Author: quote.establishment.name,
          CreationDate: quote.createdAt,
          Creator: "Clean Move",
          Subject: "Orçamento de serviços",
          Title: quote.establishment.name,
        },
        margins: {
          bottom: 64,
          left: 46,
          right: 46,
          top: 42,
        },
        size: "A4",
      });
      const chunks: Buffer[] = [];

      document.on("data", (chunk: Buffer) => chunks.push(chunk));
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);

      try {
        new PdfkitQuoteLayout(document).render(quote, logo);
        document.end();
      } catch (error) {
        document.destroy(error as Error);
      }
    });
  }
}
