import { vi } from "vitest";

import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeQuote } from "../../../../../tests/factories/quote-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryQuotesRepository } from "../../../../../tests/repositories/in-memory-quotes-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { EstablishmentScopeService } from "../../services/establishment-scope";
import { QuoteApprovalAnalysis } from "../../services/quote-approval/quote-approval-analysis";
import { AnalyzeQuoteApprovalUseCase } from "./analyze-quote-approval";

let quotesRepository: InMemoryQuotesRepository;
let employeesRepository: InMemoryEmployeesRepository;
let establishmentsRepository: InMemoryEstablishmentsRepository;
let servicesRepository: InMemoryServicesRepository;
let establishmentScope: EstablishmentScopeService;
let analyzer: { analyze: ReturnType<typeof vi.fn> };
let sut: AnalyzeQuoteApprovalUseCase;

describe("Analyze quote approval", () => {
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
    analyzer = {
      analyze: vi.fn().mockResolvedValue(readyAnalysis()),
    };
    sut = new AnalyzeQuoteApprovalUseCase(
      quotesRepository,
      establishmentScope,
      analyzer as never,
    );
  });

  it("should analyze quote approval inside owner scope", async () => {
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
      startsAt: new Date("2026-07-20T13:00:00.000Z"),
      endsAt: new Date("2026-07-20T15:00:00.000Z"),
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value).toMatchObject({ analysis: { status: "READY" } });
    expect(analyzer.analyze).toHaveBeenCalledWith({
      quote,
      establishmentId: establishment.id.toString(),
    });
  });

  it("should analyze quote approval inside employee scope", async () => {
    const establishment = makeEstablishment();
    const employee = makeEmployee({ establishmentId: establishment.id });
    const quote = makeQuote({ establishmentId: establishment.id });

    await establishmentsRepository.create(establishment);
    await employeesRepository.create(employee);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: employee.userId.toString(),
        role: "EMPLOYEE",
      },
      quoteId: quote.id.toString(),
      startsAt: new Date("2026-07-20T13:00:00.000Z"),
      endsAt: new Date("2026-07-20T15:00:00.000Z"),
    });

    expect(result.isRight()).toBe(true);
    expect(analyzer.analyze).toHaveBeenCalledWith({
      quote,
      establishmentId: establishment.id.toString(),
    });
  });

  it("should return not found when quote does not belong to scope", async () => {
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
      startsAt: new Date("2026-07-20T13:00:00.000Z"),
      endsAt: new Date("2026-07-20T15:00:00.000Z"),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
    expect(analyzer.analyze).not.toHaveBeenCalled();
  });

  it("should reject invalid actors", async () => {
    const result = await sut.execute({
      actor: {
        userId: "user-1",
        role: "CUSTOMER",
      },
      quoteId: "quote-1",
      startsAt: new Date("2026-07-20T13:00:00.000Z"),
      endsAt: new Date("2026-07-20T15:00:00.000Z"),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should reject already converted quotes", async () => {
    const establishment = makeEstablishment();
    const quote = makeQuote({
      establishmentId: establishment.id,
      convertedAppointmentId: new UniqueEntityId("appointment-1"),
      convertedAt: new Date("2026-07-13T10:00:00.000Z"),
    });

    await establishmentsRepository.create(establishment);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      startsAt: new Date("2026-07-20T13:00:00.000Z"),
      endsAt: new Date("2026-07-20T15:00:00.000Z"),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
    expect(result.value).toMatchObject({ code: "QUOTE_ALREADY_CONVERTED" });
    expect(analyzer.analyze).not.toHaveBeenCalled();
  });

  it("should reject invalid schedule intervals", async () => {
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
      startsAt: new Date("2026-07-20T15:00:00.000Z"),
      endsAt: new Date("2026-07-20T13:00:00.000Z"),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
    expect(result.value).toMatchObject({
      code: "QUOTE_INVALID_SCHEDULE_INTERVAL",
    });
    expect(analyzer.analyze).not.toHaveBeenCalled();
  });

  it("should not write quote changes during analysis", async () => {
    const establishment = makeEstablishment();
    const quote = makeQuote({ establishmentId: establishment.id });
    const saveSpy = vi.spyOn(quotesRepository, "save");

    await establishmentsRepository.create(establishment);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      startsAt: new Date("2026-07-20T13:00:00.000Z"),
      endsAt: null,
    });

    expect(result.isRight()).toBe(true);
    expect(saveSpy).not.toHaveBeenCalled();
  });
});

function readyAnalysis(): QuoteApprovalAnalysis {
  return {
    status: "READY",
    automaticResolutions: [],
    customer: {
      status: "RESOLVED",
      requiresResolution: false,
      automaticCustomerId: null,
      candidates: [],
    },
    vehicle: {
      status: "NONE",
      requiresResolution: false,
      candidateVehicleId: null,
      candidateCustomerId: null,
      allowedActions: [],
    },
    services: [],
  };
}
