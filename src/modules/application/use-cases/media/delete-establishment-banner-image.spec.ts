import { describe, expect, it, beforeEach } from "vitest";

import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import type { EnvService } from "../../../../infra/env/env.service";
import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { buildPublicObjectUrl } from "../../../../shared/utils/build-public-object-url";
import { FakeObjectStorage } from "../../../../../tests/helpers/fake-object-storage";
import { DeleteEstablishmentBannerImageUseCase } from "./delete-establishment-banner-image";

describe("DeleteEstablishmentBannerImageUseCase", () => {
  let sut: DeleteEstablishmentBannerImageUseCase;
  let envService: Pick<EnvService, "get">;
  let objectStorage: FakeObjectStorage;
  let establishmentsRepository: InMemoryEstablishmentsRepository;

  beforeEach(() => {
    envService = {
      get(key) {
        if (key === "AWS_S3_PUBLIC_BASE_URL") {
          return "https://cdn.example.com";
        }

        throw new Error(`Unexpected env key: ${String(key)}`);
      },
    } as EnvService;

    objectStorage = new FakeObjectStorage();
    establishmentsRepository = new InMemoryEstablishmentsRepository(
      new InMemoryServicesRepository(),
    );

    sut = new DeleteEstablishmentBannerImageUseCase(
      envService as EnvService,
      objectStorage,
      establishmentsRepository,
    );
  });

  it("should delete banner image from storage and clear URL on establishment", async () => {
    const ownerId = new UniqueEntityId();
    const bannerImageUrl = buildPublicObjectUrl(
      "https://cdn.example.com",
      "establishment-banner/old/uuid/banner.png",
    );
    const establishment = makeEstablishment({
      ownerId,
      bannerImageUrl,
    });
    await establishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: ownerId.toString(),
      establishmentId: establishment.id.toString(),
    });

    expect(result.isRight()).toBe(true);
    expect(objectStorage.deletes).toEqual([
      "establishment-banner/old/uuid/banner.png",
    ]);

    const saved = await establishmentsRepository.findByOwnerId(
      ownerId.toString(),
    );
    expect(saved?.bannerImageUrl).toBeNull();
  });

  it("should return not allowed when establishment id does not match owner", async () => {
    const ownerId = new UniqueEntityId();
    const establishment = makeEstablishment({
      ownerId,
      bannerImageUrl: buildPublicObjectUrl(
        "https://cdn.example.com",
        "establishment-banner/old/uuid/banner.png",
      ),
    });
    await establishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: ownerId.toString(),
      establishmentId: new UniqueEntityId().toString(),
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value).toBeInstanceOf(NotAllowedError);
    }
    expect(objectStorage.deletes).toHaveLength(0);
  });

  it("should return not found when establishment has no banner image", async () => {
    const ownerId = new UniqueEntityId();
    const establishment = makeEstablishment({ ownerId });
    await establishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: ownerId.toString(),
      establishmentId: establishment.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value).toBeInstanceOf(ResourceNotFoundError);
      expect(result.value.message).toBe("Banner image not found.");
    }
  });

  it("should return not found when establishment does not exist for owner", async () => {
    const result = await sut.execute({
      establishmentOwnerId: new UniqueEntityId().toString(),
      establishmentId: new UniqueEntityId().toString(),
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value).toBeInstanceOf(ResourceNotFoundError);
    }
  });
});
