import { QuotePdfGenerator } from "../../src/modules/application/gateways/quote-pdf-generator";
import { Quote } from "../../src/modules/quotes/domain/entities/quote";

export class FakeQuotePdfGenerator implements QuotePdfGenerator {
  public generatedQuotes: Quote[] = [];
  public buffer = Buffer.from("%PDF-1.4\nfake quote pdf\n");

  async generate(quote: Quote): Promise<Buffer> {
    this.generatedQuotes.push(quote);
    return this.buffer;
  }
}
