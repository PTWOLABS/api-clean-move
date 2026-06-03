import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { Establishment } from "../../../establishments/domain/entities/establishment";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { InMemoryUsersRepository } from "../../../../../tests/repositories/in-memory-users-repository";
import { UpdateEstablishmentUseCase } from "./update-establishment";

let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let sut: UpdateEstablishmentUseCase;

describe("Update establishment", () => {
  beforeEach(() => {
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      new InMemoryServicesRepository(),
    );

    sut = new UpdateEstablishmentUseCase(inMemoryEstablishmentsRepository);
  });

  it("should return not found when owner has no establishment", async () => {
    const owner = makeUser("ESTABLISHMENT");

    const result = await sut.execute({
      ownerId: owner.id.toString(),
      tradeName: "Clean Move",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should update commercial fields on an OAuth draft", async () => {
    const ownerId = new UniqueEntityId();
    const establishment = Establishment.createOAuthDraft({ ownerId });

    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      ownerId: ownerId.toString(),
      tradeName: "Clean Move",
      legalBusinessName: "Clean Move LTDA",
      cnpj: "61911322000187",
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.establishment.tradeName).toBe("Clean Move");
    expect(result.value.establishment.cnpj?.toString()).toBe("61911322000187");
  });
});
