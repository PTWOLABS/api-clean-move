import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeQuote } from "../../../../../tests/factories/quote-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryQuotesRepository } from "../../../../../tests/repositories/in-memory-quotes-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { EstablishmentScopeService } from "../../services/establishment-scope";
import { ListQuotesUseCase } from "./list-quotes";

let quotesRepository: InMemoryQuotesRepository;
let employeesRepository: InMemoryEmployeesRepository;
let establishmentsRepository: InMemoryEstablishmentsRepository;
let servicesRepository: InMemoryServicesRepository;
let establishmentScope: EstablishmentScopeService;
let sut: ListQuotesUseCase;

describe("List quotes", () => {
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

    sut = new ListQuotesUseCase(quotesRepository, establishmentScope);
  });

  it("should list scoped quotes with filters", async () => {
    const establishment = makeEstablishment();
    const matchingQuote = makeQuote({
      establishmentId: establishment.id,
      customer: {
        name: "Robertinho Contador",
        phone: "11999999999",
        cpfCnpj: null,
        address: null,
      },
      vehicle: {
        plate: "ABC1D23",
        brand: "Honda",
        model: "HR-V",
        color: "Branco",
        year: 2025,
      },
      createdAt: new Date("2026-05-22T10:00:00.000Z"),
    });
    const otherQuote = makeQuote({ establishmentId: establishment.id });

    await establishmentsRepository.create(establishment);
    await quotesRepository.create(matchingQuote);
    await quotesRepository.create(otherQuote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      filters: {
        search: "robertinho",
        vehiclePlate: "ABC-1D23",
        createdAt: new Date("2026-05-22T00:00:00.000Z"),
      },
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.quotes).toEqual([matchingQuote]);
  });

  it("should not list quotes from another establishment", async () => {
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
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.quotes).toEqual([]);
  });
});
