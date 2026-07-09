import { Address } from "../../../accounts/domain/value-objects/address";
import { InactiveServiceError } from "../../../catalog/domain/errors/inactive-service-error";
import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryQuotesRepository } from "../../../../../tests/repositories/in-memory-quotes-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { InMemoryUsersRepository } from "../../../../../tests/repositories/in-memory-users-repository";
import { ServicePriceSpecification } from "../../../catalog/domain/value-objects/service-price-specification";
import { EstablishmentScopeService } from "../../services/establishment-scope";
import {
  CreateQuoteUseCase,
  type CreateQuoteUseCaseRequest,
} from "./create-quote";

let quotesRepository: InMemoryQuotesRepository;
let customersRepository: InMemoryCustomersRepository;
let customerVehiclesRepository: InMemoryCustomerVehiclesRepository;
let employeesRepository: InMemoryEmployeesRepository;
let establishmentsRepository: InMemoryEstablishmentsRepository;
let servicesRepository: InMemoryServicesRepository;
let usersRepository: InMemoryUsersRepository;
let establishmentScope: EstablishmentScopeService;
let sut: CreateQuoteUseCase;

type CreateQuoteRequestOverride = Partial<
  Omit<CreateQuoteUseCaseRequest, "customer">
> & {
  customer?: CreateQuoteUseCaseRequest["customer"] | undefined;
};

describe("Create quote", () => {
  beforeEach(() => {
    quotesRepository = new InMemoryQuotesRepository();
    customersRepository = new InMemoryCustomersRepository();
    customerVehiclesRepository = new InMemoryCustomerVehiclesRepository();
    servicesRepository = new InMemoryServicesRepository();
    employeesRepository = new InMemoryEmployeesRepository();
    establishmentsRepository = new InMemoryEstablishmentsRepository(
      servicesRepository,
    );
    usersRepository = new InMemoryUsersRepository();
    establishmentScope = new EstablishmentScopeService(
      establishmentsRepository,
      employeesRepository,
    );

    sut = new CreateQuoteUseCase(
      quotesRepository,
      customersRepository,
      customerVehiclesRepository,
      establishmentScope,
      servicesRepository,
      usersRepository,
    );
  });

  async function makeQuoteContext() {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const service = makeService({ establishmentId: establishment.id });

    await usersRepository.create(owner);
    await establishmentsRepository.create(establishment);
    await servicesRepository.create(service);

    return { owner, establishment, service };
  }

  function makeCreateQuoteRequest(
    context: Awaited<ReturnType<typeof makeQuoteContext>>,
    override: CreateQuoteRequestOverride = {},
  ): CreateQuoteUseCaseRequest {
    const { customer, ...restOverride } = override;
    const request: CreateQuoteUseCaseRequest = {
      actor: {
        userId: context.owner.id.toString(),
        role: "ESTABLISHMENT",
      },
      customer: { name: "Cliente Orcamento" },
      serviceItems: [{ serviceId: context.service.id.toString() }],
      paymentOptions: [{ method: "PIX", label: "Pix" }],
      ...restOverride,
    };

    if ("customer" in override) {
      if (customer === undefined) {
        delete request.customer;
      } else {
        request.customer = customer;
      }
    }

    return request;
  }

  it("should create a quote for a prospect without creating customer or vehicle records", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const service = makeService({ establishmentId: establishment.id });

    await usersRepository.create(owner);
    await establishmentsRepository.create(establishment);
    await servicesRepository.create(service);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      customer: { name: "Robertinho Contador" },
      vehicle: {
        brand: "Honda",
        model: "HR-V",
        year: 2025,
        color: "Branco",
      },
      serviceItems: [{ serviceId: service.id.toString() }],
      paymentOptions: [
        {
          method: "PIX",
          label: "A vista no Pix",
          installments: 1,
          interestFree: true,
          discountType: "PERCENTAGE",
          discountValue: 10,
        },
      ],
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(quotesRepository.items).toHaveLength(1);
    expect(customersRepository.items).toHaveLength(0);
    expect(customerVehiclesRepository.items).toHaveLength(0);
    expect(result.value.quote.customer.name).toBe("Robertinho Contador");
    expect(result.value.quote.vehicle?.model).toBe("HR-V");
  });

  it("should create a quote for an existing customer and vehicle", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const customer = makeCustomer({ establishmentId: establishment.id });
    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
      model: "Corolla",
    });
    const service = makeService({ establishmentId: establishment.id });

    await usersRepository.create(owner);
    await establishmentsRepository.create(establishment);
    await customersRepository.create(customer);
    await customerVehiclesRepository.create(vehicle);
    await servicesRepository.create(service);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      customerId: customer.id.toString(),
      vehicleId: vehicle.id.toString(),
      serviceItems: [{ serviceId: service.id.toString(), isCourtesy: true }],
      paymentOptions: [
        {
          method: "CARD",
          label: "Cartao em ate 10x sem juros",
          installments: 10,
          interestFree: true,
          discountType: null,
          discountValue: null,
        },
      ],
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.quote.customerId).toEqual(customer.id);
    expect(result.value.quote.vehicleId).toEqual(vehicle.id);
    expect(result.value.quote.customer.name).toBe(customer.fullName);
    expect(result.value.quote.services[0]?.category).toBe(service.category);
    expect(result.value.quote.services[0]?.durationInMinutes).toBe(
      service.estimatedDuration?.upperBoundInMinutes,
    );
    expect(result.value.quote.services[0]?.priceInCents).toBe(
      service.price.amountInCents,
    );
    expect(result.value.quote.services[0]?.isCourtesy).toBe(true);
  });

  it("should snapshot the service default charge price", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const service = makeService({
      establishmentId: establishment.id,
      priceSpecification: ServicePriceSpecification.create({
        type: "RANGE",
        minPriceInCents: 30000,
        maxPriceInCents: 60000,
      }),
    });

    await usersRepository.create(owner);
    await establishmentsRepository.create(establishment);
    await servicesRepository.create(service);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      customer: {
        name: "Cliente Orcamento",
      },
      serviceItems: [{ serviceId: service.id.toString() }],
      paymentOptions: [
        {
          method: "PIX",
          label: "Pix",
        },
      ],
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.quote.services[0]?.priceInCents).toBe(30000);
    }
  });

  it("should create a quote with explicit service charged price", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const service = makeService({
      establishmentId: establishment.id,
      priceSpecification: ServicePriceSpecification.create({
        type: "RANGE",
        minPriceInCents: 30000,
        maxPriceInCents: 60000,
      }),
    });

    await usersRepository.create(owner);
    await establishmentsRepository.create(establishment);
    await servicesRepository.create(service);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      customer: {
        name: "Cliente Orcamento",
      },
      serviceItems: [
        {
          serviceId: service.id.toString(),
          priceInCents: 45000,
        },
      ],
      paymentOptions: [
        {
          method: "PIX",
          label: "Pix",
        },
      ],
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.quote.services[0]?.priceInCents).toBe(45000);
      expect(result.value.quote.subtotalInCents).toBe(45000);
    }
  });

  it("should create a quote with detached service snapshot", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });

    await usersRepository.create(owner);
    await establishmentsRepository.create(establishment);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      customer: {
        name: "Cliente Orcamento",
      },
      serviceItems: [
        {
          serviceName: "Polimento tecnico",
          priceInCents: 45000,
        },
      ],
      paymentOptions: [
        {
          method: "PIX",
          label: "Pix",
        },
      ],
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.quote.services[0]?.serviceId).toBeNull();
      expect(result.value.quote.services[0]?.serviceName).toBe(
        "Polimento tecnico",
      );
      expect(result.value.quote.services[0]?.priceInCents).toBe(45000);
      expect(servicesRepository.items).toHaveLength(0);
    }
  });

  it("should reject a detached quote service with an existing catalog name", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const service = makeService({ establishmentId: establishment.id });

    await usersRepository.create(owner);
    await establishmentsRepository.create(establishment);
    await servicesRepository.create(service);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      customer: {
        name: "Cliente Orcamento",
      },
      serviceItems: [
        {
          serviceName: service.serviceName.value,
          priceInCents: 45000,
        },
      ],
      paymentOptions: [
        {
          method: "PIX",
          label: "Pix",
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should reject a quote service price outside the catalog policy", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const service = makeService({
      establishmentId: establishment.id,
      priceSpecification: ServicePriceSpecification.create({
        type: "RANGE",
        minPriceInCents: 30000,
        maxPriceInCents: 60000,
      }),
    });

    await usersRepository.create(owner);
    await establishmentsRepository.create(establishment);
    await servicesRepository.create(service);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      customer: {
        name: "Cliente Orcamento",
      },
      serviceItems: [
        {
          serviceId: service.id.toString(),
          priceInCents: 60001,
        },
      ],
      paymentOptions: [
        {
          method: "PIX",
          label: "Pix",
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should reject a missing prospect name", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const service = makeService({ establishmentId: establishment.id });

    await usersRepository.create(owner);
    await establishmentsRepository.create(establishment);
    await servicesRepository.create(service);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      customer: { name: " " },
      serviceItems: [{ serviceId: service.id.toString() }],
      paymentOptions: [
        {
          method: "PIX",
          label: "A vista no Pix",
          installments: 1,
          interestFree: true,
          discountType: null,
          discountValue: null,
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should reject an invalid prospect phone", async () => {
    const context = await makeQuoteContext();

    const result = await sut.execute(
      makeCreateQuoteRequest(context, {
        customer: { name: "Cliente Orcamento", phone: "1" },
      }),
    );

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should reject an invalid prospect CPF/CNPJ", async () => {
    const context = await makeQuoteContext();

    const result = await sut.execute(
      makeCreateQuoteRequest(context, {
        customer: { name: "Cliente Orcamento", cpfCnpj: "123" },
      }),
    );

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should reject an incomplete or invalid prospect address", async () => {
    const context = await makeQuoteContext();

    const incompleteAddressResult = await sut.execute(
      makeCreateQuoteRequest(context, {
        customer: {
          name: "Cliente Orcamento",
          address: {
            street: "Rua A",
            country: "Brasil",
            state: "SP",
            zipCode: null,
            city: "Sao Paulo",
            complement: null,
          },
        },
      }),
    );
    const invalidAddressResult = await sut.execute(
      makeCreateQuoteRequest(context, {
        customer: {
          name: "Cliente Orcamento",
          address: {
            street: "Rua A",
            country: "Brasil",
            state: "SP",
            zipCode: "abc",
            city: "Sao Paulo",
            complement: null,
          },
        },
      }),
    );

    expect(incompleteAddressResult.isLeft()).toBe(true);
    expect(incompleteAddressResult.value).toBeInstanceOf(
      InvalidQuoteInputError,
    );
    expect(invalidAddressResult.isLeft()).toBe(true);
    expect(invalidAddressResult.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should reject a vehicle snapshot without brand", async () => {
    const context = await makeQuoteContext();

    const result = await sut.execute(
      makeCreateQuoteRequest(context, {
        vehicle: { model: "HR-V" },
      }),
    );

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should reject a vehicle snapshot without model", async () => {
    const context = await makeQuoteContext();

    const result = await sut.execute(
      makeCreateQuoteRequest(context, {
        vehicle: { brand: "Honda" },
      }),
    );

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should reject an invalid vehicle plate snapshot", async () => {
    const context = await makeQuoteContext();

    const result = await sut.execute(
      makeCreateQuoteRequest(context, {
        vehicle: { brand: "Honda", model: "HR-V", plate: "ABC123" },
      }),
    );

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should reject an invalid vehicle year snapshot", async () => {
    const context = await makeQuoteContext();

    const result = await sut.execute(
      makeCreateQuoteRequest(context, {
        vehicle: { brand: "Honda", model: "HR-V", year: 1899 },
      }),
    );

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should accept customerId without customer", async () => {
    const context = await makeQuoteContext();
    const customer = makeCustomer({
      establishmentId: context.establishment.id,
    });

    await customersRepository.create(customer);

    const result = await sut.execute(
      makeCreateQuoteRequest(context, {
        customer: undefined,
        customerId: customer.id.toString(),
      }),
    );

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.quote.customerId).toEqual(customer.id);
  });

  it("should reject customerId with customer snapshot", async () => {
    const context = await makeQuoteContext();
    const customer = makeCustomer({
      establishmentId: context.establishment.id,
    });

    await customersRepository.create(customer);

    const result = await sut.execute(
      makeCreateQuoteRequest(context, {
        customerId: customer.id.toString(),
        customer: { name: "Cliente Duplicado" },
      }),
    );

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should reject vehicleId with vehicle snapshot", async () => {
    const context = await makeQuoteContext();
    const customer = makeCustomer({
      establishmentId: context.establishment.id,
    });
    const vehicle = makeCustomerVehicle({
      establishmentId: context.establishment.id,
      customerId: customer.id,
    });

    await customersRepository.create(customer);
    await customerVehiclesRepository.create(vehicle);

    const result = await sut.execute(
      makeCreateQuoteRequest(context, {
        customer: undefined,
        customerId: customer.id.toString(),
        vehicleId: vehicle.id.toString(),
        vehicle: { brand: "Honda", model: "HR-V" },
      }),
    );

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should reject a quote when the establishment owner user does not exist", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const service = makeService({ establishmentId: establishment.id });

    await establishmentsRepository.create(establishment);
    await servicesRepository.create(service);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      customer: { name: "Robertinho Contador" },
      serviceItems: [{ serviceId: service.id.toString() }],
      paymentOptions: [
        {
          method: "PIX",
          label: "A vista no Pix",
          installments: 1,
          interestFree: true,
          discountType: null,
          discountValue: null,
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject a deleted existing customer", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const customer = makeCustomer({ establishmentId: establishment.id });
    const service = makeService({ establishmentId: establishment.id });
    customer.softDelete(new Date("2026-05-22T10:00:00.000Z"));

    await usersRepository.create(owner);
    await establishmentsRepository.create(establishment);
    await customersRepository.create(customer);
    await servicesRepository.create(service);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      customerId: customer.id.toString(),
      serviceItems: [{ serviceId: service.id.toString() }],
      paymentOptions: [
        {
          method: "PIX",
          label: "A vista no Pix",
          installments: 1,
          interestFree: true,
          discountType: null,
          discountValue: null,
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject a vehicleId without customerId", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const service = makeService({ establishmentId: establishment.id });

    await usersRepository.create(owner);
    await establishmentsRepository.create(establishment);
    await servicesRepository.create(service);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      customer: { name: "Robertinho Contador" },
      vehicleId: "vehicle-id",
      serviceItems: [{ serviceId: service.id.toString() }],
      paymentOptions: [
        {
          method: "PIX",
          label: "A vista no Pix",
          installments: 1,
          interestFree: true,
          discountType: null,
          discountValue: null,
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should reject a deleted vehicle", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const customer = makeCustomer({ establishmentId: establishment.id });
    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
    });
    const service = makeService({ establishmentId: establishment.id });
    vehicle.softDelete(new Date("2026-05-22T10:00:00.000Z"));

    await usersRepository.create(owner);
    await establishmentsRepository.create(establishment);
    await customersRepository.create(customer);
    await customerVehiclesRepository.create(vehicle);
    await servicesRepository.create(service);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      customerId: customer.id.toString(),
      vehicleId: vehicle.id.toString(),
      serviceItems: [{ serviceId: service.id.toString() }],
      paymentOptions: [
        {
          method: "PIX",
          label: "A vista no Pix",
          installments: 1,
          interestFree: true,
          discountType: null,
          discountValue: null,
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject inactive service", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const service = makeService({
      establishmentId: establishment.id,
      isActive: false,
    });

    await usersRepository.create(owner);
    await establishmentsRepository.create(establishment);
    await servicesRepository.create(service);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      customer: { name: "Robertinho Contador" },
      serviceItems: [{ serviceId: service.id.toString() }],
      paymentOptions: [
        {
          method: "PIX",
          label: "A vista no Pix",
          installments: 1,
          interestFree: true,
          discountType: null,
          discountValue: null,
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InactiveServiceError);
  });

  it("should reject a deleted service", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const service = makeService({ establishmentId: establishment.id });
    service.softDelete(new Date("2026-05-22T10:00:00.000Z"));

    await usersRepository.create(owner);
    await establishmentsRepository.create(establishment);
    await servicesRepository.create(service);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      customer: { name: "Robertinho Contador" },
      serviceItems: [{ serviceId: service.id.toString() }],
      paymentOptions: [
        {
          method: "PIX",
          label: "A vista no Pix",
          installments: 1,
          interestFree: true,
          discountType: null,
          discountValue: null,
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject service from another establishment", async () => {
    const owner = makeUser("ESTABLISHMENT");
    const establishment = makeEstablishment({ ownerId: owner.id });
    const otherEstablishment = makeEstablishment();
    const service = makeService({ establishmentId: otherEstablishment.id });

    await usersRepository.create(owner);
    await establishmentsRepository.create(establishment);
    await establishmentsRepository.create(otherEstablishment);
    await servicesRepository.create(service);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      customer: { name: "Robertinho Contador" },
      serviceItems: [{ serviceId: service.id.toString() }],
      paymentOptions: [
        {
          method: "PIX",
          label: "A vista no Pix",
          installments: 1,
          interestFree: true,
          discountType: null,
          discountValue: null,
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should snapshot owner address from the establishment owner user", async () => {
    const owner = makeUser("ESTABLISHMENT", {
      address: Address.create({
        street: "Rua A",
        country: "Brasil",
        state: "SP",
        zipCode: "01001-000",
        city: "Sao Paulo",
      }),
    });
    const establishment = makeEstablishment({ ownerId: owner.id });
    const service = makeService({ establishmentId: establishment.id });

    await usersRepository.create(owner);
    await establishmentsRepository.create(establishment);
    await servicesRepository.create(service);

    const result = await sut.execute({
      actor: { userId: owner.id.toString(), role: "ESTABLISHMENT" },
      customer: { name: "Robertinho Contador" },
      serviceItems: [{ serviceId: service.id.toString() }],
      paymentOptions: [
        {
          method: "PIX",
          label: "A vista no Pix",
          installments: 1,
          interestFree: true,
          discountType: null,
          discountValue: null,
        },
      ],
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.quote.establishment.address).toEqual({
      street: "Rua A",
      country: "Brasil",
      state: "SP",
      zipCode: "01001-000",
      city: "Sao Paulo",
      complement: null,
    });
  });
});
