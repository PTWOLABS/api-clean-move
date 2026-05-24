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
import { EstablishmentScopeService } from "../../services/establishment-scope";
import { CreateQuoteUseCase } from "./create-quote";

let quotesRepository: InMemoryQuotesRepository;
let customersRepository: InMemoryCustomersRepository;
let customerVehiclesRepository: InMemoryCustomerVehiclesRepository;
let employeesRepository: InMemoryEmployeesRepository;
let establishmentsRepository: InMemoryEstablishmentsRepository;
let servicesRepository: InMemoryServicesRepository;
let usersRepository: InMemoryUsersRepository;
let establishmentScope: EstablishmentScopeService;
let sut: CreateQuoteUseCase;

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
      vehicle: { model: "HR-V", year: 2025, color: "Branco" },
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
