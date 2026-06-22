import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServiceCategoriesRepository } from "../../../../../tests/repositories/in-memory-service-categories-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { InMemoryUnitOfWork } from "../../../../../tests/repositories/in-memory-unit-of-work";
import { CreateServiceCategoryUseCase } from "./create-service-category";
import { DeleteServiceCategoryUseCase } from "./delete-service-category";

let inMemoryServiceCategoriesRepository: InMemoryServiceCategoriesRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryUnitOfWork: InMemoryUnitOfWork;
let sut: CreateServiceCategoryUseCase;
let deleteServiceCategoryUseCase: DeleteServiceCategoryUseCase;

describe("Create service category", () => {
  beforeEach(() => {
    inMemoryServiceCategoriesRepository =
      new InMemoryServiceCategoriesRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );
    inMemoryUnitOfWork = new InMemoryUnitOfWork();

    sut = new CreateServiceCategoryUseCase(
      inMemoryServiceCategoriesRepository,
      inMemoryEstablishmentsRepository,
    );
    deleteServiceCategoryUseCase = new DeleteServiceCategoryUseCase(
      inMemoryServiceCategoriesRepository,
      inMemoryEstablishmentsRepository,
      inMemoryServicesRepository,
      inMemoryUnitOfWork,
    );
  });

  it("should reject an active duplicated category name in the same establishment", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);

    const firstResult = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      name: "Higienizacao",
    });
    const secondResult = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      name: " higienizacao ",
    });

    expect(firstResult.isRight()).toBe(true);
    expect(secondResult.isLeft()).toBe(true);
    expect(secondResult.value).toBeInstanceOf(ResourceAlreadyExistsError);
  });

  it("should create a category with the same name as a soft-deleted category", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);

    const firstResult = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      name: "Higienizacao",
    });
    if (firstResult.isLeft()) {
      throw firstResult.value;
    }

    const deleteResult = await deleteServiceCategoryUseCase.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      categoryId: firstResult.value.category.id.toString(),
    });
    if (deleteResult.isLeft()) {
      throw deleteResult.value;
    }

    const secondResult = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      name: "Higienizacao",
    });

    expect(secondResult.isRight()).toBe(true);
  });
});
