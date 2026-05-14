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

    expect(firstPage.services).toHaveLength(20);

    const secondPage = await sut.execute({
      filters: { page: 2, size: 20 },
    });

    expect(secondPage.services).toHaveLength(5);
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

    expect(result.services).toHaveLength(1);
    expect(getFirstItem(result.services).serviceName.value).toBe(
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
    expect(all.services).toHaveLength(2);

    const activeOnly = await sut.execute({
      filters: { isActive: true, size: 50 },
    });
    expect(activeOnly.services).toHaveLength(1);
    expect(getFirstItem(activeOnly.services).isActive).toBe(true);

    const inactiveOnly = await sut.execute({
      filters: { isActive: false, size: 50 },
    });
    expect(inactiveOnly.services).toHaveLength(1);
    expect(getFirstItem(inactiveOnly.services).isActive).toBe(false);
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

    expect(result.services).toHaveLength(1);
    expect(getFirstItem(result.services).serviceName.value).toBe("Mid");
  });
});
