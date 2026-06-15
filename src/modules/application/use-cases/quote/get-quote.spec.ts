import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeQuote } from "../../../../../tests/factories/quote-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryQuotesRepository } from "../../../../../tests/repositories/in-memory-quotes-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { EstablishmentScopeService } from "../../services/establishment-scope";
import { GetQuoteUseCase } from "./get-quote";

let quotesRepository: InMemoryQuotesRepository;
let employeesRepository: InMemoryEmployeesRepository;
let establishmentsRepository: InMemoryEstablishmentsRepository;
let servicesRepository: InMemoryServicesRepository;
let establishmentScope: EstablishmentScopeService;
let sut: GetQuoteUseCase;

describe("Get quote", () => {
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

    sut = new GetQuoteUseCase(quotesRepository, establishmentScope);
  });

  it("should get a quote by id inside establishment scope", async () => {
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
    expect(result.value.quote).toBe(quote);
  });

  it("should return not found for a quote from another establishment", async () => {
    const establishment = makeEstablishment();
    const otherEstablishment = makeEstablishment();
    const quote = makeQuote({ establishmentId: otherEstablishment.id });

    await establishmentsRepository.create(establishment);
    await establishmentsRepository.create(otherEstablishment);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
