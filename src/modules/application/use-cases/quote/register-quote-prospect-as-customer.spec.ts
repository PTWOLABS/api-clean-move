import { vi } from "vitest";

import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeQuote } from "../../../../../tests/factories/quote-factory";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryQuotesRepository } from "../../../../../tests/repositories/in-memory-quotes-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { InMemoryUnitOfWork } from "../../../../../tests/repositories/in-memory-unit-of-work";
import { EstablishmentScopeService } from "../../services/establishment-scope";
import { RegisterQuoteProspectAsCustomerUseCase } from "./register-quote-prospect-as-customer";

let quotesRepository: InMemoryQuotesRepository;
let customersRepository: InMemoryCustomersRepository;
let customerVehiclesRepository: InMemoryCustomerVehiclesRepository;
let employeesRepository: InMemoryEmployeesRepository;
let establishmentsRepository: InMemoryEstablishmentsRepository;
let servicesRepository: InMemoryServicesRepository;
let establishmentScope: EstablishmentScopeService;
let inMemoryUnitOfWork: InMemoryUnitOfWork;
let sut: RegisterQuoteProspectAsCustomerUseCase;

describe("Register quote prospect as customer", () => {
  beforeEach(() => {
    quotesRepository = new InMemoryQuotesRepository();
    customersRepository = new InMemoryCustomersRepository();
    customerVehiclesRepository = new InMemoryCustomerVehiclesRepository();
    employeesRepository = new InMemoryEmployeesRepository();
    servicesRepository = new InMemoryServicesRepository();
    establishmentsRepository = new InMemoryEstablishmentsRepository(
      servicesRepository,
    );
    establishmentScope = new EstablishmentScopeService(
      establishmentsRepository,
      employeesRepository,
    );
    inMemoryUnitOfWork = new InMemoryUnitOfWork();

    sut = new RegisterQuoteProspectAsCustomerUseCase(
      quotesRepository,
      customersRepository,
      customerVehiclesRepository,
      establishmentScope,
      inMemoryUnitOfWork,
    );
  });

  it("should register a prospect quote as customer without creating a vehicle", async () => {
    const establishment = makeEstablishment();
    const quote = makeQuote({
      establishmentId: establishment.id,
      vehicle: {
        plate: "ABC1D23",
        brand: "Honda",
        model: "HR-V",
        color: "Branco",
        year: 2025,
      },
    });

    await establishmentsRepository.create(establishment);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      email: "robertinho@example.com",
      phone: "11999999999",
      createVehicleFromQuote: false,
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(customersRepository.items).toHaveLength(1);
    expect(customerVehiclesRepository.items).toHaveLength(0);
    expect(result.value.quote.customerId).toEqual(result.value.customer.id);
    expect(result.value.quote.vehicleId).toBeNull();
  });

  it("should register a prospect quote as customer and create vehicle when requested", async () => {
    const establishment = makeEstablishment();
    const quote = makeQuote({
      establishmentId: establishment.id,
      vehicle: {
        plate: "ABC1D23",
        brand: "Honda",
        model: "HR-V",
        color: "Branco",
        year: 2025,
      },
    });

    await establishmentsRepository.create(establishment);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      email: "robertinho@example.com",
      phone: "11999999999",
      createVehicleFromQuote: true,
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(customerVehiclesRepository.items).toHaveLength(1);
    expect(result.value.vehicle?.customerId).toEqual(result.value.customer.id);
    expect(result.value.quote.vehicleId).toEqual(result.value.vehicle?.id);
  });

  it("should reject quotes that already have customerId", async () => {
    const establishment = makeEstablishment();
    const quote = makeQuote({
      establishmentId: establishment.id,
      customerId: new UniqueEntityId("customer-1"),
    });

    await establishmentsRepository.create(establishment);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      email: "robertinho@example.com",
      phone: "11999999999",
      createVehicleFromQuote: false,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
    expect(result.value).toMatchObject({ code: "QUOTE_ALREADY_HAS_CUSTOMER" });
  });

  it("should reject createVehicleFromQuote when quote has no vehicle snapshot", async () => {
    const establishment = makeEstablishment();
    const quote = makeQuote({
      establishmentId: establishment.id,
      vehicle: null,
    });

    await establishmentsRepository.create(establishment);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      email: "robertinho@example.com",
      phone: "11999999999",
      createVehicleFromQuote: true,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
    expect(result.value).toMatchObject({
      code: "QUOTE_VEHICLE_SNAPSHOT_MISSING",
    });
  });

  it("should reject customer document conflicts", async () => {
    const establishment = makeEstablishment();
    const quote = makeQuote({
      establishmentId: establishment.id,
      customer: {
        name: "Robertinho Contador",
        phone: null,
        email: null,
        cpfCnpj: "52998224725",
        address: null,
      },
    });
    const customer = makeCustomer({ establishmentId: establishment.id });

    await establishmentsRepository.create(establishment);
    await quotesRepository.create(quote);
    await customersRepository.create(customer);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      email: "robertinho@example.com",
      phone: "11999999999",
      createVehicleFromQuote: false,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceAlreadyExistsError);
    expect(result.value).toMatchObject({ resource: "customer" });
  });

  it("should use UnitOfWork when creating customer and vehicle", async () => {
    const establishment = makeEstablishment();
    const quote = makeQuote({
      establishmentId: establishment.id,
      vehicle: {
        plate: "ABC1D23",
        brand: "Honda",
        model: "HR-V",
        color: "Branco",
        year: 2025,
      },
    });
    const executeSpy = vi.spyOn(inMemoryUnitOfWork, "execute");

    await establishmentsRepository.create(establishment);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      email: "robertinho@example.com",
      phone: "11999999999",
      createVehicleFromQuote: true,
    });

    expect(result.isRight()).toBe(true);
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });
});
