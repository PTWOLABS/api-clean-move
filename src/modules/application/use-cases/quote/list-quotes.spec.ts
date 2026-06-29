import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeQuote } from "../../../../../tests/factories/quote-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryQuotesRepository } from "../../../../../tests/repositories/in-memory-quotes-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
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
      referenceDate: new Date("2026-05-22T12:00:00.000Z"),
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.quotes).toEqual([matchingQuote]);
    expect(result.value.totalItems).toBe(1);
    expect(result.value.summary).toEqual({
      valid: 1,
      expiresToday: 0,
      approved: 0,
      expired: 0,
    });
  });

  it("should return totalItems and summary across all pages", async () => {
    const establishment = makeEstablishment();
    const referenceDate = new Date("2026-06-26T12:00:00.000Z");
    const validQuote = makeQuote({
      establishmentId: establishment.id,
      expiresAt: new Date("2026-06-28T23:59:59.000Z"),
      createdAt: new Date("2026-06-26T10:00:00.000Z"),
    });
    const noExpirationQuote = makeQuote({
      establishmentId: establishment.id,
      expiresAt: null,
      createdAt: new Date("2026-06-25T10:00:00.000Z"),
    });
    const expiresTodayQuote = makeQuote({
      establishmentId: establishment.id,
      expiresAt: new Date("2026-06-26T23:59:59.000Z"),
      createdAt: new Date("2026-06-24T10:00:00.000Z"),
    });
    const expiredQuote = makeQuote({
      establishmentId: establishment.id,
      expiresAt: new Date("2026-06-25T23:59:59.000Z"),
      createdAt: new Date("2026-06-23T10:00:00.000Z"),
    });
    const approvedQuote = makeQuote({
      establishmentId: establishment.id,
      convertedAppointmentId: new UniqueEntityId(),
      convertedAt: new Date("2026-06-25T10:00:00.000Z"),
      expiresAt: new Date("2026-06-25T23:59:59.000Z"),
      createdAt: new Date("2026-06-22T10:00:00.000Z"),
    });

    await establishmentsRepository.create(establishment);
    await quotesRepository.create(validQuote);
    await quotesRepository.create(noExpirationQuote);
    await quotesRepository.create(expiresTodayQuote);
    await quotesRepository.create(expiredQuote);
    await quotesRepository.create(approvedQuote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      filters: {
        page: 1,
        size: 2,
      },
      referenceDate,
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.quotes).toEqual([validQuote, noExpirationQuote]);
    expect(result.value.totalItems).toBe(5);
    expect(result.value.summary).toEqual({
      valid: 2,
      expiresToday: 1,
      approved: 1,
      expired: 1,
    });
  });

  it("should sort quotes by creation date", async () => {
    const establishment = makeEstablishment();
    const oldestQuote = makeQuote({
      establishmentId: establishment.id,
      createdAt: new Date("2026-06-20T10:00:00.000Z"),
    });
    const middleQuote = makeQuote({
      establishmentId: establishment.id,
      createdAt: new Date("2026-06-21T10:00:00.000Z"),
    });
    const recentQuote = makeQuote({
      establishmentId: establishment.id,
      createdAt: new Date("2026-06-22T10:00:00.000Z"),
    });

    await establishmentsRepository.create(establishment);
    await quotesRepository.create(middleQuote);
    await quotesRepository.create(recentQuote);
    await quotesRepository.create(oldestQuote);

    const actor = {
      userId: establishment.ownerId.toString(),
      role: "ESTABLISHMENT" as const,
    };

    const recentResult = await sut.execute({
      actor,
    });
    const oldestResult = await sut.execute({
      actor,
      filters: {
        sort: "oldest",
      },
    });

    expect(recentResult.isRight()).toBe(true);
    expect(oldestResult.isRight()).toBe(true);
    if (recentResult.isLeft()) throw recentResult.value;
    if (oldestResult.isLeft()) throw oldestResult.value;
    expect(recentResult.value.quotes).toEqual([
      recentQuote,
      middleQuote,
      oldestQuote,
    ]);
    expect(oldestResult.value.quotes).toEqual([
      oldestQuote,
      middleQuote,
      recentQuote,
    ]);
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
