import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import z from "zod";

import { EmailSender } from "../../../modules/application/gateways/email-sender";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { UserFactory } from "../../../../tests/factories/user-factory";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import {
  authResponseSchema,
  getHttpServer,
  loginUser,
  makeRefreshTokenCookieHeader,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import {
  CapturingEmailSender,
  extractPasswordResetTokenFromEmail,
} from "../../../../tests/helpers/password-reset.e2e-helpers";
import { expectSingleMessageResponseWithoutIssues } from "../../../../tests/helpers/http-response-assertions";

const passwordResetRequestMessage =
  "If an account exists for this email, we will send a password reset link.";

describe("Password reset (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hashGenerator: HashGenerator;
  let userFactory: UserFactory;
  let capturingEmailSender: CapturingEmailSender;

  beforeAll(async () => {
    capturingEmailSender = new CapturingEmailSender();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
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

  beforeEach(() => {
    capturingEmailSender.clear();
  });

  it("should return 200 for unknown emails without sending messages", async () => {
    const response = await request(getHttpServer(app))
      .post("/auth/password-reset/request")
      .send({ email: "unknown@example.com" });

    expect(response.status).toBe(200);
    expectSingleMessageResponseWithoutIssues(
      response.body,
      passwordResetRequestMessage,
    );
    expect(capturingEmailSender.sent).toHaveLength(0);
  });

  it("should return 200 and send a reset link for registered emails", async () => {
    const { user } = await userFactory.makePrismaUser({
      role: "CUSTOMER",
      plainPassword: "old-password",
    });

    const response = await request(getHttpServer(app))
      .post("/auth/password-reset/request")
      .send({ email: user.email.toString() });

    expect(response.status).toBe(200);
    expectSingleMessageResponseWithoutIssues(
      response.body,
      passwordResetRequestMessage,
    );
    expect(capturingEmailSender.sent).toHaveLength(1);
    expect(capturingEmailSender.sent[0]?.to).toBe(user.email.toString());

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: {
        userId: user.id.toString(),
      },
    });

    expect(resetToken).not.toBeNull();
  });

  it("should reset the password, revoke sessions and allow login with the new password", async () => {
    const oldPassword = "old-password";
    const newPassword = "new-strong-password";
    const { user } = await userFactory.makePrismaUser({
      role: "CUSTOMER",
      plainPassword: oldPassword,
    });

    const { refreshToken } = await loginUser({
      app,
      prisma,
      userId: user.id.toString(),
      email: user.email.toString(),
      password: oldPassword,
    });

    const requestResponse = await request(getHttpServer(app))
      .post("/auth/password-reset/request")
      .send({ email: user.email.toString() });

    expect(requestResponse.status).toBe(200);
    expectSingleMessageResponseWithoutIssues(
      requestResponse.body,
      passwordResetRequestMessage,
    );

    const emailHtml = capturingEmailSender.sent[0]?.html;

    if (!emailHtml) {
      throw new Error("Expected password reset email HTML.");
    }

    const token = extractPasswordResetTokenFromEmail(emailHtml);

    const confirmResponse = await request(getHttpServer(app))
      .post("/auth/password-reset/confirm")
      .send({
        token,
        newPassword,
      });

    expect(confirmResponse.status).toBe(200);
    expectSingleMessageResponseWithoutIssues(
      confirmResponse.body,
      "Password reset successfully.",
    );
    expect(capturingEmailSender.sent).toHaveLength(2);
    expect(capturingEmailSender.sent[0]?.subject).toBe("Redefinição de senha");
    expect(capturingEmailSender.sent[1]?.subject).toBe(
      "Sua senha foi alterada",
    );
    expect(capturingEmailSender.sent[1]?.html).toContain(
      "http://localhost:3000",
    );

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: {
        userId: user.id.toString(),
      },
    });

    expect(resetToken).toBeNull();

    const refreshResponse = await request(getHttpServer(app))
      .post("/auth/refresh")
      .set("Cookie", makeRefreshTokenCookieHeader(refreshToken));

    expect(refreshResponse.status).toBe(401);

    const oldLoginResponse = await request(getHttpServer(app))
      .post("/auth/login")
      .send({
        email: user.email.toString(),
        password: oldPassword,
      });

    expect(oldLoginResponse.status).toBe(400);

    const newLoginResponse = await request(getHttpServer(app))
      .post("/auth/login")
      .send({
        email: user.email.toString(),
        password: newPassword,
      });
    const newLoginBody = authResponseSchema.parse(newLoginResponse.body);
    const setCookieHeader = z
      .array(z.string())
      .parse(newLoginResponse.headers["set-cookie"]);

    expect(newLoginResponse.status).toBe(200);
    expect(newLoginBody.userId).toBe(user.id.toString());
    expect(
      setCookieHeader.some((cookie) => cookie.startsWith("refresh_token=")),
    ).toBe(true);
  });

  it("should reject invalid reset tokens", async () => {
    const response = await request(getHttpServer(app))
      .post("/auth/password-reset/confirm")
      .send({
        token: "invalid-reset-token",
        newPassword: "new-strong-password",
      });
    const responseBody = z.object({ message: z.string() }).parse(response.body);

    expect(response.status).toBe(400);
    expect(responseBody.message).toBe(
      "Invalid or expired password reset token.",
    );
  });

  it("should reject expired reset tokens", async () => {
    const { user } = await userFactory.makePrismaUser({
      role: "CUSTOMER",
      plainPassword: "old-password",
    });

    await request(getHttpServer(app))
      .post("/auth/password-reset/request")
      .send({ email: user.email.toString() });

    const emailHtml = capturingEmailSender.sent[0]?.html;

    if (!emailHtml) {
      throw new Error("Expected password reset email HTML.");
    }

    const token = extractPasswordResetTokenFromEmail(emailHtml);

    await prisma.passwordResetToken.update({
      where: {
        userId: user.id.toString(),
      },
      data: {
        expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    });

    const response = await request(getHttpServer(app))
      .post("/auth/password-reset/confirm")
      .send({
        token,
        newPassword: "new-strong-password",
      });
    const responseBody = z.object({ message: z.string() }).parse(response.body);

    expect(response.status).toBe(400);
    expect(responseBody.message).toBe(
      "Invalid or expired password reset token.",
    );
  });
});
