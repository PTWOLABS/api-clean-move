import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServiceCategoriesRepository } from "../../../../../tests/repositories/in-memory-service-categories-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { ServiceCategory } from "../../../catalog/domain/entities/service-category";
import { CategoryName } from "../../../catalog/domain/value-objects/category-name";
import { ServiceName } from "../../../catalog/domain/value-objects/service-name";
import { CreateServiceUseCase } from "./create-service";
import { InvalidServiceUpdateInputError } from "./update-service";

const washCategoryId = new UniqueEntityId("wash-category");

let inMemoryServicesRepository: InMemoryServicesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServiceCategoriesRepository: InMemoryServiceCategoriesRepository;

let sut: CreateServiceUseCase;

describe("Create a service", () => {
  beforeEach(() => {
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );
    inMemoryServiceCategoriesRepository =
      new InMemoryServiceCategoriesRepository();

    sut = new CreateServiceUseCase(
      inMemoryServicesRepository,
      inMemoryEstablishmentsRepository,
      inMemoryServiceCategoriesRepository,
    );
  });

  it("should be able to create a service with an estimated duration range", async () => {
    const establishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryServiceCategoriesRepository.create(
      ServiceCategory.create(
        {
          establishmentId: establishment.id,
          name: CategoryName.create("Lavagem"),
        },
        washCategoryId,
      ),
    );

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceName: "Lavagem simples",
      description:
        "Lavagem externa com lavadora de pressao, shampoo proprio e secagem com pano de microfibra.",
      categoryId: washCategoryId.toString(),
      estimatedDuration: {
        minInMinutes: 30,
        maxInMinutes: 60,
      },
      price: 3000,
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    const { service } = result.value;

    expect(inMemoryServicesRepository.items[0]).toBe(result.value.service);
    expect(service.establishmentId.toString()).toBe(
      establishment.id.toString(),
    );
    expect(service.estimatedDuration?.minInMinutes).toBe(30);
    expect(service.estimatedDuration?.maxInMinutes).toBe(60);
    expect(service.estimatedDuration?.formatted).toBe("30 - 60 min");
    expect(result.value.service.price.value).toBe(30);
  });

  it("should create a service with a starting-at price specification", async () => {
    const establishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceName: "Polimento",
      priceSpecification: {
        type: "STARTING_AT",
        minPriceInCents: 25000,
      },
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.service.priceSpecification.toValue()).toEqual({
        type: "STARTING_AT",
        minPriceInCents: 25000,
      });
      expect(result.value.service.price.amountInCents).toBe(25000);
    }
  });

  it("should reject a service with invalid price specification", async () => {
    const establishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceName: "Higienizacao",
      priceSpecification: {
        type: "RANGE",
        minPriceInCents: 60000,
        maxPriceInCents: 30000,
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidServiceUpdateInputError);
  });

  it("should keep legacy price as fixed pricing", async () => {
    const establishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceName: "Lavagem",
      price: 8000,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.service.priceSpecification.toValue()).toEqual({
        type: "FIXED",
        fixedPriceInCents: 8000,
      });
    }
  });

  it("should reject an active duplicated service name in the same establishment", async () => {
    const establishment = makeEstablishment();
    const service = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Higienizacao"),
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceName: " higienizacao ",
      price: 8000,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceAlreadyExistsError);
  });

  it("should create a service with the same name as a soft-deleted service", async () => {
    const establishment = makeEstablishment();
    const service = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Higienizacao"),
    });
    service.softDelete(new Date("2026-06-22T12:00:00.000Z"));

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceName: "Higienizacao",
      price: 8000,
    });

    expect(result.isRight()).toBe(true);
  });

  it("should default missing price to a starting-at minimum price", async () => {
    const establishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceName: "Servico sem preco informado",
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.service.priceSpecification.toValue()).toEqual({
        type: "STARTING_AT",
        minPriceInCents: 1,
      });
    }
  });

  it("should not be able to create a service for a non-existent establishment", async () => {
    const result = await sut.execute({
      establishmentOwnerId: "non-existent-establishment",
      serviceName: "Lavagem tecnica",
      description: "Lavagem detalhada",
      categoryId: washCategoryId.toString(),
      estimatedDuration: {
        minInMinutes: 45,
        maxInMinutes: 90,
      },
      price: 5000,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
    expect(inMemoryServicesRepository.items).toHaveLength(0);
  });

  it("should be able to create a service without description, category and estimated duration", async () => {
    const establishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceName: "Lavagem expressa",
      price: 2000,
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    const { service } = result.value;

    expect(service.description).toBeUndefined();
    expect(service.category).toBeUndefined();
    expect(service.estimatedDuration).toBeUndefined();
    expect(service.price.value).toBe(20);
  });
});
