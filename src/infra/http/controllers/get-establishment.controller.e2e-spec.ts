import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

import { ObjectStorage } from "../../../modules/application/repositories/object-storage";
import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import { FakeObjectStorage } from "../../../../tests/helpers/fake-object-storage";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";
import {
  getHttpServer,
  loginUser,
  makeEmployeeAuth,
  makeEstablishmentAccessToken,
  makeEstablishmentAuth,
} from "../../../../tests/helpers/auth-session.e2e-helpers";

const establishmentResponseSchema = z.object({
  establishment: z.object({
    id: z.uuid(),
    tradeName: z.string().nullable(),
    legalBusinessName: z.string().nullable(),
    cnpj: z.string().nullable(),
    slug: z.string().nullable(),
    bannerImageUrl: z.string().nullable(),
  }),
});

const uploadResponseSchema = z.object({
  url: z.url(),
});

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("GetEstablishmentController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hashGenerator: HashGenerator;
  let userFactory: UserFactory;
  let establishmentFactory: EstablishmentFactory;
  let envService: EnvService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ObjectStorage)
      .useValue(new FakeObjectStorage())
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get(PrismaService);
    hashGenerator = moduleRef.get(HashGenerator);
    envService = moduleRef.get(EnvService);
    userFactory = new UserFactory(prisma, hashGenerator);
    establishmentFactory = new EstablishmentFactory(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should reject requests without an access token", async () => {
    const response = await request(getHttpServer(app)).get(
      "/establishments/00000000-0000-4000-8000-000000000001",
    );

    expect(response.status).toBe(401);
  });

  it("should return oauth draft establishment with nullable commercial fields", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "ESTABLISHMENT",
      plainPassword: "strong-password",
    });
    const establishment =
      await establishmentFactory.makePrismaOAuthDraftEstablishment({
        ownerId: user.id,
      });
    const { loginBody } = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const response = await request(getHttpServer(app))
      .get(`/establishments/${establishment.id.toString()}`)
      .set("Authorization", `Bearer ${loginBody.accessToken}`);

    expect(response.status).toBe(200);

    const body = establishmentResponseSchema.parse(response.body);
    expect(body.establishment.id).toBe(establishment.id.toString());
    expect(body.establishment.tradeName).toBeNull();
    expect(body.establishment.legalBusinessName).toBeNull();
    expect(body.establishment.cnpj).toBeNull();
    expect(body.establishment.slug).toBeNull();
    expect(body.establishment.bannerImageUrl).toBeNull();
  });

  it("should return commercial fields for establishment owner", async () => {
    const { accessToken, establishment } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .get(`/establishments/${establishment.id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    const body = establishmentResponseSchema.parse(response.body);
    expect(body.establishment.id).toBe(establishment.id.toString());
    expect(body.establishment.tradeName).toBe(establishment.tradeName);
    expect(body.establishment.legalBusinessName).toBe(
      establishment.legalBusinessName,
    );
    expect(body.establishment.cnpj).toBe(
      establishment.cnpj?.toString() ?? null,
    );
    expect(body.establishment.slug).toBe(establishment.slug?.value ?? null);
    expect(body.establishment.bannerImageUrl).toBeNull();
  });

  it("should return bannerImageUrl after banner upload", async () => {
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
    const uploadBody = uploadResponseSchema.parse(uploadResponse.body);

    const getResponse = await request(getHttpServer(app))
      .get(`/establishments/${establishment.id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(getResponse.status).toBe(200);

    const body = establishmentResponseSchema.parse(getResponse.body);
    expect(body.establishment.bannerImageUrl).toBe(uploadBody.url);
  });

  it("should allow employee to read their establishment", async () => {
    const { accessToken, establishment } = await makeEmployeeAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
    });

    const response = await request(getHttpServer(app))
      .get(`/establishments/${establishment.id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    establishmentResponseSchema.parse(response.body);
  });

  it("should return 404 when establishment id does not exist", async () => {
    const { accessToken } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .get("/establishments/00000000-0000-4000-8000-000000000099")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
  });

  it("should return 403 when owner tries to read another establishment", async () => {
    const { accessToken } = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const otherOwner = await userFactory.makePrismaUser({
      role: "ESTABLISHMENT",
      plainPassword: "strong-password",
    });
    const otherEstablishment =
      await establishmentFactory.makePrismaEstablishment({
        ownerId: otherOwner.user.id,
      });

    const response = await request(getHttpServer(app))
      .get(`/establishments/${otherEstablishment.id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
  });
});
