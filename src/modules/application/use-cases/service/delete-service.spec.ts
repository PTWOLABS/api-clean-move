import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { ServiceName } from "../../../catalog/domain/value-objects/service-name";
import { DeleteServiceUseCase } from "./delete-service";

let inMemoryServicesRepository: InMemoryServicesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let sut: DeleteServiceUseCase;

describe("Delete a service", () => {
  beforeEach(() => {
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );

    sut = new DeleteServiceUseCase(
      inMemoryServicesRepository,
      inMemoryEstablishmentsRepository,
    );
  });

  it("should soft-delete a service for the owning establishment", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);

    const service = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Service to delete"),
    });
    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceId: service.id.toString(),
    });

    expect(result.isRight()).toBe(true);

    const stored =
      await inMemoryServicesRepository.findByIdIncludingSoftDeleted(
        service.id.toString(),
      );
    expect(stored?.isDeleted()).toBe(true);
  });

  it("should return ResourceNotFound when establishment is missing", async () => {
    const result = await sut.execute({
      establishmentOwnerId: new UniqueEntityId().toString(),
      serviceId: new UniqueEntityId().toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should return ResourceNotFound when service id does not exist", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceId: new UniqueEntityId().toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should return NotAllowed when service belongs to another establishment", async () => {
    const owner = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(owner);

    const other = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(other);

    const service = makeService({
      establishmentId: owner.id,
      serviceName: ServiceName.create("Foreign service"),
    });
    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      establishmentOwnerId: other.ownerId.toString(),
      serviceId: service.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should return ResourceNotFound when service is already deleted", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);

    const service = makeService({
      establishmentId: establishment.id,
      deletedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceId: service.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should return ResourceNotFound when trying to delete the same service twice", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);

    const service = makeService({ establishmentId: establishment.id });
    await inMemoryServicesRepository.create(service);

    const first = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceId: service.id.toString(),
    });
    expect(first.isRight()).toBe(true);

    const second = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      serviceId: service.id.toString(),
    });
    expect(second.isLeft()).toBe(true);
    expect(second.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
