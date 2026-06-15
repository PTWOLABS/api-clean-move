import { describe, expect, it, beforeEach } from "vitest";

import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryUsersRepository } from "../../../../../tests/repositories/in-memory-users-repository";
import type { EnvService } from "../../../../infra/env/env.service";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { buildPublicObjectUrl } from "../../../../shared/utils/build-public-object-url";
import { FakeObjectStorage } from "../../../../../tests/helpers/fake-object-storage";
import { DeleteUserProfileImageUseCase } from "./delete-user-profile-image";

describe("DeleteUserProfileImageUseCase", () => {
  let sut: DeleteUserProfileImageUseCase;
  let envService: Pick<EnvService, "get">;
  let objectStorage: FakeObjectStorage;
  let usersRepository: InMemoryUsersRepository;

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
    usersRepository = new InMemoryUsersRepository();

    sut = new DeleteUserProfileImageUseCase(
      envService as EnvService,
      objectStorage,
      usersRepository,
    );
  });

  it("should delete profile image from storage and clear URL on user", async () => {
    const profileImageUrl = buildPublicObjectUrl(
      "https://cdn.example.com",
      "user-profile/old/uuid/photo.jpg",
    );
    const user = makeUser("ESTABLISHMENT", { profileImageUrl });
    await usersRepository.create(user);

    const result = await sut.execute({ userId: user.id.toString() });

    expect(result.isRight()).toBe(true);
    expect(objectStorage.deletes).toEqual(["user-profile/old/uuid/photo.jpg"]);

    const saved = await usersRepository.findById(user.id.toString());
    expect(saved?.profileImageUrl).toBeNull();
  });

  it("should clear URL without deleting when image URL is external", async () => {
    const user = makeUser("ESTABLISHMENT", {
      profileImageUrl: "https://external.example.com/avatar.png",
    });
    await usersRepository.create(user);

    const result = await sut.execute({ userId: user.id.toString() });

    expect(result.isRight()).toBe(true);
    expect(objectStorage.deletes).toHaveLength(0);

    const saved = await usersRepository.findById(user.id.toString());
    expect(saved?.profileImageUrl).toBeNull();
  });

  it("should return not found when user has no profile image", async () => {
    const user = makeUser("ESTABLISHMENT");
    await usersRepository.create(user);

    const result = await sut.execute({ userId: user.id.toString() });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value).toBeInstanceOf(ResourceNotFoundError);
      expect(result.value.message).toBe("Profile image not found.");
    }
    expect(objectStorage.deletes).toHaveLength(0);
  });

  it("should return not found when user does not exist", async () => {
    const result = await sut.execute({
      userId: new UniqueEntityId().toString(),
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value).toBeInstanceOf(ResourceNotFoundError);
    }
  });
});
