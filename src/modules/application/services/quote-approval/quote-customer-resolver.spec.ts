import { Email } from "../../../accounts/domain/value-objects/email";
import { Phone } from "../../../accounts/domain/value-objects/phone";
import { CustomerDocument } from "../../../customer/domain/value-objects/customer-document";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { makeQuote } from "../../../../../tests/factories/quote-factory";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import {
  QuoteApprovalAnalysis,
  QuoteCustomerAnalysis,
  QuoteVehicleAnalysis,
} from "./quote-approval-analysis";
import {
  QuoteApprovalResolutionRequiredError,
  QuoteInvalidResolutionActionError,
} from "./quote-approval-resolution-error";
import { QuoteCustomerResolver } from "./quote-customer-resolver";

let customersRepository: InMemoryCustomersRepository;
let customerVehiclesRepository: InMemoryCustomerVehiclesRepository;
let sut: QuoteCustomerResolver;

describe("Quote customer resolver", () => {
  beforeEach(() => {
    customersRepository = new InMemoryCustomersRepository();
    customerVehiclesRepository = new InMemoryCustomerVehiclesRepository();
    sut = new QuoteCustomerResolver(
      customersRepository,
      customerVehiclesRepository,
    );
  });

  it("should apply automatic document links without an explicit customer action", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const existingCustomer = makeCustomer({
      establishmentId,
      cpfCnpj: CustomerDocument.create("52998224725"),
    });
    const quote = makeQuote({
      establishmentId,
      customerId: null,
      vehicle: null,
      customer: {
        name: "Cliente Snapshot",
        phone: null,
        email: null,
        cpfCnpj: "52998224725",
        address: null,
      },
    });
    const originalCustomerSnapshot = quote.customer;

    await customersRepository.create(existingCustomer);

    const result = await sut.resolve({
      quote,
      establishmentId,
      analysis: analysis({
        customer: customerAnalysis({
          status: "AUTO_LINK",
          automaticCustomerId: existingCustomer.id.toString(),
        }),
        vehicle: vehicleAnalysis({
          status: "NONE",
          requiresResolution: false,
          allowedActions: [],
        }),
      }),
    });

    expect(result.customer.id).toEqual(existingCustomer.id);
    expect(result.vehicle).toBeNull();
    expect(quote.customer).toEqual(originalCustomerSnapshot);
    expect(quote.customerId).toEqual(existingCustomer.id);
    expect(quote.vehicleId).toBeNull();
  });

  it("should link an explicit active customer from the same establishment", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const existingCustomer = makeCustomer({ establishmentId });
    const quote = makeQuote({ establishmentId, customerId: null });
    const originalCustomerSnapshot = quote.customer;
    const originalVehicleSnapshot = quote.vehicle;

    await customersRepository.create(existingCustomer);

    const result = await sut.resolve({
      quote,
      establishmentId,
      analysis: analysis({
        customer: customerAnalysis({
          status: "CANDIDATES_FOUND",
          requiresResolution: true,
        }),
      }),
      customerResolution: {
        action: "LINK_EXISTING",
        customerId: existingCustomer.id.toString(),
      },
      vehicleResolution: { action: "KEEP_SNAPSHOT_ONLY" },
    });

    expect(result.customer.id).toEqual(existingCustomer.id);
    expect(quote.customer).toEqual(originalCustomerSnapshot);
    expect(quote.vehicle).toEqual(originalVehicleSnapshot);
    expect(quote.customerId).toEqual(existingCustomer.id);
    expect(quote.vehicleId).toBeNull();
  });

  it("should reject explicit customers from another establishment", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const otherEstablishmentId = new UniqueEntityId("establishment-2");
    const otherCustomer = makeCustomer({
      establishmentId: otherEstablishmentId,
    });
    const quote = makeQuote({ establishmentId, customerId: null });

    await customersRepository.create(otherCustomer);

    await expect(
      sut.resolve({
        quote,
        establishmentId,
        analysis: analysis({
          customer: customerAnalysis({
            status: "CANDIDATES_FOUND",
            requiresResolution: true,
          }),
        }),
        customerResolution: {
          action: "LINK_EXISTING",
          customerId: otherCustomer.id.toString(),
        },
        vehicleResolution: { action: "KEEP_SNAPSHOT_ONLY" },
      }),
    ).rejects.toBeInstanceOf(QuoteInvalidResolutionActionError);
    expect(quote.customerId).toBeNull();
  });

  it("should create a customer without replacing quote snapshots", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const quote = makeQuote({
      establishmentId,
      customerId: null,
      customer: {
        name: "Cliente Snapshot",
        phone: "11988887777",
        email: "snapshot@example.com",
        cpfCnpj: null,
        address: {
          street: "Rua Um",
          country: "BR",
          state: "SP",
          zipCode: "01001000",
          city: "Sao Paulo",
          complement: "Sala 1",
        },
      },
    });
    const originalCustomerSnapshot = quote.customer;
    const originalVehicleSnapshot = quote.vehicle;

    const result = await sut.resolve({
      quote,
      establishmentId,
      analysis: analysis({
        customer: customerAnalysis({
          status: "CREATE_REQUIRED",
          requiresResolution: true,
        }),
      }),
      customerResolution: {
        action: "CREATE_NEW",
        phone: "11999998888",
      },
      vehicleResolution: { action: "KEEP_SNAPSHOT_ONLY" },
    });

    expect(customersRepository.items).toContain(result.customer);
    expect(result.customer.fullName).toBe("Cliente Snapshot");
    expect(result.customer.email).toEqual(new Email("snapshot@example.com"));
    expect(result.customer.phone).toEqual(Phone.create("11999998888"));
    expect(quote.customer).toEqual(originalCustomerSnapshot);
    expect(quote.vehicle).toEqual(originalVehicleSnapshot);
    expect(quote.customerId).toEqual(result.customer.id);
    expect(quote.vehicleId).toBeNull();
  });

  it("should create a customer with only the quote customer name", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const quote = makeQuote({
      establishmentId,
      customerId: null,
      customer: {
        name: "Cliente Sem Contato",
        phone: null,
        email: null,
        cpfCnpj: null,
        address: null,
      },
    });

    const result = await sut.resolve({
      quote,
      establishmentId,
      analysis: analysis({
        customer: customerAnalysis({
          status: "CREATE_REQUIRED",
          requiresResolution: true,
        }),
      }),
      customerResolution: { action: "CREATE_NEW" },
      vehicleResolution: { action: "KEEP_SNAPSHOT_ONLY" },
    });

    expect(result.customer.fullName).toBe("Cliente Sem Contato");
    expect(result.customer.email).toBeNull();
    expect(result.customer.phone).toBeNull();
    expect(result.customer.cpfCnpj).toBeNull();
  });

  it("should reject customer creation when an exact document conflict exists", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const existingCustomer = makeCustomer({
      establishmentId,
      cpfCnpj: CustomerDocument.create("52998224725"),
    });
    const quote = makeQuote({
      establishmentId,
      customerId: null,
      customer: {
        name: "Cliente Snapshot",
        phone: null,
        email: null,
        cpfCnpj: "52998224725",
        address: null,
      },
    });

    await customersRepository.create(existingCustomer);

    await expect(
      sut.resolve({
        quote,
        establishmentId,
        analysis: analysis({
          customer: customerAnalysis({
            status: "CREATE_REQUIRED",
            requiresResolution: true,
          }),
        }),
        customerResolution: {
          action: "CREATE_NEW",
        },
        vehicleResolution: { action: "KEEP_SNAPSHOT_ONLY" },
      }),
    ).rejects.toBeInstanceOf(QuoteInvalidResolutionActionError);
    expect(customersRepository.items).toHaveLength(1);
  });

  it("should link an existing vehicle only when owned by the resolved customer", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({ establishmentId });
    const vehicle = makeCustomerVehicle({
      establishmentId,
      customerId: customer.id,
      plate: "ABC1D23",
    });
    const quote = makeQuote({
      establishmentId,
      customerId: null,
      vehicleId: null,
      vehicle: {
        plate: "ABC1D23",
        brand: "Honda",
        model: "HR-V",
        color: "Branco",
        year: 2025,
      },
    });
    const originalVehicleSnapshot = quote.vehicle;

    await customersRepository.create(customer);
    await customerVehiclesRepository.create(vehicle);

    const result = await sut.resolve({
      quote,
      establishmentId,
      analysis: analysis({
        customer: customerAnalysis({
          status: "CANDIDATES_FOUND",
          requiresResolution: true,
        }),
        vehicle: vehicleAnalysis({
          status: "CANDIDATE_FOUND",
          requiresResolution: true,
          candidateVehicleId: vehicle.id.toString(),
          candidateCustomerId: customer.id.toString(),
          allowedActions: ["LINK_EXISTING", "KEEP_SNAPSHOT_ONLY"],
        }),
      }),
      customerResolution: {
        action: "LINK_EXISTING",
        customerId: customer.id.toString(),
      },
      vehicleResolution: {
        action: "LINK_EXISTING",
        vehicleId: vehicle.id.toString(),
      },
    });

    expect(result.vehicle?.id).toEqual(vehicle.id);
    expect(quote.vehicle).toEqual(originalVehicleSnapshot);
    expect(quote.vehicleId).toEqual(vehicle.id);
  });

  it("should create a vehicle from a complete snapshot", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({ establishmentId });
    const quote = makeQuote({
      establishmentId,
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

    await customersRepository.create(customer);

    const result = await sut.resolve({
      quote,
      establishmentId,
      analysis: analysis({
        customer: customerAnalysis({
          status: "RESOLVED",
          automaticCustomerId: customer.id.toString(),
        }),
        vehicle: vehicleAnalysis({
          status: "SNAPSHOT_ONLY",
          requiresResolution: true,
          allowedActions: ["CREATE_FROM_SNAPSHOT", "KEEP_SNAPSHOT_ONLY"],
        }),
      }),
      vehicleResolution: { action: "CREATE_FROM_SNAPSHOT" },
    });

    expect(result.vehicle).not.toBeNull();
    expect(customerVehiclesRepository.items).toContain(result.vehicle);
    expect(result.vehicle?.customerId).toEqual(customer.id);
    expect(result.vehicle?.model).toBe("HR-V");
    expect(quote.vehicleId).toEqual(result.vehicle?.id);
  });

  it("should edit the vehicle snapshot plate before creating a vehicle", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({ establishmentId });
    const quote = makeQuote({
      establishmentId,
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

    await customersRepository.create(customer);

    const result = await sut.resolve({
      quote,
      establishmentId,
      analysis: analysis({
        customer: customerAnalysis({
          status: "RESOLVED",
          automaticCustomerId: customer.id.toString(),
        }),
        vehicle: vehicleAnalysis({
          status: "OWNERSHIP_CONFLICT",
          requiresResolution: true,
          allowedActions: ["EDIT_SNAPSHOT_PLATE", "KEEP_SNAPSHOT_ONLY"],
        }),
      }),
      vehicleResolution: {
        action: "EDIT_SNAPSHOT_PLATE",
        plate: "DEF-4G56",
      },
    });

    expect(result.vehicle).not.toBeNull();
    expect(result.vehicle?.plate).toBe("DEF4G56");
    expect(quote.vehicle?.plate).toBe("DEF4G56");
    expect(quote.vehicleId).toEqual(result.vehicle?.id);
  });

  it("should keep the vehicle snapshot only", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({ establishmentId });
    const quote = makeQuote({
      establishmentId,
      customerId: customer.id,
      vehicleId: new UniqueEntityId("old-vehicle"),
    });
    const originalVehicleSnapshot = quote.vehicle;

    await customersRepository.create(customer);

    const result = await sut.resolve({
      quote,
      establishmentId,
      analysis: analysis({
        customer: customerAnalysis({
          status: "RESOLVED",
          automaticCustomerId: customer.id.toString(),
        }),
        vehicle: vehicleAnalysis({
          status: "LINKED_RESOURCE_DELETED",
          requiresResolution: true,
          allowedActions: ["CREATE_FROM_SNAPSHOT", "KEEP_SNAPSHOT_ONLY"],
        }),
      }),
      vehicleResolution: { action: "KEEP_SNAPSHOT_ONLY" },
    });

    expect(result.vehicle).toBeNull();
    expect(quote.vehicle).toEqual(originalVehicleSnapshot);
    expect(quote.vehicleId).toBeNull();
  });

  it("should require a replacement action for deleted linked customers", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const quote = makeQuote({
      establishmentId,
      customerId: new UniqueEntityId("deleted-customer"),
    });

    await expect(
      sut.resolve({
        quote,
        establishmentId,
        analysis: analysis({
          customer: customerAnalysis({
            status: "LINKED_RESOURCE_DELETED",
            requiresResolution: true,
          }),
        }),
        vehicleResolution: { action: "KEEP_SNAPSHOT_ONLY" },
      }),
    ).rejects.toBeInstanceOf(QuoteApprovalResolutionRequiredError);
  });

  it("should require a replacement action for deleted linked vehicles", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({ establishmentId });
    const quote = makeQuote({
      establishmentId,
      customerId: customer.id,
      vehicleId: new UniqueEntityId("deleted-vehicle"),
    });

    await customersRepository.create(customer);

    await expect(
      sut.resolve({
        quote,
        establishmentId,
        analysis: analysis({
          customer: customerAnalysis({
            status: "RESOLVED",
            automaticCustomerId: customer.id.toString(),
          }),
          vehicle: vehicleAnalysis({
            status: "LINKED_RESOURCE_DELETED",
            requiresResolution: true,
            allowedActions: ["CREATE_FROM_SNAPSHOT", "KEEP_SNAPSHOT_ONLY"],
          }),
        }),
      }),
    ).rejects.toBeInstanceOf(QuoteApprovalResolutionRequiredError);
  });

  it("should reject incomplete vehicle snapshots during creation", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({ establishmentId });
    const quote = makeQuote({
      establishmentId,
      customerId: customer.id,
      vehicle: {
        plate: "ABC1D23",
        brand: null,
        model: "HR-V",
        color: "Branco",
        year: 2025,
      },
    });

    await customersRepository.create(customer);

    await expect(
      sut.resolve({
        quote,
        establishmentId,
        analysis: analysis({
          customer: customerAnalysis({
            status: "RESOLVED",
            automaticCustomerId: customer.id.toString(),
          }),
          vehicle: vehicleAnalysis({
            status: "SNAPSHOT_ONLY",
            requiresResolution: true,
            allowedActions: ["CREATE_FROM_SNAPSHOT", "KEEP_SNAPSHOT_ONLY"],
          }),
        }),
        vehicleResolution: { action: "CREATE_FROM_SNAPSHOT" },
      }),
    ).rejects.toMatchObject({
      code: "QUOTE_VEHICLE_SNAPSHOT_INCOMPLETE",
    } satisfies Partial<InvalidQuoteInputError>);
  });
});

function analysis(override?: {
  customer?: QuoteCustomerAnalysis;
  vehicle?: QuoteVehicleAnalysis;
}): QuoteApprovalAnalysis {
  return {
    status: "READY",
    automaticResolutions: [],
    customer: override?.customer ?? customerAnalysis(),
    vehicle: override?.vehicle ?? vehicleAnalysis(),
    services: [],
  };
}

function customerAnalysis(
  override?: Partial<QuoteCustomerAnalysis>,
): QuoteCustomerAnalysis {
  return {
    status: "RESOLVED",
    requiresResolution: false,
    automaticCustomerId: null,
    candidates: [],
    ...override,
  };
}

function vehicleAnalysis(
  override?: Partial<QuoteVehicleAnalysis>,
): QuoteVehicleAnalysis {
  return {
    status: "SNAPSHOT_ONLY",
    requiresResolution: true,
    candidateVehicleId: null,
    candidateCustomerId: null,
    allowedActions: ["CREATE_FROM_SNAPSHOT", "KEEP_SNAPSHOT_ONLY"],
    ...override,
  };
}
