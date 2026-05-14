import { Money } from "../../../catalog/domain/value-objects/money";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { getFirstItem } from "../../../../../tests/utils/get-first-item";
import { ListAllServicesUseCase } from "./list-all-services";
import { ServiceName } from "../../../catalog/domain/value-objects/service-name";

let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: ListAllServicesUseCase;

describe("List all services", () => {
  beforeEach(() => {
    inMemoryServicesRepository = new InMemoryServicesRepository();
    sut = new ListAllServicesUseCase(inMemoryServicesRepository);
  });

  it("should list services across establishments with pagination defaults", async () => {
    const estA = makeEstablishment();
    const estB = makeEstablishment();

    for (let i = 0; i < 15; i++) {
      await inMemoryServicesRepository.create(
        makeService({
          establishmentId: estA.id,
          serviceName: ServiceName.create(`global-a-${i}`),
        }),
      );
    }
    for (let i = 0; i < 10; i++) {
      await inMemoryServicesRepository.create(
        makeService({
          establishmentId: estB.id,
          serviceName: ServiceName.create(`global-b-${i}`),
        }),
      );
    }

    const firstPage = await sut.execute({
      filters: {},
    });

    expect(firstPage.items).toHaveLength(20);
    expect(firstPage.totalItems).toBe(25);

    const secondPage = await sut.execute({
      filters: { page: 2, size: 20 },
    });

    expect(secondPage.items).toHaveLength(5);
    expect(secondPage.totalItems).toBe(25);
  });

  it("should filter by partial name case-insensitively", async () => {
    await inMemoryServicesRepository.create(
      makeService({
        establishmentId: makeEstablishment().id,
        serviceName: ServiceName.create("Zeta Unique Marker"),
      }),
    );
    await inMemoryServicesRepository.create(
      makeService({
        establishmentId: makeEstablishment().id,
        serviceName: ServiceName.create("Other"),
      }),
    );

    const result = await sut.execute({
      filters: { serviceName: "unique marker", size: 10 },
    });

    expect(result.items).toHaveLength(1);
    expect(result.totalItems).toBe(1);
    expect(getFirstItem(result.items).serviceName.value).toBe(
      "Zeta Unique Marker",
    );
  });

  it("should filter by isActive when provided", async () => {
    await inMemoryServicesRepository.create(
      makeService({
        establishmentId: makeEstablishment().id,
        serviceName: ServiceName.create("Global active"),
        isActive: true,
      }),
    );
    await inMemoryServicesRepository.create(
      makeService({
        establishmentId: makeEstablishment().id,
        serviceName: ServiceName.create("Global inactive"),
        isActive: false,
      }),
    );

    const all = await sut.execute({ filters: { size: 50 } });
    expect(all.items).toHaveLength(2);
    expect(all.totalItems).toBe(2);

    const activeOnly = await sut.execute({
      filters: { isActive: true, size: 50 },
    });
    expect(activeOnly.items).toHaveLength(1);
    expect(activeOnly.totalItems).toBe(1);
    expect(getFirstItem(activeOnly.items).isActive).toBe(true);

    const inactiveOnly = await sut.execute({
      filters: { isActive: false, size: 50 },
    });
    expect(inactiveOnly.items).toHaveLength(1);
    expect(inactiveOnly.totalItems).toBe(1);
    expect(getFirstItem(inactiveOnly.items).isActive).toBe(false);
  });

  it("should respect min and max price filters", async () => {
    const est = makeEstablishment();
    await inMemoryServicesRepository.create(
      makeService({
        establishmentId: est.id,
        serviceName: ServiceName.create("Cheap"),
        price: Money.create(5000),
      }),
    );
    await inMemoryServicesRepository.create(
      makeService({
        establishmentId: est.id,
        serviceName: ServiceName.create("Mid"),
        price: Money.create(15000),
      }),
    );

    const result = await sut.execute({
      filters: { minPrice: 10000, maxPrice: 20000, size: 20 },
    });

    expect(result.items).toHaveLength(1);
    expect(result.totalItems).toBe(1);
    expect(getFirstItem(result.items).serviceName.value).toBe("Mid");
  });
});
