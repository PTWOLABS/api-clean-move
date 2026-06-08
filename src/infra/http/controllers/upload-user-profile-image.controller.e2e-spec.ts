import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

import { ObjectStorage } from "../../../modules/application/repositories/object-storage";
import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import { FakeObjectStorage } from "../../../../tests/helpers/fake-object-storage";
import {
  getHttpServer,
  loginUser,
  makeEstablishmentAccessToken,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

const uploadResponseSchema = z.object({
  url: z.url(),
});

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("UploadUserProfileImageController (e2e)", () => {
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

  it("should upload profile image for authenticated user", async () => {
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
    const body = uploadResponseSchema.parse(uploadResponse.body);
    expect(body.url).toContain("user-profile");
    expect(fakeObjectStorage.puts).toHaveLength(1);

    const row = await prisma.user.findUnique({
      where: { id: establishment.ownerId.toString() },
    });
    expect(row?.profileImageUrl).toBe(body.url);
  });

  it("should return 401 without access token", async () => {
    const response = await request(getHttpServer(app))
      .post("/user/profile-image")
      .attach("file", tinyPng, "avatar.png");

    expect(response.status).toBe(401);
  });

  it("should return 400 for invalid mime type", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "ESTABLISHMENT",
      plainPassword: "strong-password",
    });

    await establishmentFactory.makePrismaOAuthDraftEstablishment({
      ownerId: user.id,
    });

    const login = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const previousPuts = fakeObjectStorage.puts.length;

    const response = await request(getHttpServer(app))
      .post("/user/profile-image")
      .set("Authorization", `Bearer ${login.loginBody.accessToken}`)
      .attach("file", Buffer.from("%PDF-1.4"), {
        filename: "doc.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(400);
    expect(fakeObjectStorage.puts.length).toBe(previousPuts);
  });
});
