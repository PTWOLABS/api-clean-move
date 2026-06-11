import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { makeServiceCategoryRef } from "../../../../../tests/helpers/service-category-ref";

const washCategoryId = new UniqueEntityId("wash-category");
const protectionCategoryId = new UniqueEntityId("protection-category");
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { getFirstItem } from "../../../../../tests/utils/get-first-item";
import { ListEstablishmentsUseCase } from "./list-establishment";

let inMemoryServicesRepository: InMemoryServicesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;

let sut: ListEstablishmentsUseCase;

describe("List establishments", () => {
  beforeEach(() => {
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );

    sut = new ListEstablishmentsUseCase(inMemoryEstablishmentsRepository);
  });

  it("should be able to list all establishments without filters", async () => {
    const establishmentA = makeEstablishment({
      tradeName: "Alpha Clean",
      legalBusinessName: "Alpha Clean LTDA",
    });
    const establishmentB = makeEstablishment({
      tradeName: "Beta Wash",
      legalBusinessName: "Beta Wash LTDA",
    });

    await inMemoryEstablishmentsRepository.create(establishmentA);
    await inMemoryEstablishmentsRepository.create(establishmentB);

    const result = await sut.execute({});

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw new Error();
    }

    expect(result.value.establishments).toHaveLength(2);
    expect(result.value.establishments).toEqual([
      establishmentA,
      establishmentB,
    ]);
  });

  it("should be able to list establishments filtered by name", async () => {
    const establishmentA = makeEstablishment({
      tradeName: "Alpha Clean",
      legalBusinessName: "Alpha Clean LTDA",
    });
    const establishmentB = makeEstablishment({
      tradeName: "Beta Wash",
      legalBusinessName: "Beta Wash LTDA",
    });

    await inMemoryEstablishmentsRepository.create(establishmentA);
    await inMemoryEstablishmentsRepository.create(establishmentB);

    const result = await sut.execute({
      filters: {
        establishmentName: "Alpha Clean",
      },
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw new Error();
    }

    expect(result.value.establishments).toHaveLength(1);

    const establishment = getFirstItem(result.value.establishments);

    expect(establishment.tradeName).toBe("Alpha Clean");
  });

  it("should be able to list establishments filtered by service category", async () => {
    const establishmentA = makeEstablishment({
      tradeName: "Alpha Clean",
      legalBusinessName: "Alpha Clean LTDA",
    });
    const establishmentB = makeEstablishment({
      tradeName: "Beta Wash",
      legalBusinessName: "Beta Wash LTDA",
    });

    await inMemoryEstablishmentsRepository.create(establishmentA);
    await inMemoryEstablishmentsRepository.create(establishmentB);

    await inMemoryServicesRepository.create(
      makeService({
        establishmentId: establishmentA.id,
        category: makeServiceCategoryRef("Proteção", protectionCategoryId),
      }),
    );
    await inMemoryServicesRepository.create(
      makeService({
        establishmentId: establishmentA.id,
        category: makeServiceCategoryRef("Proteção", protectionCategoryId),
      }),
    );
    await inMemoryServicesRepository.create(
      makeService({
        establishmentId: establishmentB.id,
        category: makeServiceCategoryRef("Lavagem", washCategoryId),
      }),
    );

    const result = await sut.execute({
      filters: {
        serviceCategoryId: protectionCategoryId.toString(),
      },
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw new Error();
    }

    expect(result.value.establishments).toHaveLength(1);

    const establishment = getFirstItem(result.value.establishments);

    expect(establishment.id.toString()).toBe(establishmentA.id.toString());
    expect(establishment.tradeName).toBe("Alpha Clean");
  });

  it("should be able to list establishments with combined filters", async () => {
    const establishmentA = makeEstablishment({
      tradeName: "Alpha Clean",
      legalBusinessName: "Alpha Clean LTDA",
    });
    const establishmentB = makeEstablishment({
      tradeName: "Beta Wash",
      legalBusinessName: "Beta Wash LTDA",
    });
    const establishmentC = makeEstablishment({
      tradeName: "Gamma Detail",
      legalBusinessName: "Gamma Detail LTDA",
    });

    await inMemoryEstablishmentsRepository.create(establishmentA);
    await inMemoryEstablishmentsRepository.create(establishmentB);
    await inMemoryEstablishmentsRepository.create(establishmentC);

    await inMemoryServicesRepository.create(
      makeService({
        establishmentId: establishmentA.id,
        category: makeServiceCategoryRef("Lavagem", washCategoryId),
      }),
    );
    await inMemoryServicesRepository.create(
      makeService({
        establishmentId: establishmentB.id,
        category: makeServiceCategoryRef("Proteção", protectionCategoryId),
      }),
    );
    await inMemoryServicesRepository.create(
      makeService({
        establishmentId: establishmentC.id,
        category: makeServiceCategoryRef("Proteção", protectionCategoryId),
      }),
    );

    const result = await sut.execute({
      filters: {
        establishmentName: "Gamma Detail",
        serviceCategoryId: protectionCategoryId.toString(),
      },
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw new Error();
    }

    expect(result.value.establishments).toHaveLength(1);

    const establishment = getFirstItem(result.value.establishments);

    expect(establishment.id.toString()).toBe(establishmentC.id.toString());
    expect(establishment.tradeName).toBe("Gamma Detail");
  });
});
