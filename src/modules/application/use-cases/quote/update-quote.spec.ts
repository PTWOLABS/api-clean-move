import { beforeEach, describe, expect, it } from "vitest";

import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeQuote } from "../../../../../tests/factories/quote-factory";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryQuotesRepository } from "../../../../../tests/repositories/in-memory-quotes-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import { UpdateQuoteUseCase } from "./update-quote";

let quotesRepository: InMemoryQuotesRepository;
let customersRepository: InMemoryCustomersRepository;
let customerVehiclesRepository: InMemoryCustomerVehiclesRepository;
let servicesRepository: InMemoryServicesRepository;
let sut: UpdateQuoteUseCase;

const establishmentId = new UniqueEntityId("establishment-quote-update");
const actor = { userId: "owner-1", role: "ESTABLISHMENT" as const };
const referenceDate = new Date("2026-06-30T12:00:00.000Z");

const establishmentScope = {
  resolve: async () => ({
    isLeft: () => false,
    value: {
      establishment: {
        id: establishmentId,
      },
    },
  }),
};

describe("Update quote", () => {
  beforeEach(() => {
    quotesRepository = new InMemoryQuotesRepository();
    customersRepository = new InMemoryCustomersRepository();
    customerVehiclesRepository = new InMemoryCustomerVehiclesRepository(
      customersRepository,
    );
    servicesRepository = new InMemoryServicesRepository();
    sut = new UpdateQuoteUseCase(
      quotesRepository,
      customersRepository,
      establishmentScope as never,
    );
  });

  it("should update direct quote fields while quote is valid", async () => {
    const quote = makeQuote({
      establishmentId,
      expiresAt: new Date("2026-07-02T12:00:00.000Z"),
    });
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor,
      quoteId: quote.id.toString(),
      description: "Descricao revisada",
      termsAndConditions: "Condicoes revisadas",
      expiresAt: new Date("2026-07-05T12:00:00.000Z"),
      referenceDate,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.quote.description).toBe("Descricao revisada");
      expect(result.value.quote.termsAndConditions).toBe(
        "Condicoes revisadas",
      );
      expect(result.value.quote.expiresAt).toEqual(
        new Date("2026-07-05T12:00:00.000Z"),
      );
    }
  });

  it("should allow updating an expires-today quote", async () => {
    const quote = makeQuote({
      establishmentId,
      expiresAt: new Date("2026-06-30T18:00:00.000Z"),
    });
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor,
      quoteId: quote.id.toString(),
      description: "Ainda valido hoje",
      referenceDate,
    });

    expect(result.isRight()).toBe(true);
  });

  it("should reject expired quotes", async () => {
    const quote = makeQuote({
      establishmentId,
      expiresAt: new Date("2026-06-29T18:00:00.000Z"),
    });
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor,
      quoteId: quote.id.toString(),
      description: "Nao deve atualizar",
      referenceDate,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should reject approved quotes", async () => {
    const quote = makeQuote({
      establishmentId,
      customerId: new UniqueEntityId("customer-approved"),
      convertedAppointmentId: new UniqueEntityId("appointment-approved"),
      convertedAt: new Date("2026-06-25T12:00:00.000Z"),
    });
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor,
      quoteId: quote.id.toString(),
      description: "Nao deve atualizar",
      referenceDate,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should reject customer object when quote already has customerId", async () => {
    const customer = makeCustomer({ establishmentId });
    const quote = makeQuote({
      establishmentId,
      customerId: customer.id,
    });
    await customersRepository.create(customer);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor,
      quoteId: quote.id.toString(),
      customer: {
        name: "Nao permitido",
      },
      referenceDate,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should reject null customer update inputs", async () => {
    const quote = makeQuote({
      establishmentId,
      expiresAt: new Date("2026-07-02T12:00:00.000Z"),
    });
    await quotesRepository.create(quote);

    const invalidInputs = [
      { customerId: null as never },
      { customer: null as never },
      { customerId: null as never, customer: null as never },
    ];

    for (const input of invalidInputs) {
      const result = await sut.execute({
        actor,
        quoteId: quote.id.toString(),
        ...input,
        referenceDate,
      });

      expect(result.isLeft()).toBe(true);
      expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
    }
  });

  it("should replace prospect snapshot from customer object", async () => {
    const quote = makeQuote({
      establishmentId,
      customerId: null,
      expiresAt: new Date("2026-07-02T12:00:00.000Z"),
      customer: {
        name: "Prospect Original",
        phone: "11911111111",
        cpfCnpj: null,
        address: null,
      },
    });
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor,
      quoteId: quote.id.toString(),
      customer: {
        name: "Prospect Atualizado",
        cpfCnpj: "52998224725",
      },
      referenceDate,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.quote.customerId).toBeNull();
      expect(result.value.quote.customer).toEqual({
        name: "Prospect Atualizado",
        phone: null,
        cpfCnpj: "52998224725",
        address: null,
      });
    }
  });

  it("should switch prospect to existing customer without changing the customer record", async () => {
    const customer = makeCustomer({
      establishmentId,
      fullName: "Cliente Existente",
    });
    const quote = makeQuote({
      establishmentId,
      customerId: null,
      expiresAt: new Date("2026-07-02T12:00:00.000Z"),
      customer: {
        name: "Prospect Digitado",
        phone: "11911111111",
        cpfCnpj: null,
        address: null,
      },
    });
    await customersRepository.create(customer);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor,
      quoteId: quote.id.toString(),
      customerId: customer.id.toString(),
      referenceDate,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.quote.customerId).toEqual(customer.id);
      expect(result.value.quote.customer.name).toBe("Cliente Existente");
      expect(customer.fullName).toBe("Cliente Existente");
    }
  });
});
