import { beforeEach, describe, expect, it } from "vitest";

import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { makeQuote } from "../../../../../tests/factories/quote-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryQuotesRepository } from "../../../../../tests/repositories/in-memory-quotes-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Money } from "../../../catalog/domain/value-objects/money";
import { ServiceName } from "../../../catalog/domain/value-objects/service-name";
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
      customerVehiclesRepository,
      establishmentScope as never,
      servicesRepository,
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
      expect(result.value.quote.termsAndConditions).toBe("Condicoes revisadas");
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

  it("should replace with a vehicle snapshot without creating a real vehicle", async () => {
    const customer = makeCustomer({ establishmentId });
    const quote = makeQuote({
      establishmentId,
      customerId: customer.id,
      vehicleId: new UniqueEntityId("vehicle-original"),
      expiresAt: new Date("2026-07-02T12:00:00.000Z"),
    });
    await customersRepository.create(customer);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor,
      quoteId: quote.id.toString(),
      vehicle: {
        plate: "abc1d23",
        brand: "Toyota",
        model: "Corolla",
        color: "Prata",
        year: 2024,
      },
      referenceDate,
    });

    expect(result.isRight()).toBe(true);
    expect(customerVehiclesRepository.items).toHaveLength(0);
    if (result.isRight()) {
      expect(result.value.quote.vehicleId).toBeNull();
      expect(result.value.quote.vehicle).toEqual({
        plate: "abc1d23",
        brand: "Toyota",
        model: "Corolla",
        color: "Prata",
        year: 2024,
      });
    }
  });

  it("should reject null vehicle update inputs", async () => {
    const quote = makeQuote({
      establishmentId,
      expiresAt: new Date("2026-07-02T12:00:00.000Z"),
    });
    await quotesRepository.create(quote);

    const invalidInputs = [
      { vehicleId: null },
      { vehicle: null },
      { vehicleId: null, vehicle: null },
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

  it("should reject vehicle snapshots without brand and model", async () => {
    const quote = makeQuote({
      establishmentId,
      expiresAt: new Date("2026-07-02T12:00:00.000Z"),
    });
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor,
      quoteId: quote.id.toString(),
      vehicle: {
        brand: "Honda",
      },
      referenceDate,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should update only the vehicle snapshot when quote remains prospect", async () => {
    const quote = makeQuote({
      establishmentId,
      customerId: null,
      vehicleId: null,
      expiresAt: new Date("2026-07-02T12:00:00.000Z"),
    });
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor,
      quoteId: quote.id.toString(),
      vehicle: {
        brand: "Honda",
        model: "Civic",
      },
      referenceDate,
    });

    expect(result.isRight()).toBe(true);
    expect(customerVehiclesRepository.items).toHaveLength(0);
    if (result.isRight()) {
      expect(result.value.quote.vehicleId).toBeNull();
      expect(result.value.quote.vehicle).toEqual({
        plate: null,
        brand: "Honda",
        model: "Civic",
        color: null,
        year: null,
      });
    }
  });

  it("should switch to an existing vehicle that belongs to the effective customer", async () => {
    const customer = makeCustomer({ establishmentId });
    const vehicle = makeCustomerVehicle({
      establishmentId,
      customerId: customer.id,
      brand: "BMW",
      model: "320i",
    });
    const quote = makeQuote({
      establishmentId,
      customerId: customer.id,
      vehicleId: null,
      vehicle: null,
      expiresAt: new Date("2026-07-02T12:00:00.000Z"),
    });
    await customersRepository.create(customer);
    await customerVehiclesRepository.create(vehicle);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor,
      quoteId: quote.id.toString(),
      vehicleId: vehicle.id.toString(),
      referenceDate,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.quote.vehicleId).toEqual(vehicle.id);
      expect(result.value.quote.vehicle?.brand).toBe("BMW");
      expect(result.value.quote.vehicle?.model).toBe("320i");
    }
  });

  it("should replace all services and recalculate existing payment options", async () => {
    const service = makeService({
      establishmentId,
      serviceName: ServiceName.create("Polimento novo"),
      price: Money.create(20000),
    });
    const quote = makeQuote({
      establishmentId,
      expiresAt: new Date("2026-07-02T12:00:00.000Z"),
      paymentOptions: [
        {
          method: "PIX",
          label: "Pix desconto",
          installments: 1,
          interestFree: true,
          discountType: "AMOUNT",
          discountValue: 5000,
        },
      ],
    });
    await servicesRepository.create(service);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor,
      quoteId: quote.id.toString(),
      serviceItems: [{ serviceId: service.id.toString(), isCourtesy: false }],
      referenceDate,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.quote.services).toHaveLength(1);
      expect(result.value.quote.services[0]?.serviceName).toBe(
        "Polimento novo",
      );
      expect(result.value.quote.subtotalInCents).toBe(20000);
      expect(result.value.quote.paymentOptions[0]?.totalInCents).toBe(15000);
    }
  });

  it("should reject isolated payment update when a current service is stale", async () => {
    const serviceId = new UniqueEntityId("stale-service");
    const service = makeService(
      {
        establishmentId,
        serviceName: ServiceName.create("Nome atual"),
      },
      serviceId,
    );
    const quote = makeQuote({
      establishmentId,
      expiresAt: new Date("2026-07-02T12:00:00.000Z"),
      services: [
        {
          serviceId,
          serviceName: "Nome antigo",
          priceInCents: service.priceSpecification.defaultChargePriceInCents,
          isCourtesy: false,
        },
      ],
    });
    await servicesRepository.create(service);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor,
      quoteId: quote.id.toString(),
      paymentOptions: [
        {
          method: "PIX",
          label: "Pix",
          installments: 1,
          interestFree: true,
          discountType: null,
          discountValue: null,
        },
      ],
      referenceDate,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });
});
