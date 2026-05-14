import { Money } from "../../../catalog/domain/value-objects/money";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { getFirstItem } from "../../../../../tests/utils/get-first-item";
import { GetServiceCatalogByEstablishmentUseCase } from "./get-services-catalog-by-establishment";
import { ServiceName } from "../../../catalog/domain/value-objects/service-name";

let inMemoryServicesRepository: InMemoryServicesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;

let sut: GetServiceCatalogByEstablishmentUseCase;

describe("Get services", () => {
  beforeEach(() => {
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );

    sut = new GetServiceCatalogByEstablishmentUseCase(
      inMemoryServicesRepository,
      inMemoryEstablishmentsRepository,
    );
  });

  it("should be able to get many services of an unique establishment", async () => {
    const establishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);

    for (let i = 0; i < 23; i++) {
      await inMemoryServicesRepository.create(
        makeService({
          establishmentId: establishment.id,
        }),
      );
    }

    const result = await sut.execute({
      establishmentId: establishment.id.toString(),
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(inMemoryServicesRepository.items).toHaveLength(23);
    expect(result.value.items).toHaveLength(20);
    expect(result.value.totalItems).toBe(23);

    const result2 = await sut.execute({
      establishmentId: establishment.id.toString(),
      filters: { page: 2 },
    });

    expect(result2.isRight()).toBe(true);

    if (result2.isLeft()) {
      throw result2.value;
    }

    expect(result2.value.items).toHaveLength(3);
    expect(result2.value.totalItems).toBe(23);
  });

  it("should be able to get only services from the requested establishment", async () => {
    const establishment = makeEstablishment();
    const anotherEstablishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEstablishmentsRepository.create(anotherEstablishment);

    await inMemoryServicesRepository.create(
      makeService({
        serviceName: ServiceName.create("Lavagem simples"),
        establishmentId: establishment.id,
      }),
    );

    await inMemoryServicesRepository.create(
      makeService({
        serviceName: ServiceName.create("Higienizacao interna"),
        establishmentId: anotherEstablishment.id,
      }),
    );

    const result = await sut.execute({
      establishmentId: establishment.id.toString(),
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.items).toHaveLength(1);
    expect(result.value.totalItems).toBe(1);
    const firstService = getFirstItem(result.value.items);

    expect(firstService.establishmentId.toString()).toBe(
      establishment.id.toString(),
    );
    expect(firstService.serviceName.value).toBe("Lavagem simples");
  });

  it("should be able to get many services of an unique establishment with filters", async () => {
    const establishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);

    await inMemoryServicesRepository.create(
      makeService({
        serviceName: ServiceName.create("service-0"),
        category: "WASH",
        price: Money.create(15000),
        establishmentId: establishment.id,
      }),
    );

    await inMemoryServicesRepository.create(
      makeService({
        serviceName: ServiceName.create("WashUniqueAlphaX"),
        category: "WASH",
        price: Money.create(25000),
        establishmentId: establishment.id,
      }),
    );

    await inMemoryServicesRepository.create(
      makeService({
        serviceName: ServiceName.create("service-2"),
        category: "PROTECTION",
        price: Money.create(35000),
        establishmentId: establishment.id,
      }),
    );

    for (let i = 3; i < 23; i++) {
      await inMemoryServicesRepository.create(
        makeService({
          serviceName: ServiceName.create(`service-${i}`),
          category: "WASH",
          price: Money.create(30000),
          establishmentId: establishment.id,
        }),
      );
    }

    const result = await sut.execute({
      establishmentId: establishment.id.toString(),
      filters: {
        category: "WASH",
        minPrice: 20000,
        serviceName: "AlphaX",
      },
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.items).toHaveLength(1);
    expect(result.value.totalItems).toBe(1);
    const filteredService = getFirstItem(result.value.items);

    expect(filteredService.serviceName.value).toBe("WashUniqueAlphaX");

    const result2 = await sut.execute({
      establishmentId: establishment.id.toString(),
      filters: {
        category: "WASH",
        minPrice: 20000,
      },
    });

    expect(result2.isRight()).toBe(true);

    if (result2.isLeft()) {
      throw result2.value;
    }

    expect(result2.value.items).toHaveLength(20);
    expect(result2.value.totalItems).toBe(21);

    const result3 = await sut.execute({
      establishmentId: establishment.id.toString(),
      filters: {
        minPrice: 40000,
      },
    });

    expect(result3.isRight()).toBe(true);

    if (result3.isLeft()) {
      throw result3.value;
    }

    expect(result3.value.items).toHaveLength(0);
    expect(result3.value.totalItems).toBe(0);

    const result4 = await sut.execute({
      establishmentId: establishment.id.toString(),
      filters: {
        maxPrice: 20000,
      },
    });

    expect(result4.isRight()).toBe(true);

    if (result4.isLeft()) {
      throw result4.value;
    }

    expect(result4.value.items).toHaveLength(1);
    expect(result4.value.totalItems).toBe(1);
    const cheaperService = getFirstItem(result4.value.items);

    expect(cheaperService.serviceName.value).toBe("service-0");
  });

  it("should filter by isActive when provided", async () => {
    const establishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);

    await inMemoryServicesRepository.create(
      makeService({
        serviceName: ServiceName.create("Active svc"),
        establishmentId: establishment.id,
        isActive: true,
      }),
    );

    await inMemoryServicesRepository.create(
      makeService({
        serviceName: ServiceName.create("Inactive svc"),
        establishmentId: establishment.id,
        isActive: false,
      }),
    );

    const all = await sut.execute({
      establishmentId: establishment.id.toString(),
    });

    expect(all.isRight()).toBe(true);
    if (all.isLeft()) throw all.value;
    expect(all.value.items).toHaveLength(2);
    expect(all.value.totalItems).toBe(2);

    const onlyActive = await sut.execute({
      establishmentId: establishment.id.toString(),
      filters: { isActive: true },
    });
    expect(onlyActive.isRight()).toBe(true);
    if (onlyActive.isLeft()) throw onlyActive.value;
    expect(onlyActive.value.items).toHaveLength(1);
    expect(onlyActive.value.totalItems).toBe(1);
    expect(getFirstItem(onlyActive.value.items).isActive).toBe(true);

    const onlyInactive = await sut.execute({
      establishmentId: establishment.id.toString(),
      filters: { isActive: false },
    });
    expect(onlyInactive.isRight()).toBe(true);
    if (onlyInactive.isLeft()) throw onlyInactive.value;
    expect(onlyInactive.value.items).toHaveLength(1);
    expect(onlyInactive.value.totalItems).toBe(1);
    expect(getFirstItem(onlyInactive.value.items).isActive).toBe(false);
  });

  it("should not be able to get services from a non-existent establishment", async () => {
    const result = await sut.execute({
      establishmentId: "non-existent-establishment",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
