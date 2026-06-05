import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { Establishment } from "../../../establishments/domain/entities/establishment";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
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

  it("should return not found when establishment id does not exist", async () => {
    const owner = makeUser("ESTABLISHMENT");

    const result = await sut.execute({
      ownerId: owner.id.toString(),
      establishmentId: "00000000-0000-4000-8000-000000000099",
      tradeName: "Clean Move",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should return not allowed when owner does not own the establishment", async () => {
    const ownerA = makeUser("ESTABLISHMENT");
    const ownerB = makeUser("ESTABLISHMENT");
    const establishmentB = makeEstablishment({ ownerId: ownerB.id });
    await inMemoryEstablishmentsRepository.create(establishmentB);

    const result = await sut.execute({
      ownerId: ownerA.id.toString(),
      establishmentId: establishmentB.id.toString(),
      tradeName: "Clean Move",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should update commercial fields on an OAuth draft", async () => {
    const ownerId = new UniqueEntityId();
    const establishment = Establishment.createOAuthDraft({ ownerId });

    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      ownerId: ownerId.toString(),
      establishmentId: establishment.id.toString(),
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
