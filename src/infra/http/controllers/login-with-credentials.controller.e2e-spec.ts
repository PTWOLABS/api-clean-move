import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

import { AppModule } from "../../app.module";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { PrismaService } from "../../database/prisma/prisma.service";

const loginWithCredentialsResponseSchema = z.object({
  userId: z.uuid(),
  accessToken: z.string().min(1),
  onboardingCompletedAt: z.string().nullable(),
});

const singleMessageResponseSchema = z.object({
  message: z.string(),
});

const refreshTokenTtlInSeconds = 1_296_000;

function getHttpServer(app: INestApplication): Parameters<typeof request>[0] {
  return app.getHttpServer() as Parameters<typeof request>[0];
}

function makeLoginPayload() {
  return {
    email: "johndoe@example.com",
    password: "strong-password",
  };
}

describe("LoginWithCredentialsController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hashGenerator: HashGenerator;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get(PrismaService);
    hashGenerator = moduleRef.get(HashGenerator);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should authenticate a user, set the refresh token cookie and persist the session metadata", async () => {
    const password = "strong-password";
    const hashedPassword = await hashGenerator.hash(password);

    const createdUser = await prisma.user.create({
      data: {
        name: "John Doe",
        email: "johndoe@example.com",
        hashedPassword,
        role: "CUSTOMER",
        phone: null,
      },
    });

    const response = await request(getHttpServer(app))
      .post("/auth/login")
      .set("User-Agent", "Mozilla/5.0 Test Browser")
      .set("X-Forwarded-For", "198.51.100.10, 203.0.113.10")
      .send(makeLoginPayload());
    const responseBody = loginWithCredentialsResponseSchema.parse(
      response.body,
    );
    const setCookieHeader = z
      .array(z.string())
      .parse(response.headers["set-cookie"]);
    const refreshTokenCookie = setCookieHeader.find((cookie) =>
      cookie.startsWith("refresh_token="),
    );

    expect(response.status).toBe(200);
    expect(responseBody.userId).toBe(createdUser.id);
    expect(responseBody.accessToken).toEqual(expect.any(String));
    expect(responseBody.onboardingCompletedAt).toBeNull();
    expect("refreshToken" in responseBody).toBe(false);
    expect(refreshTokenCookie).toBeDefined();
    expect(refreshTokenCookie).toContain("HttpOnly");
    expect(refreshTokenCookie).toContain("Path=/auth");
    expect(refreshTokenCookie).toContain(`Max-Age=${refreshTokenTtlInSeconds}`);
    expect(refreshTokenCookie).toContain("SameSite=Lax");
    expect(refreshTokenCookie).not.toContain("Secure");

    const createdSession = await prisma.session.findFirst({
      where: {
        userId: createdUser.id,
      },
    });

    expect(createdSession).not.toBeNull();
    expect(createdSession?.userAgent).toBe("Mozilla/5.0 Test Browser");
    expect(createdSession?.ipAddress).toBe("198.51.100.10");
    expect(createdSession?.revokedAt).toBeNull();
    expect(createdSession?.expiresAt.getTime()).toBeGreaterThan(
      createdSession?.createdAt.getTime() ?? 0,
    );
  });

  it("should return onboarding completion timestamp for an establishment user", async () => {
    const password = "strong-password";
    const hashedPassword = await hashGenerator.hash(password);
    const onboardingCompletedAt = new Date("2026-06-11T12:00:00.000Z");

    const createdUser = await prisma.user.create({
      data: {
        name: "Establishment Owner",
        email: "owner@example.com",
        hashedPassword,
        role: "ESTABLISHMENT",
        phone: null,
        ownedEstablishment: {
          create: {
            tradeName: "Clean Move",
            legalBusinessName: "Clean Move Servicos LTDA",
            cnpj: "61911322000187",
            onboardingCompletedAt,
          },
        },
      },
    });

    const response = await request(getHttpServer(app))
      .post("/auth/login")
      .send({
        email: "owner@example.com",
        password,
      });
    const responseBody = loginWithCredentialsResponseSchema.parse(
      response.body,
    );

    expect(response.status).toBe(200);
    expect(responseBody.userId).toBe(createdUser.id);
    expect(responseBody.onboardingCompletedAt).toBe(
      onboardingCompletedAt.toISOString(),
    );
  });

  it("should reject invalid credentials and avoid creating a session", async () => {
    const password = "strong-password";
    const hashedPassword = await hashGenerator.hash(password);

    const createdUser = await prisma.user.create({
      data: {
        name: "John Doe",
        email: "johndoe@example.com",
        hashedPassword,
        role: "CUSTOMER",
        phone: null,
      },
    });

    const response = await request(getHttpServer(app))
      .post("/auth/login")
      .send({
        email: "johndoe@example.com",
        password: "wrong-password",
      });
    const responseBody = singleMessageResponseSchema.parse(response.body);

    expect(response.status).toBe(400);
    expect(responseBody.message).toBe("Invalid Credentials.");

    const sessionsCount = await prisma.session.count({
      where: {
        userId: createdUser.id,
      },
    });

    expect(sessionsCount).toBe(0);
  });
});
