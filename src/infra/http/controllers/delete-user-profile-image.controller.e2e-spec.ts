import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ObjectStorage } from "../../../modules/application/repositories/object-storage";
import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import { FakeObjectStorage } from "../../../../tests/helpers/fake-object-storage";
import {
  getHttpServer,
  makeEstablishmentAccessToken,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";
import { buildPublicObjectUrl } from "../../../shared/utils/build-public-object-url";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("DeleteUserProfileImageController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userFactory: UserFactory;
  let establishmentFactory: EstablishmentFactory;
  let envService: EnvService;
  let fakeObjectStorage: FakeObjectStorage;

  beforeAll(async () => {
    fakeObjectStorage = new FakeObjectStorage();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ObjectStorage)
      .useValue(fakeObjectStorage)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get(PrismaService);
    userFactory = new UserFactory(prisma, moduleRef.get(HashGenerator));
    establishmentFactory = new EstablishmentFactory(prisma);
    envService = moduleRef.get(EnvService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should delete profile image and clear URL on user", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const uploadResponse = await request(getHttpServer(app))
      .post("/user/profile-image")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", tinyPng, "avatar.png");

    expect(uploadResponse.status).toBe(201);
    const uploadedKey = fakeObjectStorage.puts.at(-1)?.key;
    expect(uploadedKey).toBeDefined();

    const deleteResponse = await request(getHttpServer(app))
      .delete("/user/profile-image")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(deleteResponse.status).toBe(204);
    expect(fakeObjectStorage.deletes).toContain(uploadedKey);

    const row = await prisma.user.findUnique({
      where: { id: establishment.ownerId.toString() },
    });
    expect(row?.profileImageUrl).toBeNull();
  });

  it("should return 404 when user has no profile image", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .delete("/user/profile-image")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
  });

  it("should return 401 without access token", async () => {
    const response = await request(getHttpServer(app)).delete(
      "/user/profile-image",
    );

    expect(response.status).toBe(401);
  });

  it("should clear URL without deleting when profile image URL is external", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    await prisma.user.update({
      where: { id: establishment.ownerId.toString() },
      data: {
        profileImageUrl: "https://external.example.com/avatar.png",
      },
    });

    const previousDeletes = fakeObjectStorage.deletes.length;

    const response = await request(getHttpServer(app))
      .delete("/user/profile-image")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(204);
    expect(fakeObjectStorage.deletes.length).toBe(previousDeletes);

    const row = await prisma.user.findUnique({
      where: { id: establishment.ownerId.toString() },
    });
    expect(row?.profileImageUrl).toBeNull();
  });

  it("should delete managed profile image from storage", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const publicBaseUrl = envService.get("AWS_S3_PUBLIC_BASE_URL");
    const managedUrl = buildPublicObjectUrl(
      publicBaseUrl,
      "user-profile/seed/avatar.png",
    );

    await prisma.user.update({
      where: { id: establishment.ownerId.toString() },
      data: { profileImageUrl: managedUrl },
    });

    const response = await request(getHttpServer(app))
      .delete("/user/profile-image")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(204);
    expect(fakeObjectStorage.deletes).toContain("user-profile/seed/avatar.png");
  });
});
