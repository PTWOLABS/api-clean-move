import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeQuote } from "../../../../../tests/factories/quote-factory";
import { FakeQuotePdfGenerator } from "../../../../../tests/gateways/fake-quote-pdf-generator";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryQuotesRepository } from "../../../../../tests/repositories/in-memory-quotes-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { EstablishmentScopeService } from "../../services/establishment-scope";
import { GenerateQuotePdfUseCase } from "./generate-quote-pdf";

let quotesRepository: InMemoryQuotesRepository;
let employeesRepository: InMemoryEmployeesRepository;
let establishmentsRepository: InMemoryEstablishmentsRepository;
let servicesRepository: InMemoryServicesRepository;
let establishmentScope: EstablishmentScopeService;
let pdfGenerator: FakeQuotePdfGenerator;
let sut: GenerateQuotePdfUseCase;

describe("Generate quote PDF", () => {
  beforeEach(() => {
    quotesRepository = new InMemoryQuotesRepository();
    employeesRepository = new InMemoryEmployeesRepository();
    servicesRepository = new InMemoryServicesRepository();
    establishmentsRepository = new InMemoryEstablishmentsRepository(
      servicesRepository,
    );
    establishmentScope = new EstablishmentScopeService(
      establishmentsRepository,
      employeesRepository,
    );
    pdfGenerator = new FakeQuotePdfGenerator();

    sut = new GenerateQuotePdfUseCase(
      quotesRepository,
      establishmentScope,
      pdfGenerator,
    );
  });

  it("should generate a PDF for a scoped quote", async () => {
    const establishment = makeEstablishment();
    const quote = makeQuote({ establishmentId: establishment.id });
    await establishmentsRepository.create(establishment);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.fileName).toBe(`quote-${quote.id.toString()}.pdf`);
    expect(result.value.contentType).toBe("application/pdf");
    expect(result.value.pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdfGenerator.generatedQuotes).toEqual([quote]);
  });
});
