import { Module } from "@nestjs/common";

import { QuotePdfGenerator } from "../../modules/application/gateways/quote-pdf-generator";
import { PdfkitQuotePdfGenerator } from "./pdfkit-quote-pdf-generator";

@Module({
  providers: [
    {
      provide: QuotePdfGenerator,
      useClass: PdfkitQuotePdfGenerator,
    },
  ],
  exports: [QuotePdfGenerator],
})
export class PdfModule {}
