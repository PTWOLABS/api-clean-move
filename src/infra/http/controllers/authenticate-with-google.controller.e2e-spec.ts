import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";
import { AppModule } from "../../app.module";
import { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../database/prisma/prisma.service";
import {
  OAuthIdTokenVerifier,
  OAuthUserClaims,
} from "../../../modules/application/services/oauth-id-token-verifier";
import { GoogleIdTokenVerifier } from "../../auth/google-id-token-verifier";
import {
  authResponseSchema,
  extractRefreshTokenCookie,
  extractRefreshTokenValue,
  makeRefreshTokenCookieHeader,
} from "../../../../tests/helpers/auth-session.e2e-helpers";

const authenticateWithGoogleResponseSchema = z.object({
  accessToken: z.string().min(1),
  userId: z.uuid(),
});

const singleMessageResponseSchema = z.object({
  message: z.string(),
});

const refreshTokenTtlInSeconds = 1_296_000;

function getHttpServer(app: INestApplication): Parameters<typeof request>[0] {
  return app.getHttpServer() as Parameters<typeof request>[0];
}

describe("AuthenticateWithGoogleController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const oauthIdTokenVerifierMock: OAuthIdTokenVerifier = {
    verifyGoogleIdToken: async (idToken: string): Promise<OAuthUserClaims> => {
      if (idToken === "invalid-token") {
        throw new Error("Invalid OAuth token.");
      }

      const claims = mockedClaimsByToken.get(idToken);

      if (!claims) {
        throw new Error("Invalid OAuth token.");
      }

      return claims;
    },
  };
  const mockedClaimsByToken = new Map<string, OAuthUserClaims>([
    [
      "unverified-email-token",
      {
        provider: "GOOGLE",
        subjectId: "google-sub-unverified",
        email: "unverified@example.com",
        emailVerified: false,
        name: "OAuth Unverified",
      },
    ],
    [
      "linked-account-token",
      {
        provider: "GOOGLE",
        subjectId: "google-sub-linked",
        email: "linked@example.com",
        emailVerified: true,
        name: "Linked User",
      },
    ],
    [
      "link-by-email-token",
      {
        provider: "GOOGLE",
        subjectId: "google-sub-by-email",
        email: "email-match@example.com",
        emailVerified: true,
        name: "Email Match",
      },
    ],
    [
      "new-user-token",
      {
        provider: "GOOGLE",
        subjectId: "google-sub-new",
        email: "new-user@example.com",
        emailVerified: true,
        name: "New OAuth User",
      },
    ],
  ]);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OAuthIdTokenVerifier)
      .useValue(oauthIdTokenVerifierMock)
      .overrideProvider(GoogleIdTokenVerifier)
      .useValue(oauthIdTokenVerifierMock)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should authenticate an already linked user", async () => {
    const linkedUser = await prisma.user.create({
      data: {
        name: "Linked User",
        email: "linked@example.com",
        hashedPassword: null,
        role: "CUSTOMER",
        phone: null,
        address: Prisma.JsonNull,
        socialAccounts: {
          create: {
            provider: "GOOGLE",
            subjectId: "google-sub-linked",
          },
        },
      },
    });

    const response = await request(getHttpServer(app))
      .post("/auth/google")
      .set("User-Agent", "Mozilla/5.0 OAuth Browser")
      .set("X-Forwarded-For", "198.51.100.20, 203.0.113.20")
      .send({ idToken: "linked-account-token" });

    const responseBody = authenticateWithGoogleResponseSchema.parse(
      response.body,
    );
    const setCookieHeader = z
      .array(z.string())
      .parse(response.headers["set-cookie"]);
    const refreshTokenCookie = setCookieHeader.find((cookie) =>
      cookie.startsWith("refresh_token="),
    );

    expect(response.status).toBe(200);
    expect(responseBody.userId).toBe(linkedUser.id);
    expect(responseBody.accessToken).toEqual(expect.any(String));
    expect("refreshToken" in responseBody).toBe(false);
    expect(refreshTokenCookie).toBeDefined();
    expect(refreshTokenCookie).toContain("HttpOnly");
    expect(refreshTokenCookie).toContain("Path=/auth");
    expect(refreshTokenCookie).toContain(`Max-Age=${refreshTokenTtlInSeconds}`);
    expect(refreshTokenCookie).toContain("SameSite=Lax");
    expect(refreshTokenCookie).not.toContain("Secure");

    const linkedSession = await prisma.session.findFirst({
      where: {
        userId: linkedUser.id,
      },
    });

    expect(linkedSession).not.toBeNull();
    expect(linkedSession?.userAgent).toBe("Mozilla/5.0 OAuth Browser");
    expect(linkedSession?.ipAddress).toBe("198.51.100.20");
  });

  it("should refresh the session after Google authentication", async () => {
    await prisma.user.create({
      data: {
        name: "Refresh After Google",
        email: "refresh-google@example.com",
        hashedPassword: null,
        role: "CUSTOMER",
        phone: null,
        address: Prisma.JsonNull,
        socialAccounts: {
          create: {
            provider: "GOOGLE",
            subjectId: "google-sub-refresh",
          },
        },
      },
    });

    mockedClaimsByToken.set("refresh-after-google-token", {
      provider: "GOOGLE",
      subjectId: "google-sub-refresh",
      email: "refresh-google@example.com",
      emailVerified: true,
      name: "Refresh After Google",
    });

    const loginResponse = await request(getHttpServer(app))
      .post("/auth/google")
      .send({ idToken: "refresh-after-google-token" });

    expect(loginResponse.status).toBe(200);

    const loginSetCookie = z
      .array(z.string())
      .parse(loginResponse.headers["set-cookie"]);
    const refreshToken = extractRefreshTokenValue(
      extractRefreshTokenCookie(loginSetCookie),
    );

    const refreshResponse = await request(getHttpServer(app))
      .post("/auth/refresh")
      .set("Cookie", makeRefreshTokenCookieHeader(refreshToken));

    const refreshBody = authResponseSchema.parse(refreshResponse.body);
    const refreshSetCookie = z
      .array(z.string())
      .parse(refreshResponse.headers["set-cookie"]);

    expect(refreshResponse.status).toBe(200);
    expect(refreshBody.accessToken).toEqual(expect.any(String));
    expect(
      extractRefreshTokenValue(extractRefreshTokenCookie(refreshSetCookie)),
    ).not.toBe(refreshToken);
  });

  it("should link social account when email already exists", async () => {
    const existingUser = await prisma.user.create({
      data: {
        name: "Email Match",
        email: "email-match@example.com",
        hashedPassword: null,
        role: "CUSTOMER",
        phone: null,
        address: Prisma.JsonNull,
      },
    });

    const response = await request(getHttpServer(app))
      .post("/auth/google")
      .send({ idToken: "link-by-email-token" });

    expect(response.status).toBe(200);

    const responseBody = authenticateWithGoogleResponseSchema.parse(
      response.body,
    );
    expect(responseBody.userId).toBe(existingUser.id);

    const linkedAccount = await prisma.socialAccount.findUnique({
      where: {
        provider_subjectId: {
          provider: "GOOGLE",
          subjectId: "google-sub-by-email",
        },
      },
    });

    expect(linkedAccount).not.toBeNull();
    expect(linkedAccount?.userId).toBe(existingUser.id);
  });

  it("should create a new incomplete user when account does not exist", async () => {
    const response = await request(getHttpServer(app))
      .post("/auth/google")
      .send({ idToken: "new-user-token" });

    expect(response.status).toBe(200);

    const responseBody = authenticateWithGoogleResponseSchema.parse(
      response.body,
    );

    const createdUser = await prisma.user.findUnique({
      where: {
        id: responseBody.userId,
      },
      include: {
        socialAccounts: true,
      },
    });

    expect(createdUser).not.toBeNull();
    expect(createdUser?.hashedPassword).toBeNull();
    expect(createdUser?.phone).toBeNull();
    expect(createdUser?.address).toBeNull();
    expect(createdUser?.socialAccounts).toEqual([
      expect.objectContaining({
        provider: "GOOGLE",
        subjectId: "google-sub-new",
      }),
    ]);
  });

  it("should return 400 when OAuth email is not verified", async () => {
    const response = await request(getHttpServer(app))
      .post("/auth/google")
      .send({ idToken: "unverified-email-token" });

    expect(response.status).toBe(400);

    const responseBody = singleMessageResponseSchema.parse(response.body);
    expect(responseBody.message).toBe("OAuth email is not verified.");
  });

  it("should return 401 when OAuth token is invalid", async () => {
    const response = await request(getHttpServer(app))
      .post("/auth/google")
      .send({ idToken: "invalid-token" });

    expect(response.status).toBe(401);

    const responseBody = singleMessageResponseSchema.parse(response.body);
    expect(responseBody.message).toBe("Invalid OAuth token.");
  });
});
