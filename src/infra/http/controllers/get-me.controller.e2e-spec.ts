import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import {
  getHttpServer,
  loginUser,
} from "../../../../tests/helpers/auth-session.e2e-helpers";

const addressSchema = z.object({
  street: z.string(),
  complement: z.string().nullable(),
  country: z.string(),
  state: z.string(),
  zipCode: z.string(),
  city: z.string(),
});

const getMeResponseSchema = z.object({
  user: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    role: z.enum(["CUSTOMER", "ESTABLISHMENT", "ADMIN", "EMPLOYEE"]),
    profileImageUrl: z.string().nullable(),
    establishmentId: z.uuid().nullable(),
    onboardingCompletedAt: z.string().nullable(),
    phone: z.string().nullable(),
    address: addressSchema.nullable(),
    socialAccounts: z.array(
      z.object({
        provider: z.string(),
        subjectId: z.string(),
      }),
    ),
    profileComplete: z.boolean(),
    createdAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }),
});

describe("GetMeController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hashGenerator: HashGenerator;
  let userFactory: UserFactory;
  let establishmentFactory: EstablishmentFactory;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get(PrismaService);
    hashGenerator = moduleRef.get(HashGenerator);
    userFactory = new UserFactory(prisma, hashGenerator);
    establishmentFactory = new EstablishmentFactory(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should reject get-me requests without an access token", async () => {
    const response = await request(getHttpServer(app)).get("/user/me");

    expect(response.status).toBe(401);
  });

  it("should return the authenticated user without exposing the password hash", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "CUSTOMER",
      plainPassword: "strong-password",
    });
    const { loginBody } = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const response = await request(getHttpServer(app))
      .get("/user/me")
      .set("Authorization", `Bearer ${loginBody.accessToken}`);

    expect(response.status).toBe(200);

    const body = getMeResponseSchema.parse(response.body);
    expect(body.user.id).toBe(user.id.toString());
    expect(body.user.email).toBe(user.email.toString());

    expect(JSON.stringify(response.body)).not.toContain("hashedPassword");
    expect("hashedPassword" in body.user).toBe(false);
    expect(body.user.establishmentId).toBeNull();
    expect(body.user.onboardingCompletedAt).toBeNull();
  });

  it("should return establishment id for establishment owner with oauth draft", async () => {
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
      .get("/user/me")
      .set("Authorization", `Bearer ${loginBody.accessToken}`);

    expect(response.status).toBe(200);

    const body = getMeResponseSchema.parse(response.body);
    expect(body.user.establishmentId).toBe(establishment.id.toString());
    expect(body.user.onboardingCompletedAt).toBeNull();
  });

  it("should return onboarding completion date for establishment owner", async () => {
    const onboardingCompletedAt = new Date("2026-06-11T12:00:00.000Z");
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "ESTABLISHMENT",
      plainPassword: "strong-password",
    });
    const establishment = await establishmentFactory.makePrismaEstablishment({
      ownerId: user.id,
      onboardingCompletedAt,
    });
    const { loginBody } = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const response = await request(getHttpServer(app))
      .get("/user/me")
      .set("Authorization", `Bearer ${loginBody.accessToken}`);

    expect(response.status).toBe(200);

    const body = getMeResponseSchema.parse(response.body);
    expect(body.user.establishmentId).toBe(establishment.id.toString());
    expect(body.user.onboardingCompletedAt).toBe(
      onboardingCompletedAt.toISOString(),
    );
  });
});
