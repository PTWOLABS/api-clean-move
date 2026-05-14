import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { ListEstablishmentServicesUseCase } from "./list-establishment-services";
import { ServiceName } from "../../../catalog/domain/value-objects/service-name";

let inMemoryServicesRepository: InMemoryServicesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let sut: ListEstablishmentServicesUseCase;

describe("List establishment services (owner)", () => {
  beforeEach(() => {
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );
    sut = new ListEstablishmentServicesUseCase(
      inMemoryServicesRepository,
      inMemoryEstablishmentsRepository,
    );
  });

  it("should list services when path owner id matches authenticated user and establishment exists", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryServicesRepository.create(
      makeService({
        establishmentId: establishment.id,
        serviceName: ServiceName.create("Owned service"),
      }),
    );

    const ownerId = establishment.ownerId.toString();

    const result = await sut.execute({
      authenticatedUserId: ownerId,
      pathOwnerUserId: ownerId,
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.items).toHaveLength(1);
    expect(result.value.totalItems).toBe(1);
  });

  it("should return 404 when owner id has no establishment profile", async () => {
    const unknownOwnerId = "00000000-0000-4000-8000-000000000099";

    const result = await sut.execute({
      authenticatedUserId: unknownOwnerId,
      pathOwnerUserId: unknownOwnerId,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should return not allowed when path owner id differs from authenticated user", async () => {
    const ownerA = makeEstablishment();
    const ownerB = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(ownerA);
    await inMemoryEstablishmentsRepository.create(ownerB);

    const result = await sut.execute({
      authenticatedUserId: ownerA.ownerId.toString(),
      pathOwnerUserId: ownerB.ownerId.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });
});
