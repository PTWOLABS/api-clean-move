import { vi } from "vitest";

import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UniqueConstraintViolationError } from "../../../../shared/errors/unique-constraint-violation-error";
import { Quote } from "../../../quotes/domain/entities/quote";
import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import { CustomerDocument } from "../../../customer/domain/value-objects/customer-document";
import { ServiceName } from "../../../catalog/domain/value-objects/service-name";
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
import { QuoteCustomerResolver } from "../../services/quote-approval/quote-customer-resolver";
import {
  QuoteApprovalConflictsChangedError,
  QuoteApprovalResolutionRequiredError,
  QuoteInvalidResolutionActionError,
} from "../../services/quote-approval/quote-approval-resolution-error";
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
      new QuoteCustomerResolver(
        customersRepository,
        customerVehiclesRepository,
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
      vehicle: null,
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
    expect(result.value.appointment.vehicle).toBeNull();
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
      vehicle: null,
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

  it("should apply automatic document customer links without a decision", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: CustomerDocument.create("52998224725"),
    });
    const quote = makeQuote({
      establishmentId: establishment.id,
      customerId: null,
      vehicle: null,
      customer: {
        name: "Cliente Documento",
        phone: null,
        email: null,
        cpfCnpj: "52998224725",
        address: null,
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
    expect(result.value.quote.customerId).toEqual(customer.id);
    expect(result.value.appointment.customerId).toEqual(customer.id);
  });

  it("should apply explicit customer and service decisions", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
      phone: null,
      email: null,
    });
    const catalogService = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Cristalizacao"),
    });
    const quoteServiceId = new UniqueEntityId("quote-service-1");
    const quote = makeQuote({
      establishmentId: establishment.id,
      customerId: null,
      vehicleId: null,
      customer: {
        name: customer.fullName,
        phone: customer.phone?.toString() ?? null,
        email: null,
        cpfCnpj: null,
        address: null,
      },
      vehicle: null,
      services: [
        {
          quoteServiceId,
          serviceId: null,
          serviceName: "Cristalizacao",
          priceInCents: 42000,
          isCourtesy: false,
        },
      ],
    });

    await establishmentsRepository.create(establishment);
    await customersRepository.create(customer);
    await servicesRepository.create(catalogService);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
      customerResolution: {
        action: "LINK_EXISTING",
        customerId: customer.id.toString(),
      },
      serviceResolutions: [
        {
          quoteServiceId: quoteServiceId.toString(),
          action: "ASSOCIATE_EXISTING",
          serviceId: catalogService.id.toString(),
        },
      ],
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.quote.customerId).toEqual(customer.id);
    expect(result.value.quote.vehicleId).toBeNull();
    expect(result.value.quote.services[0]?.serviceId).toEqual(
      catalogService.id,
    );
    expect(result.value.appointment.services[0]?.priceInCents).toBe(42000);
  });

  it("should apply an explicit vehicle decision for a resolved customer", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
      plate: "ABC1D23",
    });
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
      vehicleResolution: {
        action: "LINK_EXISTING",
        vehicleId: vehicle.id.toString(),
      },
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.quote.vehicleId).toEqual(vehicle.id);
    expect(result.value.appointment.vehicleId).toEqual(vehicle.id);
  });

  it("should rename detached services without changing the appointment amount", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const conflictingService = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Higienizacao premium"),
    });
    const quoteServiceId = new UniqueEntityId("quote-service-1");
    const quote = makeQuote({
      establishmentId: establishment.id,
      customerId: customer.id,
      vehicle: null,
      services: [
        {
          quoteServiceId,
          serviceId: null,
          serviceName: "Higienizacao premium",
          priceInCents: 39000,
          isCourtesy: false,
        },
      ],
    });

    await establishmentsRepository.create(establishment);
    await customersRepository.create(customer);
    await servicesRepository.create(conflictingService);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
      serviceResolutions: [
        {
          quoteServiceId: quoteServiceId.toString(),
          action: "RENAME_DETACHED",
          serviceName: "Higienizacao premium quote",
        },
      ],
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.quote.services[0]?.serviceName).toBe(
      "Higienizacao premium quote",
    );
    expect(result.value.appointment.services[0]?.serviceName).toBe(
      "Higienizacao premium quote",
    );
    expect(result.value.appointment.services[0]?.priceInCents).toBe(39000);
  });

  it("should reject inapplicable resolution actions", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const quote = makeQuote({
      establishmentId: establishment.id,
      customerId: customer.id,
      vehicle: null,
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
      vehicleResolution: { action: "KEEP_SNAPSHOT_ONLY" },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(QuoteInvalidResolutionActionError);
  });

  it("should reject stale service decisions with refreshed analysis", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const currentCandidate = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Polimento tecnico"),
    });
    const staleCandidate = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Polimento antigo"),
    });
    const quoteServiceId = new UniqueEntityId("quote-service-1");
    const quote = makeQuote({
      establishmentId: establishment.id,
      customerId: customer.id,
      vehicle: null,
      services: [
        {
          quoteServiceId,
          serviceId: null,
          serviceName: "Polimento tecnico",
          priceInCents: 28000,
          isCourtesy: false,
        },
      ],
    });

    await establishmentsRepository.create(establishment);
    await customersRepository.create(customer);
    await servicesRepository.create(currentCandidate);
    await servicesRepository.create(staleCandidate);
    await quotesRepository.create(quote);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
      serviceResolutions: [
        {
          quoteServiceId: quoteServiceId.toString(),
          action: "ASSOCIATE_EXISTING",
          serviceId: staleCandidate.id.toString(),
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(QuoteApprovalConflictsChangedError);
    expect(result.value).toMatchObject({
      analysis: expect.objectContaining({
        services: [
          expect.objectContaining({
            candidateServiceId: currentCandidate.id.toString(),
          }),
        ],
      }),
    });
  });

  it("should translate unique customer races into refreshed conflict analysis", async () => {
    const establishment = makeEstablishment();
    const quote = makeQuote({
      establishmentId: establishment.id,
      customerId: null,
      vehicle: null,
      customer: {
        name: "Cliente Documento",
        phone: null,
        email: null,
        cpfCnpj: "52998224725",
        address: null,
      },
    });

    await establishmentsRepository.create(establishment);
    await createCatalogServicesFor(quote);
    await quotesRepository.create(quote);

    vi.spyOn(customersRepository, "create").mockImplementationOnce(async () => {
      customersRepository.items.push(
        makeCustomer({
          establishmentId: establishment.id,
          cpfCnpj: CustomerDocument.create("52998224725"),
        }),
      );
      throw new UniqueConstraintViolationError("CUSTOMER_DOCUMENT");
    });

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
      customerResolution: { action: "CREATE_NEW" },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(QuoteApprovalConflictsChangedError);
    expect(result.value).toMatchObject({
      analysis: expect.objectContaining({
        customer: expect.objectContaining({
          status: "AUTO_LINK",
        }),
      }),
    });
  });

  it("should translate unique vehicle races into refreshed conflict analysis", async () => {
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

    vi.spyOn(customerVehiclesRepository, "create").mockImplementationOnce(
      async () => {
        customerVehiclesRepository.items.push(
          makeCustomerVehicle({
            establishmentId: establishment.id,
            customerId: customer.id,
            plate: "ABC1D23",
          }),
        );
        throw new UniqueConstraintViolationError("VEHICLE_PLATE");
      },
    );

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      quoteId: quote.id.toString(),
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
      vehicleResolution: { action: "CREATE_FROM_SNAPSHOT" },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(QuoteApprovalConflictsChangedError);
    expect(result.value).toMatchObject({
      analysis: expect.objectContaining({
        vehicle: expect.objectContaining({
          status: "CANDIDATE_FOUND",
        }),
      }),
    });
  });

  it("should translate unique service races into refreshed conflict analysis", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const quote = makeQuote({
      establishmentId: establishment.id,
      customerId: customer.id,
      vehicle: null,
      services: [
        {
          quoteServiceId: new UniqueEntityId("quote-service-1"),
          serviceId: null,
          serviceName: "Polimento tecnico",
          priceInCents: 28000,
          isCourtesy: false,
        },
      ],
    });

    await establishmentsRepository.create(establishment);
    await customersRepository.create(customer);
    await quotesRepository.create(quote);

    vi.spyOn(servicesRepository, "create").mockImplementationOnce(async () => {
      servicesRepository.items.push(
        makeService({
          establishmentId: establishment.id,
          serviceName: ServiceName.create("Polimento tecnico"),
        }),
      );
      throw new UniqueConstraintViolationError("SERVICE_NAME");
    });

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
    expect(result.value).toBeInstanceOf(QuoteApprovalConflictsChangedError);
    expect(result.value).toMatchObject({
      analysis: expect.objectContaining({
        services: [
          expect.objectContaining({
            status: "CANDIDATE_FOUND",
          }),
        ],
      }),
    });
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

  it("should require a customer decision for prospect quotes", async () => {
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
    expect(result.value).toBeInstanceOf(QuoteApprovalResolutionRequiredError);
    expect(result.value).toMatchObject({
      analysis: expect.objectContaining({
        customer: expect.objectContaining({
          status: "CREATE_REQUIRED",
        }),
      }),
    });
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
      vehicle: null,
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
    expect(result.value).toBeInstanceOf(QuoteApprovalResolutionRequiredError);
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
    expect(result.value).toBeInstanceOf(QuoteApprovalResolutionRequiredError);
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
    expect(result.value).toBeInstanceOf(QuoteApprovalResolutionRequiredError);
  });

  it("should reject quotes converted concurrently", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const quote = makeQuote({
      establishmentId: establishment.id,
      customerId: customer.id,
      vehicle: null,
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
