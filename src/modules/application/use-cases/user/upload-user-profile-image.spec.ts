import { describe, expect, it, beforeEach } from "vitest";

import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryUsersRepository } from "../../../../../tests/repositories/in-memory-users-repository";
import type { EnvService } from "../../../../infra/env/env.service";
import { InvalidUploadedImageError } from "../../../../shared/errors/invalid-uploaded-image-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { buildPublicObjectUrl } from "../../../../shared/utils/build-public-object-url";
import { FakeObjectStorage } from "../../../../../tests/helpers/fake-object-storage";
import { UploadUserProfileImageUseCase } from "./upload-user-profile-image";

describe("UploadUserProfileImageUseCase", () => {
  let sut: UploadUserProfileImageUseCase;
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

    sut = new UploadUserProfileImageUseCase(
      envService as EnvService,
      objectStorage,
      usersRepository,
    );
  });

  it("should upload profile image and persist URL on user", async () => {
    const user = makeUser("ESTABLISHMENT");
    await usersRepository.create(user);

    const file = {
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      mimetype: "image/jpeg",
      originalname: "photo.jpg",
    };

    const result = await sut.execute({
      userId: user.id.toString(),
      file,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.url).toMatch(
        /^https:\/\/cdn\.example\.com\/user-profile\//,
      );
    }

    expect(objectStorage.puts[0]?.key).toMatch(
      /^user-profile\/.+\/photo\.jpg$/,
    );

    const saved = await usersRepository.findById(user.id.toString());
    expect(saved?.profileImageUrl).toBe(
      result.isRight() ? result.value.url : null,
    );
    expect(objectStorage.puts).toHaveLength(1);
    expect(objectStorage.deletes).toHaveLength(0);
  });

  it("should replace profile image and delete previous object", async () => {
    const previousUrl = buildPublicObjectUrl(
      "https://cdn.example.com",
      "user-profile/old/uuid/photo.jpg",
    );
    const user = makeUser("ESTABLISHMENT", { profileImageUrl: previousUrl });
    await usersRepository.create(user);

    const result = await sut.execute({
      userId: user.id.toString(),
      file: {
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        mimetype: "image/png",
        originalname: "new.png",
      },
    });

    expect(result.isRight()).toBe(true);
    expect(objectStorage.puts).toHaveLength(1);
    expect(objectStorage.deletes).toEqual(["user-profile/old/uuid/photo.jpg"]);

    const saved = await usersRepository.findById(user.id.toString());
    expect(saved?.profileImageUrl).toBe(
      result.isRight() ? result.value.url : null,
    );
    expect(saved?.profileImageUrl).not.toBe(previousUrl);
  });

  it("should not delete when previous URL is external", async () => {
    const user = makeUser("ESTABLISHMENT", {
      profileImageUrl: "https://external.example.com/avatar.png",
    });
    await usersRepository.create(user);

    const result = await sut.execute({
      userId: user.id.toString(),
      file: {
        buffer: Buffer.from([0xff, 0xd8, 0xff]),
        mimetype: "image/jpeg",
        originalname: "photo.jpg",
      },
    });

    expect(result.isRight()).toBe(true);
    expect(objectStorage.deletes).toHaveLength(0);
  });

  it("should reject unsupported mime type", async () => {
    const user = makeUser("ESTABLISHMENT");
    await usersRepository.create(user);

    const result = await sut.execute({
      userId: user.id.toString(),
      file: {
        buffer: Buffer.from("x"),
        mimetype: "application/pdf",
        originalname: "doc.pdf",
      },
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value).toBeInstanceOf(InvalidUploadedImageError);
    }
    expect(objectStorage.puts).toHaveLength(0);
  });

  it("should return not found when user does not exist", async () => {
    const result = await sut.execute({
      userId: new UniqueEntityId().toString(),
      file: {
        buffer: Buffer.from([0xff, 0xd8, 0xff]),
        mimetype: "image/jpeg",
        originalname: "photo.jpg",
      },
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value).toBeInstanceOf(ResourceNotFoundError);
    }
  });
});
