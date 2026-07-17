import { vi } from "vitest";

import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { Quote } from "../../../quotes/domain/entities/quote";
import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeQuote } from "../../../../../tests/factories/quote-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { InMemoryAppointmentsRepository } from "../../../../../tests/repositories/in-memory-appointments-repository";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryQuotesRepository } from "../../../../../tests/repositories/in-memory-quotes-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { InMemoryUnitOfWork } from "../../../../../tests/repositories/in-memory-unit-of-work";
import { EstablishmentScopeService } from "../../services/establishment-scope";
import { QuoteApprovalAnalyzer } from "../../services/quote-approval/quote-approval-analyzer";
import { QuoteCustomerMatcher } from "../../services/quote-approval/quote-customer-matcher";
import { QuoteServiceMatcher } from "../../services/quote-approval/quote-service-matcher";
import { QuoteServiceResolver } from "../../services/quote-approval/quote-service-resolver";
import { QuoteToAppointmentConverter } from "../../services/quote-approval/quote-to-appointment-converter";
import { QuoteVehicleMatcher } from "../../services/quote-approval/quote-vehicle-matcher";
import { ApproveQuoteUseCase } from "./approve-quote";

let quotesRepository: InMemoryQuotesRepository;
let appointmentsRepository: InMemoryAppointmentsRepository;
let customersRepository: InMemoryCustomersRepository;
let customerVehiclesRepository: InMemoryCustomerVehiclesRepository;
let employeesRepository: InMemoryEmployeesRepository;
let establishmentsRepository: InMemoryEstablishmentsRepository;
let servicesRepository: InMemoryServicesRepository;
let establishmentScope: EstablishmentScopeService;
let inMemoryUnitOfWork: InMemoryUnitOfWork;
let sut: ApproveQuoteUseCase;

async function createCatalogServicesFor(quote: Quote) {
  for (const quoteService of quote.services) {
    if (!quoteService.serviceId) continue;

    await servicesRepository.create(
      makeService(
        {
          establishmentId: quote.establishmentId,
        },
        quoteService.serviceId,
      ),
    );
  }
}

describe("Approve quote", () => {
  beforeEach(() => {
    quotesRepository = new InMemoryQuotesRepository();
    customersRepository = new InMemoryCustomersRepository();
    customerVehiclesRepository = new InMemoryCustomerVehiclesRepository();
    appointmentsRepository = new InMemoryAppointmentsRepository(
      customersRepository,
    );
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

    sut = new ApproveQuoteUseCase(
      quotesRepository,
      establishmentScope,
      inMemoryUnitOfWork,
      new QuoteApprovalAnalyzer(
        new QuoteCustomerMatcher(customersRepository),
        new QuoteVehicleMatcher(customerVehiclesRepository),
        new QuoteServiceMatcher(servicesRepository),
      ),
      new QuoteServiceResolver(servicesRepository),
      new QuoteToAppointmentConverter(
        appointmentsRepository,
        customersRepository,
        customerVehiclesRepository,
      ),
    );
  });

  it("should approve a customer quote and create an appointment", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const quote = makeQuote({
      establishmentId: establishment.id,
      customerId: customer.id,
      vehicleId: null,
      vehicle: {
        plate: "ABC1D23",
        brand: "Honda",
        model: "HR-V",
        color: "Branco",
        year: 2025,
      },
    });

    await establishmentsRepository.create(establishment);
    await customersRepository.create(customer);
    await createCatalogServicesFor(quote);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(appointmentsRepository.items).toHaveLength(1);
    expect(result.value.appointment.customerId).toEqual(customer.id);
    expect(result.value.appointment.vehicle?.model).toBe("HR-V");
    expect(result.value.quote.convertedAppointmentId).toEqual(
      result.value.appointment.id,
    );
  });

  it("should create detached quote services in the catalog when approving", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const quote = makeQuote({
      establishmentId: establishment.id,
      customerId: customer.id,
      services: [
        {
          serviceName: "Polimento tecnico",
          priceInCents: 45000,
          isCourtesy: false,
        },
      ],
    });

    await establishmentsRepository.create(establishment);
    await customersRepository.create(customer);
    await createCatalogServicesFor(quote);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(servicesRepository.items).toHaveLength(1);
    expect(servicesRepository.items[0]?.serviceName.value).toBe(
      "Polimento tecnico",
    );
    expect(servicesRepository.items[0]?.price.amountInCents).toBe(45000);
    expect(result.value.appointment.services[0]?.serviceId).toEqual(
      servicesRepository.items[0]?.id,
    );
  });

  it("should preserve the quote vehicle snapshot when a linked vehicle changed", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
      model: "Corolla",
    });
    const quote = makeQuote({
      establishmentId: establishment.id,
      customerId: customer.id,
      vehicleId: vehicle.id,
      vehicle: {
        plate: "ABC1D23",
        brand: "Honda",
        model: "HR-V",
        color: "Branco",
        year: 2025,
      },
    });

    await establishmentsRepository.create(establishment);
    await customersRepository.create(customer);
    await customerVehiclesRepository.create(vehicle);
    await createCatalogServicesFor(quote);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.appointment.vehicle?.model).toBe("HR-V");
  });

  it("should reject prospect quotes", async () => {
    const establishment = makeEstablishment();
    const quote = makeQuote({
      establishmentId: establishment.id,
      customerId: null,
    });

    await establishmentsRepository.create(establishment);
    await createCatalogServicesFor(quote);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should reject already converted quotes", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const quote = makeQuote({
      establishmentId: establishment.id,
      customerId: customer.id,
      convertedAppointmentId: new UniqueEntityId("appointment-1"),
      convertedAt: new Date("2026-05-22T10:00:00.000Z"),
    });

    await establishmentsRepository.create(establishment);
    await customersRepository.create(customer);
    await createCatalogServicesFor(quote);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should reject deleted customers", async () => {
    const referenceDate = new Date("2026-05-22T10:00:00.000Z");
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const quote = makeQuote({
      establishmentId: establishment.id,
      customerId: customer.id,
    });
    customer.softDelete(referenceDate);

    await establishmentsRepository.create(establishment);
    await customersRepository.create(customer);
    await createCatalogServicesFor(quote);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject missing linked vehicles", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const quote = makeQuote({
      establishmentId: establishment.id,
      customerId: customer.id,
      vehicleId: new UniqueEntityId("vehicle-1"),
    });

    await establishmentsRepository.create(establishment);
    await customersRepository.create(customer);
    await createCatalogServicesFor(quote);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject deleted linked vehicles", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
    });
    const quote = makeQuote({
      establishmentId: establishment.id,
      customerId: customer.id,
      vehicleId: vehicle.id,
    });
    vehicle.softDelete(new Date("2026-05-22T10:00:00.000Z"));

    await establishmentsRepository.create(establishment);
    await customersRepository.create(customer);
    await customerVehiclesRepository.create(vehicle);
    await createCatalogServicesFor(quote);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject quotes converted concurrently", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const quote = makeQuote({
      establishmentId: establishment.id,
      customerId: customer.id,
    });
    vi.spyOn(quotesRepository, "markAsConverted").mockResolvedValueOnce(false);

    await establishmentsRepository.create(establishment);
    await customersRepository.create(customer);
    await createCatalogServicesFor(quote);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should use UnitOfWork", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
    });
    const quote = makeQuote({
      establishmentId: establishment.id,
      customerId: customer.id,
      vehicleId: vehicle.id,
    });
    const executeSpy = vi.spyOn(inMemoryUnitOfWork, "execute");

    await establishmentsRepository.create(establishment);
    await customersRepository.create(customer);
    await customerVehiclesRepository.create(vehicle);
    await createCatalogServicesFor(quote);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(result.isRight()).toBe(true);
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });
});
