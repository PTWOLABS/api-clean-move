import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServiceCategoriesRepository } from "../../../../../tests/repositories/in-memory-service-categories-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { ServiceCategory } from "../../../catalog/domain/entities/service-category";
import { CategoryName } from "../../../catalog/domain/value-objects/category-name";
import { ListServiceCategoryOptionsUseCase } from "./list-service-category-options";

let inMemoryServiceCategoriesRepository: InMemoryServiceCategoriesRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let sut: ListServiceCategoryOptionsUseCase;

describe("List service category options", () => {
  beforeEach(() => {
    inMemoryServiceCategoriesRepository =
      new InMemoryServiceCategoriesRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );

    sut = new ListServiceCategoryOptionsUseCase(
      inMemoryServiceCategoriesRepository,
      inMemoryEstablishmentsRepository,
    );
  });

  it("should paginate category options and keep totalItems stable", async () => {
    const establishment = makeEstablishment();
    const firstCategory = ServiceCategory.create({
      establishmentId: establishment.id,
      name: CategoryName.create("Detalhamento"),
    });
    const secondCategory = ServiceCategory.create({
      establishmentId: establishment.id,
      name: CategoryName.create("Higienizacao"),
    });
    const thirdCategory = ServiceCategory.create({
      establishmentId: establishment.id,
      name: CategoryName.create("Lavagem"),
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryServiceCategoriesRepository.create(firstCategory);
    await inMemoryServiceCategoriesRepository.create(secondCategory);
    await inMemoryServiceCategoriesRepository.create(thirdCategory);

    const firstPage = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      page: 1,
      size: 2,
    });
    const secondPage = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      page: 2,
      size: 2,
    });

    expect(firstPage.isRight()).toBe(true);
    expect(secondPage.isRight()).toBe(true);

    if (firstPage.isLeft()) {
      throw firstPage.value;
    }

    if (secondPage.isLeft()) {
      throw secondPage.value;
    }

    expect(firstPage.value.categories).toEqual([
      {
        id: firstCategory.id.toString(),
        label: "Detalhamento",
      },
      {
        id: secondCategory.id.toString(),
        label: "Higienizacao",
      },
    ]);
    expect(firstPage.value.totalItems).toBe(3);
    expect(secondPage.value.categories).toEqual([
      {
        id: thirdCategory.id.toString(),
        label: "Lavagem",
      },
    ]);
    expect(secondPage.value.totalItems).toBe(3);
  });

  it("should filter by name, exclude deleted, and isolate establishments", async () => {
    const establishment = makeEstablishment();
    const otherEstablishment = makeEstablishment();
    const matchingCategory = ServiceCategory.create({
      establishmentId: establishment.id,
      name: CategoryName.create("Lavagem Premium"),
    });
    const otherNameCategory = ServiceCategory.create({
      establishmentId: establishment.id,
      name: CategoryName.create("Polimento"),
    });
    const deletedCategory = ServiceCategory.create({
      establishmentId: establishment.id,
      name: CategoryName.create("Lavagem Removida"),
    });
    const outsideCategory = ServiceCategory.create({
      establishmentId: otherEstablishment.id,
      name: CategoryName.create("Lavagem Externa"),
    });

    deletedCategory.softDelete(new Date("2026-05-26T10:00:00.000Z"));

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEstablishmentsRepository.create(otherEstablishment);
    await inMemoryServiceCategoriesRepository.create(matchingCategory);
    await inMemoryServiceCategoriesRepository.create(otherNameCategory);
    await inMemoryServiceCategoriesRepository.create(deletedCategory);
    await inMemoryServiceCategoriesRepository.create(outsideCategory);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      search: "lavagem",
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.categories).toEqual([
      {
        id: matchingCategory.id.toString(),
        label: "Lavagem Premium",
      },
    ]);
    expect(result.value.totalItems).toBe(1);
  });

  it("should use default page and size when omitted", async () => {
    const establishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);

    for (let index = 1; index <= 25; index += 1) {
      await inMemoryServiceCategoriesRepository.create(
        ServiceCategory.create({
          establishmentId: establishment.id,
          name: CategoryName.create(
            `Categoria ${String(index).padStart(2, "0")}`,
          ),
        }),
      );
    }

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.categories).toHaveLength(20);
    expect(result.value.totalItems).toBe(25);
    expect(result.value.categories[0]?.label).toBe("Categoria 01");
    expect(result.value.categories.at(-1)?.label).toBe("Categoria 20");
  });

  it("should reject a missing establishment", async () => {
    const result = await sut.execute({
      establishmentOwnerId: "missing-owner",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
