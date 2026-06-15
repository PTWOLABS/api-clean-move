import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ObjectStorage } from "../../../../modules/application/repositories/object-storage";
import { EstablishmentFactory } from "../../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../../tests/factories/user-factory";
import { FakeObjectStorage } from "../../../../../tests/helpers/fake-object-storage";
import {
  getHttpServer,
  makeEstablishmentAccessToken,
} from "../../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../../app.module";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { EnvService } from "../../../env/env.service";
import { buildPublicObjectUrl } from "../../../../shared/utils/build-public-object-url";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("DeleteEstablishmentBannerImageController (e2e)", () => {
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

  it("should delete banner image and clear URL on establishment", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const uploadResponse = await request(getHttpServer(app))
      .post(`/establishments/${establishment.id.toString()}/banner-image`)
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", tinyPng, "banner.png");

    expect(uploadResponse.status).toBe(201);
    const uploadedKey = fakeObjectStorage.puts.at(-1)?.key;
    expect(uploadedKey).toBeDefined();

    const deleteResponse = await request(getHttpServer(app))
      .delete(`/establishments/${establishment.id.toString()}/banner-image`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(deleteResponse.status).toBe(204);
    expect(fakeObjectStorage.deletes).toContain(uploadedKey);

    const row = await prisma.establishment.findUnique({
      where: { id: establishment.id.toString() },
    });
    expect(row?.bannerImageUrl).toBeNull();
  });

  it("should return 404 when establishment has no banner image", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .delete(`/establishments/${establishment.id.toString()}/banner-image`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
  });

  it("should return 403 when establishment id does not belong to owner", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .delete(
        `/establishments/00000000-0000-4000-8000-000000000001/banner-image`,
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
  });

  it("should return 401 without access token", async () => {
    const response = await request(getHttpServer(app)).delete(
      `/establishments/00000000-0000-4000-8000-000000000001/banner-image`,
    );

    expect(response.status).toBe(401);
  });

  it("should delete managed banner image from storage", async () => {
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
      "establishment-banner/seed/banner.png",
    );

    await prisma.establishment.update({
      where: { id: establishment.id.toString() },
      data: { bannerImageUrl: managedUrl },
    });

    const response = await request(getHttpServer(app))
      .delete(`/establishments/${establishment.id.toString()}/banner-image`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(204);
    expect(fakeObjectStorage.deletes).toContain(
      "establishment-banner/seed/banner.png",
    );
  });
});
