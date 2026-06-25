import { Quote } from "../../quotes/domain/entities/quote";

export abstract class QuotePdfGenerator {
  abstract generate(quote: Quote): Promise<Buffer>;
}
