import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

import { EmailSender } from "../../../modules/application/gateways/email-sender";
import {
  OAuthIdTokenVerifier,
  OAuthUserClaims,
} from "../../../modules/application/services/oauth-id-token-verifier";
import { AppModule } from "../../app.module";
import { GoogleIdTokenVerifier } from "../../auth/google-id-token-verifier";
import { PrismaService } from "../../database/prisma/prisma.service";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  authResponseSchema,
  getHttpServer,
  loginUser,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import { CapturingEmailSender } from "../../../../tests/helpers/password-reset.e2e-helpers";
import { expectSingleMessageResponseWithoutIssues } from "../../../../tests/helpers/http-response-assertions";

const passwordUpdatedMessage = "Password updated successfully.";

const authenticateWithGoogleResponseSchema = z.object({
  accessToken: z.string().min(1),
  userId: z.uuid(),
  onboardingCompletedAt: z.string().nullable(),
});

const validationErrorResponseSchema = z.object({
  statusCode: z.literal(400),
  message: z.literal("Validation failed"),
  error: z.literal("Bad Request"),
  issues: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      path: z.string(),
    }),
  ),
  parameter: z.null(),
  target: z.literal("body"),
});

describe("UpdateUserPasswordController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hashGenerator: HashGenerator;
  let userFactory: UserFactory;
  let capturingEmailSender: CapturingEmailSender;

  const mockedClaimsByToken = new Map<string, OAuthUserClaims>([
    [
      "oauth-set-password-token",
      {
        provider: "GOOGLE",
        subjectId: "google-sub-set-password",
        email: "oauth-set-password@example.com",
        emailVerified: true,
        name: "OAuth Set Password",
      },
    ],
    [
      "oauth-change-password-token",
      {
        provider: "GOOGLE",
        subjectId: "google-sub-change-password",
        email: "oauth-change-password@example.com",
        emailVerified: true,
        name: "OAuth Change Password",
      },
    ],
  ]);

  const oauthIdTokenVerifierMock: OAuthIdTokenVerifier = {
    verifyGoogleIdToken: async (idToken: string): Promise<OAuthUserClaims> => {
      const claims = mockedClaimsByToken.get(idToken);

      if (!claims) {
        throw new Error("Invalid OAuth token.");
      }

      return claims;
    },
  };

  beforeAll(async () => {
    capturingEmailSender = new CapturingEmailSender();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OAuthIdTokenVerifier)
      .useValue(oauthIdTokenVerifierMock)
      .overrideProvider(GoogleIdTokenVerifier)
      .useValue(oauthIdTokenVerifierMock)
      .overrideProvider(EmailSender)
      .useValue(capturingEmailSender)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get(PrismaService);
    hashGenerator = moduleRef.get(HashGenerator);
    userFactory = new UserFactory(prisma, hashGenerator);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should reject password update requests without an access token", async () => {
    const response = await request(getHttpServer(app))
      .post("/user/me/password")
      .send({ newPassword: "new-password" });

    expect(response.status).toBe(401);
  });

  it("should reject invalid password payloads", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "CUSTOMER",
      plainPassword: "old-password",
    });
    const { loginBody } = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const response = await request(getHttpServer(app))
      .post("/user/me/password")
      .set("Authorization", `Bearer ${loginBody.accessToken}`)
      .send({ newPassword: "short" });

    expect(response.status).toBe(400);

    const responseBody = validationErrorResponseSchema.parse(response.body);

    expect(responseBody.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "newPassword",
        }),
      ]),
    );
  });

  it("should allow OAuth user to set the first local password and login with credentials", async () => {
    const googleResponse = await request(getHttpServer(app))
      .post("/auth/google")
      .send({ idToken: "oauth-set-password-token", role: "CUSTOMER" });

    expect(googleResponse.status).toBe(200);

    const googleBody = authenticateWithGoogleResponseSchema.parse(
      googleResponse.body,
    );

    const setPasswordResponse = await request(getHttpServer(app))
      .post("/user/me/password")
      .set("Authorization", `Bearer ${googleBody.accessToken}`)
      .send({ newPassword: "first-local-password" });

    expect(setPasswordResponse.status).toBe(200);
    expectSingleMessageResponseWithoutIssues(
      setPasswordResponse.body,
      passwordUpdatedMessage,
    );

    const updatedUser = await prisma.user.findUnique({
      where: { id: googleBody.userId },
    });

    expect(updatedUser?.hashedPassword).not.toBeNull();

    const loginResponse = await request(getHttpServer(app))
      .post("/auth/login")
      .send({
        email: "oauth-set-password@example.com",
        password: "first-local-password",
      });

    expect(loginResponse.status).toBe(200);
    authResponseSchema.parse(loginResponse.body);
  });

  it("should allow credential user to change password and login with the new one", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "CUSTOMER",
      plainPassword: "old-password-1",
    });
    const { loginBody } = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const updatePasswordResponse = await request(getHttpServer(app))
      .post("/user/me/password")
      .set("Authorization", `Bearer ${loginBody.accessToken}`)
      .send({
        currentPassword: "old-password-1",
        newPassword: "new-password-1",
      });

    expect(updatePasswordResponse.status).toBe(200);
    expectSingleMessageResponseWithoutIssues(
      updatePasswordResponse.body,
      passwordUpdatedMessage,
    );

    const loginWithOldPasswordResponse = await request(getHttpServer(app))
      .post("/auth/login")
      .send({
        email: user.email.toString(),
        password: "old-password-1",
      });

    expect(loginWithOldPasswordResponse.status).toBe(401);

    const loginWithNewPasswordResponse = await request(getHttpServer(app))
      .post("/auth/login")
      .send({
        email: user.email.toString(),
        password: "new-password-1",
      });

    expect(loginWithNewPasswordResponse.status).toBe(200);
    authResponseSchema.parse(loginWithNewPasswordResponse.body);
  });

  it("should allow hybrid social user to change an existing local password", async () => {
    const googleResponse = await request(getHttpServer(app))
      .post("/auth/google")
      .send({ idToken: "oauth-change-password-token", role: "CUSTOMER" });

    expect(googleResponse.status).toBe(200);

    const googleBody = authenticateWithGoogleResponseSchema.parse(
      googleResponse.body,
    );

    const firstPasswordResponse = await request(getHttpServer(app))
      .post("/user/me/password")
      .set("Authorization", `Bearer ${googleBody.accessToken}`)
      .send({ newPassword: "hybrid-password-1" });

    expect(firstPasswordResponse.status).toBe(200);

    const loginAfterFirstPassword = await request(getHttpServer(app))
      .post("/auth/login")
      .send({
        email: "oauth-change-password@example.com",
        password: "hybrid-password-1",
      });

    expect(loginAfterFirstPassword.status).toBe(200);
    const loginBody = authResponseSchema.parse(loginAfterFirstPassword.body);

    const changePasswordResponse = await request(getHttpServer(app))
      .post("/user/me/password")
      .set("Authorization", `Bearer ${loginBody.accessToken}`)
      .send({
        currentPassword: "hybrid-password-1",
        newPassword: "hybrid-password-2",
      });

    expect(changePasswordResponse.status).toBe(200);
    expectSingleMessageResponseWithoutIssues(
      changePasswordResponse.body,
      passwordUpdatedMessage,
    );

    const loginWithNewPasswordResponse = await request(getHttpServer(app))
      .post("/auth/login")
      .send({
        email: "oauth-change-password@example.com",
        password: "hybrid-password-2",
      });

    expect(loginWithNewPasswordResponse.status).toBe(200);
    authResponseSchema.parse(loginWithNewPasswordResponse.body);
  });

  it("should return a specific error when current password is incorrect", async () => {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "CUSTOMER",
      plainPassword: "correct-password",
    });
    const { loginBody } = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: plainPassword ?? "",
    });

    const response = await request(getHttpServer(app))
      .post("/user/me/password")
      .set("Authorization", `Bearer ${loginBody.accessToken}`)
      .send({
        currentPassword: "wrong-password",
        newPassword: "new-password-1",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message:
        "The current password you entered is incorrect. Check the password and try again.",
      code: "INVALID_CURRENT_PASSWORD",
      field: "currentPassword",
    });
  });
});
