import { CustomerDocument } from "../../../customer/domain/value-objects/customer-document";
import { Cnpj } from "../../../establishments/domain/value-objects/cnpj";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { InMemoryAppointmentsRepository } from "../../../../../tests/repositories/in-memory-appointments-repository";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServiceCategoriesRepository } from "../../../../../tests/repositories/in-memory-service-categories-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { InMemoryUnitOfWork } from "../../../../../tests/repositories/in-memory-unit-of-work";
import { ServiceCategory } from "../../../catalog/domain/entities/service-category";
import { CategoryName } from "../../../catalog/domain/value-objects/category-name";
import { Establishment } from "../../../establishments/domain/entities/establishment";
import {
  CompleteOnboardingUseCase,
  InvalidOnboardingInputError,
} from "./complete-onboarding";

const washCategoryId = new UniqueEntityId("wash-category");

let inMemoryUnitOfWork: InMemoryUnitOfWork;
let inMemoryServicesRepository: InMemoryServicesRepository;
let inMemoryServiceCategoriesRepository: InMemoryServiceCategoriesRepository;
let inMemoryCustomersRepository: InMemoryCustomersRepository;
let inMemoryCustomerVehiclesRepository: InMemoryCustomerVehiclesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryAppointmentsRepository: InMemoryAppointmentsRepository;
let sut: CompleteOnboardingUseCase;

async function seedWashCategory(establishment: Establishment) {
  await inMemoryServiceCategoriesRepository.create(
    ServiceCategory.create(
      {
        establishmentId: establishment.id,
        name: CategoryName.create("Lavagem"),
      },
      washCategoryId,
    ),
  );
}

describe("Complete onboarding", () => {
  beforeEach(() => {
    inMemoryUnitOfWork = new InMemoryUnitOfWork();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryServiceCategoriesRepository =
      new InMemoryServiceCategoriesRepository();
    inMemoryCustomersRepository = new InMemoryCustomersRepository();
    inMemoryCustomerVehiclesRepository = new InMemoryCustomerVehiclesRepository(
      inMemoryCustomersRepository,
    );
    inMemoryAppointmentsRepository = new InMemoryAppointmentsRepository(
      inMemoryCustomersRepository,
    );
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );

    sut = new CompleteOnboardingUseCase(
      inMemoryUnitOfWork,
      inMemoryEstablishmentsRepository,
      inMemoryServiceCategoriesRepository,
      inMemoryServicesRepository,
      inMemoryCustomersRepository,
      inMemoryCustomerVehiclesRepository,
      inMemoryAppointmentsRepository,
    );
  });

  it("should be able to create an appointment with inactive service", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);
    await seedWashCategory(establishment);

    const startsAt = new Date("2026-06-10T14:00:00.000Z");

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      service: {
        serviceName: "Lavagem premium",
        categoryId: washCategoryId.toString(),
        estimatedDuration: {
          minInMinutes: 30,
        },
        price: 3000,
        isActive: false,
      },
      customer: {
        fullName: "Maria Silva",
        phone: "11999999999",
      },
      appointment: {
        startsAt,
      },
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.service).toBe(inMemoryServicesRepository.items[0]);
    expect(result.value.service?.isActive).toBe(false);

    expect(result.value.customer).toBe(inMemoryCustomersRepository.items[0]);
    expect(result.value.customer?.fullName).toBe("Maria Silva");

    expect(result.value.appointment).toBe(
      inMemoryAppointmentsRepository.items[0],
    );
    expect(result.value.appointment?.customerId).toEqual(
      result.value.customer?.id,
    );
    expect(result.value.appointment?.startsAt).toEqual(startsAt);

    expect(result.value.appointment?.services).toHaveLength(1);
    expect(result.value.appointment?.services[0]?.serviceId).toEqual(
      result.value.service?.id,
    );

    expect(inMemoryServicesRepository.items).toHaveLength(1);
    expect(inMemoryCustomersRepository.items).toHaveLength(1);
    expect(inMemoryAppointmentsRepository.items).toHaveLength(1);
  });

  it("should update establishment and create onboarding resources", async () => {
    const establishment = makeEstablishment({
      tradeName: null,
      legalBusinessName: null,
      cnpj: null,
    });
    await inMemoryEstablishmentsRepository.create(establishment);
    await seedWashCategory(establishment);

    const startedAt = new Date();
    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      establishment: {
        tradeName: "Clean Move",
        legalBusinessName: "Clean Move Servicos LTDA",
        cnpj: "61911322000187",
      },
      service: {
        serviceName: "Lavagem premium",
        description: "Lavagem externa com acabamento e brilho.",
        categoryId: washCategoryId.toString(),
        estimatedDuration: {
          minInMinutes: 30,
          maxInMinutes: 60,
        },
        price: 3000,
        isActive: true,
      },
      customer: {
        cpfCnpj: "529.982.247-25",
        fullName: "Maria Silva",
        phone: "11999999999",
        email: "maria@example.com",
        nickname: "Maria",
      },
      vehicle: {
        plate: "abc-1d23",
        brand: "Toyota",
        model: "Corolla",
        color: "Prata",
        year: 2022,
        notes: "Veiculo principal",
      },
      appointment: {
        startsAt: new Date("2026-06-10T14:00:00.000Z"),
        endsAt: new Date("2026-06-10T15:00:00.000Z"),
        description: "Primeiro atendimento",
        discountInCents: 500,
      },
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.establishment.tradeName).toBe("Clean Move");
    expect(result.value.establishment.legalBusinessName).toBe(
      "Clean Move Servicos LTDA",
    );
    expect(result.value.establishment.cnpj?.toString()).toBe("61911322000187");
    expect(
      result.value.establishment.onboardingCompletedAt?.getTime(),
    ).toBeGreaterThanOrEqual(startedAt.getTime());
    expect(result.value.service).toBe(inMemoryServicesRepository.items[0]);
    expect(result.value.service?.serviceName.value).toBe("Lavagem premium");
    expect(result.value.service?.price.amountInCents).toBe(3000);
    expect(result.value.service?.estimatedDuration?.minInMinutes).toBe(30);
    expect(result.value.customer).toBe(inMemoryCustomersRepository.items[0]);
    expect(result.value.customer?.cpfCnpj?.toString()).toBe("52998224725");
    expect(result.value.customer?.email?.toString()).toBe("maria@example.com");
    expect(result.value.vehicle).toBe(
      inMemoryCustomerVehiclesRepository.items[0],
    );
    expect(result.value.vehicle?.customerId).toEqual(result.value.customer?.id);
    expect(result.value.vehicle?.plate).toBe("ABC1D23");
    expect(result.value.appointment).toBe(
      inMemoryAppointmentsRepository.items[0],
    );
    expect(result.value.appointment?.customerId).toEqual(
      result.value.customer?.id,
    );
    expect(result.value.appointment?.vehicleId).toEqual(
      result.value.vehicle?.id,
    );
    expect(result.value.appointment?.services[0]?.serviceId).toEqual(
      result.value.service?.id,
    );
    expect(result.value.appointment?.startsAt).toEqual(
      new Date("2026-06-10T14:00:00.000Z"),
    );
    expect(result.value.appointment?.discountInCents?.amountInCents).toBe(500);
  });

  it("should skip optional resource creation when sections are empty or omitted", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      service: {},
      customer: {},
      vehicle: {},
      appointment: {},
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.establishment).toBe(establishment);
    expect(result.value.establishment.onboardingCompletedAt).toBeInstanceOf(
      Date,
    );
    expect(result.value.service).toBeNull();
    expect(result.value.customer).toBeNull();
    expect(result.value.vehicle).toBeNull();
    expect(result.value.appointment).toBeNull();
    expect(inMemoryServicesRepository.items).toHaveLength(0);
    expect(inMemoryCustomersRepository.items).toHaveLength(0);
    expect(inMemoryCustomerVehiclesRepository.items).toHaveLength(0);
    expect(inMemoryAppointmentsRepository.items).toHaveLength(0);
  });

  it("should return not found when the owner has no establishment", async () => {
    const result = await sut.execute({
      establishmentOwnerId: "non-existent-owner",
      service: {
        serviceName: "Lavagem premium",
        categoryId: washCategoryId.toString(),
        estimatedDuration: {
          minInMinutes: 30,
        },
        price: 3000,
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
    expect(inMemoryServicesRepository.items).toHaveLength(0);
  });

  it("should reject partial service data without required fields", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      service: {
        serviceName: "Lavagem premium",
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidOnboardingInputError);
    expect(inMemoryServicesRepository.items).toHaveLength(0);
  });

  it("should reject vehicle data without customer data", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      vehicle: {
        plate: "abc-1d23",
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidOnboardingInputError);
    expect(inMemoryCustomerVehiclesRepository.items).toHaveLength(0);
  });

  it("should reject partial customer data without name and phone", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      customer: {
        email: "maria@example.com",
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidOnboardingInputError);
    expect(inMemoryCustomersRepository.items).toHaveLength(0);
  });

  it("should reject appointment data without service and customer data", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      appointment: {
        startsAt: new Date("2026-06-10T14:00:00.000Z"),
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidOnboardingInputError);
    expect(inMemoryAppointmentsRepository.items).toHaveLength(0);
  });

  it("should reject appointment data without startsAt", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);
    await seedWashCategory(establishment);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      service: {
        serviceName: "Lavagem premium",
        categoryId: washCategoryId.toString(),
        estimatedDuration: {
          minInMinutes: 30,
        },
        price: 3000,
      },
      customer: {
        fullName: "Maria Silva",
        phone: "11999999999",
      },
      appointment: {
        description: "Primeiro atendimento",
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidOnboardingInputError);
    expect(inMemoryAppointmentsRepository.items).toHaveLength(0);
  });

  it("should not update establishment when cnpj is already in use", async () => {
    const establishment = makeEstablishment({
      tradeName: null,
      legalBusinessName: null,
      cnpj: null,
    });
    const existingEstablishment = makeEstablishment({
      cnpj: Cnpj.create("61911322000187"),
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEstablishmentsRepository.create(existingEstablishment);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      establishment: {
        tradeName: "Clean Move",
        cnpj: "61911322000187",
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceAlreadyExistsError);
    expect(establishment.tradeName).not.toBe("Clean Move");
  });

  it("should not update establishment commercial data when it is already set", async () => {
    const establishment = makeEstablishment({
      tradeName: "Already Set",
      legalBusinessName: null,
      cnpj: null,
    });

    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      establishment: {
        tradeName: "Clean Move",
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidOnboardingInputError);
    expect(establishment.tradeName).toBe("Already Set");
    expect(establishment.onboardingCompletedAt).toBeNull();
  });

  it("should not create a customer with duplicated cpfCnpj in the same establishment", async () => {
    const establishment = makeEstablishment();
    const existingCustomer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: CustomerDocument.create("52998224725"),
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(existingCustomer);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      customer: {
        cpfCnpj: "529.982.247-25",
        fullName: "Maria Silva",
        phone: "11999999999",
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceAlreadyExistsError);
    expect(inMemoryCustomersRepository.items).toHaveLength(1);
  });

  it("should not create a vehicle with duplicated plate in the same establishment", async () => {
    const establishment = makeEstablishment();
    const existingCustomer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: CustomerDocument.create("52998224725"),
    });
    const existingVehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: existingCustomer.id,
      plate: "ABC1D23",
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(existingCustomer);
    await inMemoryCustomerVehiclesRepository.create(existingVehicle);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      customer: {
        fullName: "Joao Silva",
        phone: "11988888888",
      },
      vehicle: {
        plate: "abc-1d23",
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceAlreadyExistsError);
    expect(inMemoryCustomerVehiclesRepository.items).toHaveLength(1);
  });

  it("should create a customer without email and with vehicle optional fields only", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      customer: {
        fullName: "Joao Silva",
        phone: "11988888888",
      },
      vehicle: {
        brand: "Honda",
      },
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.customer?.email).toBeNull();
    expect(result.value.vehicle?.plate).toBeNull();
    expect(result.value.vehicle?.brand).toBe("Honda");
  });

  it("should return invalid onboarding input for invalid domain values", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      customer: {
        fullName: "Maria Silva",
        phone: "11111111111",
        email: "maria@example.com",
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidOnboardingInputError);
    expect(inMemoryCustomersRepository.items).toHaveLength(0);
  });

  it("should return invalid onboarding input for invalid appointment dates", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);
    await seedWashCategory(establishment);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      service: {
        serviceName: "Lavagem premium",
        categoryId: washCategoryId.toString(),
        estimatedDuration: {
          minInMinutes: 30,
        },
        price: 3000,
      },
      customer: {
        fullName: "Maria Silva",
        phone: "11999999999",
      },
      appointment: {
        startsAt: new Date("2026-06-10T15:00:00.000Z"),
        endsAt: new Date("2026-06-10T14:00:00.000Z"),
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidOnboardingInputError);
    expect(inMemoryAppointmentsRepository.items).toHaveLength(0);
  });
});
