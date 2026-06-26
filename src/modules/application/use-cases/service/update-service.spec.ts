import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { makeServiceCategoryRef } from "../../../../../tests/helpers/service-category-ref";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServiceCategoriesRepository } from "../../../../../tests/repositories/in-memory-service-categories-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { ServiceCategory } from "../../../catalog/domain/entities/service-category";
import { CategoryName } from "../../../catalog/domain/value-objects/category-name";
import { EstimatedDuration } from "../../../catalog/domain/value-objects/estimated-duration";
import { Money } from "../../../catalog/domain/value-objects/money";
import { ServiceName } from "../../../catalog/domain/value-objects/service-name";
import {
  InvalidServiceUpdateInputError,
  UpdateServiceUseCase,
} from "./update-service";

const washCategoryId = new UniqueEntityId("wash-category");
const protectionCategoryId = new UniqueEntityId("protection-category");
const washCategory = makeServiceCategoryRef("Lavagem", washCategoryId);
const protectionCategory = makeServiceCategoryRef(
  "Proteção",
  protectionCategoryId,
);

let inMemoryServicesRepository: InMemoryServicesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServiceCategoriesRepository: InMemoryServiceCategoriesRepository;

let sut: UpdateServiceUseCase;

describe("Update a service", () => {
  beforeEach(() => {
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );
    inMemoryServiceCategoriesRepository =
      new InMemoryServiceCategoriesRepository();

    sut = new UpdateServiceUseCase(
      inMemoryServicesRepository,
      inMemoryEstablishmentsRepository,
      inMemoryServiceCategoriesRepository,
    );
  });

  async function seedProtectionCategory(establishmentId: UniqueEntityId) {
    await inMemoryServiceCategoriesRepository.create(
      ServiceCategory.create(
        {
          establishmentId,
          name: CategoryName.create("Proteção"),
        },
        protectionCategoryId,
      ),
    );
  }

  async function seedWashCategory(establishmentId: UniqueEntityId) {
    await inMemoryServiceCategoriesRepository.create(
      ServiceCategory.create(
        {
          establishmentId,
          name: CategoryName.create("Lavagem"),
        },
        washCategoryId,
      ),
    );
  }

  it("should be able to update a service with a valid establishment and valid data", async () => {
    const establishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);
    await seedProtectionCategory(establishment.id);

    const service = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Service to update"),
    });

    const originalUpdatedAt = service.updatedAt!.getTime();

    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceId: service.id.toString(),
      data: {
        serviceName: "Service updated",
        price: 50000,
        categoryId: protectionCategoryId.toString(),
        description: "Service updated description",
        estimatedDuration: {
          minInMinutes: 50,
          maxInMinutes: 100,
        },
      },
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    const { service: resultService } = result.value;
    const newUpdatedAtValue = resultService.updatedAt!.getTime();

    expect(newUpdatedAtValue > originalUpdatedAt);
    expect(inMemoryServicesRepository.items[0]).toBe(resultService);
    expect(resultService.establishmentId.toString()).toBe(
      establishment.id.toString(),
    );
    expect(resultService.serviceName.toString()).toBe("Service updated");
    expect(resultService.price.amountInCents).toBe(50000);
    expect(resultService.category).toEqual(protectionCategory);
    expect(resultService.description).toBe("Service updated description");
    expect(resultService.estimatedDuration?.minInMinutes).toBe(50);
    expect(resultService.estimatedDuration?.maxInMinutes).toBe(100);
    expect(resultService.estimatedDuration?.formatted).toBe("50 - 100 min");
  });

  it("should update the service price specification", async () => {
    const establishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);

    const service = makeService({
      establishmentId: establishment.id,
    });
    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceId: service.id.toString(),
      data: {
        priceSpecification: {
          type: "RANGE",
          minPriceInCents: 30000,
          maxPriceInCents: 60000,
        },
      },
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.service.priceSpecification.toValue()).toEqual({
        type: "RANGE",
        minPriceInCents: 30000,
        maxPriceInCents: 60000,
      });
      expect(result.value.service.price.amountInCents).toBe(30000);
    }
  });

  it("should reject update with invalid price specification", async () => {
    const establishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);

    const service = makeService({ establishmentId: establishment.id });
    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceId: service.id.toString(),
      data: {
        priceSpecification: {
          type: "RANGE",
          minPriceInCents: 60000,
          maxPriceInCents: 30000,
        },
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidServiceUpdateInputError);
  });

  it("should update estimated duration min above the previous max when the new duration is valid", async () => {
    const establishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);
    await seedProtectionCategory(establishment.id);

    const service = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Service to update"),
      estimatedDuration: EstimatedDuration.create({
        minInMinutes: 10,
        maxInMinutes: 30,
      }),
    });

    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceId: service.id.toString(),
      data: {
        serviceName: "Service updated",
        price: 1,
        categoryId: protectionCategoryId.toString(),
        description: "Service updated description",
        estimatedDuration: {
          minInMinutes: 35,
        },
      },
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.service.estimatedDuration?.minInMinutes).toBe(35);
    expect(result.value.service.estimatedDuration?.maxInMinutes).toBeNull();
    expect(result.value.service.estimatedDuration?.formatted).toEqual("35 min");
    expect(result.value.service.serviceName.value).toEqual("Service updated");
  });

  it("should reject estimated duration when the new min is greater than the new max", async () => {
    const establishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);

    const service = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Service to update"),
      estimatedDuration: EstimatedDuration.create({
        minInMinutes: 10,
        maxInMinutes: 30,
      }),
    });

    const originalUpdatedAt = service.updatedAt?.getTime();

    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceId: service.id.toString(),
      data: {
        serviceName: "Service updated",
        estimatedDuration: {
          minInMinutes: 60,
          maxInMinutes: 30,
        },
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidServiceUpdateInputError);
    expect(
      inMemoryServicesRepository.items[0]?.updatedAt?.getTime() ===
        originalUpdatedAt,
    ).toBe(true);
    expect(
      inMemoryServicesRepository.items[0]?.estimatedDuration?.formatted,
    ).toEqual("10 - 30 min");
    expect(inMemoryServicesRepository.items[0]?.serviceName.value).toEqual(
      "Service to update",
    );
  });
  it("should not be able to update a service with an unknown user", async () => {
    const unknownUserId = new UniqueEntityId("unknownUserId");

    const service = makeService({
      establishmentId: unknownUserId,
      serviceName: ServiceName.create("Service to update"),
    });

    await inMemoryServicesRepository.create(service);

    const originalUpdatedAt = service.updatedAt?.getTime();

    const result = await sut.execute({
      establishmentOwnerId: unknownUserId.toString(),
      serviceId: service.id.toString(),
      data: {
        serviceName: "Service updated",
        price: 50000,
        categoryId: protectionCategoryId.toString(),
        description: "Service updated description",
        estimatedDuration: {
          minInMinutes: 50,
          maxInMinutes: 100,
        },
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
    expect(
      inMemoryServicesRepository.items[0]?.updatedAt?.getTime() ===
        originalUpdatedAt,
    ).toBe(true);
    expect(inMemoryServicesRepository.items[0]?.serviceName.value).toEqual(
      "Service to update",
    );
  });

  it("should not be able to update a soft-deleted service", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);

    const service = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Deleted service"),
      deletedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceId: service.id.toString(),
      data: { serviceName: "New name" },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject renaming a service to an active duplicated name in the same establishment", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);

    const existingService = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Higienizacao"),
    });
    const serviceToUpdate = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Lavagem"),
    });
    await inMemoryServicesRepository.create(existingService);
    await inMemoryServicesRepository.create(serviceToUpdate);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceId: serviceToUpdate.id.toString(),
      data: { serviceName: " higienizacao " },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceAlreadyExistsError);
    expect(serviceToUpdate.serviceName.value).toBe("Lavagem");
  });

  it("should allow renaming a service to the same name as a soft-deleted service", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);

    const deletedService = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Higienizacao"),
    });
    deletedService.softDelete(new Date("2026-06-22T12:00:00.000Z"));
    const serviceToUpdate = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Lavagem"),
    });
    await inMemoryServicesRepository.create(deletedService);
    await inMemoryServicesRepository.create(serviceToUpdate);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceId: serviceToUpdate.id.toString(),
      data: { serviceName: "Higienizacao" },
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) {
      throw result.value;
    }
    expect(result.value.service.serviceName.value).toBe("Higienizacao");
  });

  it("should not be able to update a service using an establishment that is not the owner of that service", async () => {
    const establishmentOwner = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishmentOwner);

    const service = makeService({
      establishmentId: establishmentOwner.id,
      serviceName: ServiceName.create("Service to update"),
    });
    await inMemoryServicesRepository.create(service);

    const anotherEstablishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(anotherEstablishment);
    await seedProtectionCategory(anotherEstablishment.id);

    const originalUpdatedAt = service.updatedAt?.getTime();

    const result = await sut.execute({
      establishmentOwnerId: anotherEstablishment.ownerId.toString(),
      serviceId: service.id.toString(),
      data: {
        serviceName: "Service updated",
        price: 50000,
        categoryId: protectionCategoryId.toString(),
        description: "Service updated description",
        estimatedDuration: {
          minInMinutes: 50,
          maxInMinutes: 100,
        },
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
    expect(
      inMemoryServicesRepository.items[0]?.updatedAt?.getTime() ===
        originalUpdatedAt,
    ).toBe(true);
    expect(inMemoryServicesRepository.items[0]?.serviceName.value).toEqual(
      "Service to update",
    );
  });
  it("should be able to update a service with a valid establishment the same data", async () => {
    const establishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);
    await seedWashCategory(establishment.id);

    const service = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Service to update with same name"),
      category: washCategory,
      description: "Same description",
      estimatedDuration: EstimatedDuration.create({
        minInMinutes: 10,
        maxInMinutes: 20,
      }),
      price: Money.create(3000),
    });

    const originalUpdatedAt = service.updatedAt!.getTime();

    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceId: service.id.toString(),
      data: {
        serviceName: "Service to update with same name",
        categoryId: washCategoryId.toString(),
        description: "Same description",
        estimatedDuration: {
          minInMinutes: 10,
          maxInMinutes: 20,
        },
        price: 3000,
      },
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    const { service: resultService } = result.value;
    const newUpdatedAtValue = resultService.updatedAt!.getTime();

    expect(newUpdatedAtValue === originalUpdatedAt).toBe(true);
  });
  it("should not be able to update a service using a user whose role is that of a client", async () => {
    const customer = makeCustomer();

    const service = makeService({
      establishmentId: customer.id,
      serviceName: ServiceName.create("Service to update by a customer"),
      category: washCategory,
      description: "Service description to update",
      estimatedDuration: EstimatedDuration.create({
        minInMinutes: 10,
        maxInMinutes: 20,
      }),
      price: Money.create(3000),
    });

    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      establishmentOwnerId: customer.id.toString(),
      serviceId: service.id.toString(),
      data: {
        serviceName: "Updated service by a customer",
        categoryId: washCategoryId.toString(),
        description: "Updated service description",
        estimatedDuration: {
          minInMinutes: 10,
          maxInMinutes: 20,
        },
        price: 3000,
      },
    });

    expect(result.isLeft()).toBe(true);

    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should be able to update only isActive", async () => {
    const establishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);

    const service = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Active toggle service"),
    });

    await inMemoryServicesRepository.create(service);

    expect(service.isActive).toBe(true);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceId: service.id.toString(),
      data: { isActive: false },
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.service.isActive).toBe(false);
  });
});
