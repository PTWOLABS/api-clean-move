import { vi } from "vitest";

import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import { CustomerDocument } from "../../../customer/domain/value-objects/customer-document";
import { Email } from "../../../accounts/domain/value-objects/email";
import { Phone } from "../../../accounts/domain/value-objects/phone";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
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
import {
  QuoteApprovalResolutionRequiredError,
  QuoteInvalidResolutionActionError,
} from "../../services/quote-approval/quote-approval-resolution-error";
import { QuoteCustomerMatcher } from "../../services/quote-approval/quote-customer-matcher";
import { QuoteCustomerResolver } from "../../services/quote-approval/quote-customer-resolver";
import { QuoteVehicleMatcher } from "../../services/quote-approval/quote-vehicle-matcher";
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
      establishmentScope,
      inMemoryUnitOfWork,
      new QuoteCustomerMatcher(customersRepository),
      new QuoteVehicleMatcher(customerVehiclesRepository),
      new QuoteCustomerResolver(
        customersRepository,
        customerVehiclesRepository,
      ),
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

  it("should automatically link an exact active document match without creating another customer", async () => {
    const establishment = makeEstablishment();
    const existingCustomer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: CustomerDocument.create("52998224725"),
    });
    const quote = makeQuote({
      establishmentId: establishment.id,
      customer: {
        name: "Robertinho Contador",
        phone: null,
        email: "robertinho@example.com",
        cpfCnpj: "52998224725",
        address: null,
      },
      vehicle: null,
    });

    await establishmentsRepository.create(establishment);
    await customersRepository.create(existingCustomer);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      email: "robertinho@example.com",
      createVehicleFromQuote: false,
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(customersRepository.items).toHaveLength(1);
    expect(result.value.customer.id).toEqual(existingCustomer.id);
    expect(result.value.quote.customerId).toEqual(existingCustomer.id);
  });

  it("should require an explicit decision for exact phone and email candidates", async () => {
    const establishment = makeEstablishment();
    const existingCustomer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
      fullName: "Cliente Existente",
      phone: Phone.create("11999999999"),
      email: new Email("robertinho@example.com"),
    });
    const quote = makeQuote({
      establishmentId: establishment.id,
      customer: {
        name: "Robertinho Contador",
        phone: "11999999999",
        email: "robertinho@example.com",
        cpfCnpj: null,
        address: null,
      },
      vehicle: null,
    });

    await establishmentsRepository.create(establishment);
    await customersRepository.create(existingCustomer);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      email: "robertinho@example.com",
      createVehicleFromQuote: false,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(QuoteApprovalResolutionRequiredError);
    if (!(result.value instanceof QuoteApprovalResolutionRequiredError)) {
      throw new Error("Expected quote approval resolution required error.");
    }
    expect(result.value.analysis.customer.status).toBe("CANDIDATES_FOUND");
    expect(result.value.analysis.customer.candidates[0]).toMatchObject({
      customerId: existingCustomer.id.toString(),
      matchedBy: ["PHONE", "EMAIL"],
    });
    expect(quote.customerId).toBeNull();
  });

  it("should link an explicit existing customer from the same establishment", async () => {
    const establishment = makeEstablishment();
    const existingCustomer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
      phone: Phone.create("11999999999"),
      email: new Email("robertinho@example.com"),
    });
    const quote = makeQuote({
      establishmentId: establishment.id,
      customer: {
        name: "Robertinho Contador",
        phone: "11999999999",
        email: "robertinho@example.com",
        cpfCnpj: null,
        address: null,
      },
      vehicle: null,
    });

    await establishmentsRepository.create(establishment);
    await customersRepository.create(existingCustomer);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      email: "robertinho@example.com",
      createVehicleFromQuote: false,
      customerResolution: {
        action: "LINK_EXISTING",
        customerId: existingCustomer.id.toString(),
      },
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(customersRepository.items).toHaveLength(1);
    expect(result.value.customer.id).toEqual(existingCustomer.id);
    expect(result.value.quote.customerId).toEqual(existingCustomer.id);
  });

  it("should allow explicit new customer creation for evidence-only matches", async () => {
    const establishment = makeEstablishment();
    const existingCustomer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
      phone: Phone.create("11999999999"),
      email: new Email("robertinho@example.com"),
    });
    const quote = makeQuote({
      establishmentId: establishment.id,
      customer: {
        name: "Robertinho Contador",
        phone: "11999999999",
        email: "robertinho@example.com",
        cpfCnpj: null,
        address: null,
      },
      vehicle: null,
    });

    await establishmentsRepository.create(establishment);
    await customersRepository.create(existingCustomer);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      email: "new-customer@example.com",
      phone: "11988888888",
      createVehicleFromQuote: false,
      customerResolution: {
        action: "CREATE_NEW",
        email: "new-customer@example.com",
        phone: "11988888888",
      },
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(customersRepository.items).toHaveLength(2);
    expect(result.value.customer.id).not.toEqual(existingCustomer.id);
    expect(result.value.customer.email).toEqual(
      new Email("new-customer@example.com"),
    );
    expect(result.value.quote.customerId).toEqual(result.value.customer.id);
  });

  it("should reject explicit vehicle links that are not owned by the resolved customer", async () => {
    const establishment = makeEstablishment();
    const selectedCustomer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
      phone: Phone.create("11999999999"),
      email: null,
    });
    const vehicleOwner = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
      phone: Phone.create("11988888888"),
      email: null,
    });
    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: vehicleOwner.id,
      plate: "ABC1D23",
    });
    const quote = makeQuote({
      establishmentId: establishment.id,
      customer: {
        name: selectedCustomer.fullName,
        phone: selectedCustomer.phone?.toString() ?? null,
        email: null,
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
    });

    await establishmentsRepository.create(establishment);
    await customersRepository.create(selectedCustomer);
    await customersRepository.create(vehicleOwner);
    await customerVehiclesRepository.create(vehicle);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      email: "selected@example.com",
      createVehicleFromQuote: false,
      customerResolution: {
        action: "LINK_EXISTING",
        customerId: selectedCustomer.id.toString(),
      },
      vehicleResolution: {
        action: "LINK_EXISTING",
        vehicleId: vehicle.id.toString(),
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(QuoteInvalidResolutionActionError);
    expect(quote.customerId).toBeNull();
    expect(quote.vehicleId).toBeNull();
  });

  it("should keep a vehicle snapshot without linking a vehicle", async () => {
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
      createVehicleFromQuote: false,
      vehicleResolution: { action: "KEEP_SNAPSHOT_ONLY" },
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.vehicle).toBeNull();
    expect(result.value.quote.vehicleId).toBeNull();
    expect(result.value.quote.vehicle?.model).toBe("HR-V");
  });

  it("should resolve two prospect quotes with the same document to one customer without changing the other quote snapshots", async () => {
    const establishment = makeEstablishment();
    const firstQuote = makeQuote({
      establishmentId: establishment.id,
      customer: {
        name: "Cliente Documento",
        phone: "11999999999",
        email: "cliente@example.com",
        cpfCnpj: "52998224725",
        address: null,
      },
      vehicle: null,
    });
    const secondQuote = makeQuote({
      establishmentId: establishment.id,
      customer: {
        name: "Cliente Documento",
        phone: "11999999999",
        email: "cliente@example.com",
        cpfCnpj: "52998224725",
        address: null,
      },
      vehicle: null,
    });
    const secondSnapshots = {
      customer: secondQuote.customer,
      vehicle: secondQuote.vehicle,
      services: secondQuote.services,
      paymentOptions: secondQuote.paymentOptions,
    };

    await establishmentsRepository.create(establishment);
    await quotesRepository.create(firstQuote);
    await quotesRepository.create(secondQuote);

    const firstResult = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: firstQuote.id.toString(),
      email: "cliente@example.com",
      createVehicleFromQuote: false,
    });

    expect(firstResult.isRight()).toBe(true);
    if (firstResult.isLeft()) throw firstResult.value;

    const secondResult = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: secondQuote.id.toString(),
      email: "cliente@example.com",
      createVehicleFromQuote: false,
    });

    expect(secondResult.isRight()).toBe(true);
    if (secondResult.isLeft()) throw secondResult.value;
    expect(secondResult.value.customer.id).toEqual(
      firstResult.value.customer.id,
    );
    expect(firstResult.value.quote.customerId).toEqual(
      firstResult.value.customer.id,
    );
    expect(secondResult.value.quote.customerId).toEqual(
      firstResult.value.customer.id,
    );
    expect(secondQuote.customer).toEqual(secondSnapshots.customer);
    expect(secondQuote.vehicle).toEqual(secondSnapshots.vehicle);
    expect(secondQuote.services).toEqual(secondSnapshots.services);
    expect(secondQuote.paymentOptions).toEqual(secondSnapshots.paymentOptions);
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

  it("should link existing customers instead of rejecting document matches", async () => {
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

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(customersRepository.items).toHaveLength(1);
    expect(result.value.customer.id).toEqual(customer.id);
    expect(result.value.quote.customerId).toEqual(customer.id);
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
