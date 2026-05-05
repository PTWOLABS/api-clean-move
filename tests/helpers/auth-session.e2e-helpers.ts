import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import request from "supertest";
import z from "zod";

import { PrismaService } from "../../src/infra/database/prisma/prisma.service";
import { EnvService } from "../../src/infra/env/env.service";
import { EstablishmentFactory } from "../factories/establishment-factory";
import { UserFactory } from "../factories/user-factory";

export const authResponseSchema = z.object({
  userId: z.uuid(),
  accessToken: z.string().min(1),
});

export function getHttpServer(
  app: INestApplication,
): Parameters<typeof request>[0] {
  return app.getHttpServer() as Parameters<typeof request>[0];
}

export function extractRefreshTokenCookie(setCookieHeader: string[]): string {
  const refreshTokenCookie = setCookieHeader.find((cookie) =>
    cookie.startsWith("refresh_token="),
  );

  if (!refreshTokenCookie) {
    throw new Error("Expected refresh_token cookie.");
  }

  return refreshTokenCookie;
}

export function extractRefreshTokenValue(cookie: string): string {
  const match = /^refresh_token=([^;]+)/.exec(cookie);

  if (!match?.[1]) {
    throw new Error("Expected refresh_token cookie value.");
  }

  return decodeURIComponent(match[1]);
}

export function makeRefreshTokenCookieHeader(refreshToken: string): string {
  return `refresh_token=${refreshToken}`;
}

export async function getSessionIdByUserId(
  prisma: PrismaService,
  userId: string,
): Promise<string> {
  const session = await prisma.session.findFirst({
    where: {
      userId,
    },
  });

  if (!session) {
    throw new Error("Expected session for the provided user.");
  }

  return session.id;
}

export async function loginUser({
  app,
  prisma,
  userId,
  email,
  password,
}: {
  app: INestApplication;
  prisma: PrismaService;
  userId: string;
  email: string;
  password: string;
}) {
  const loginResponse = await request(getHttpServer(app))
    .post("/auth/login")
    .send({
      email,
      password,
    });
  const loginBody = authResponseSchema.parse(loginResponse.body);
  const loginSetCookie = z
    .array(z.string())
    .parse(loginResponse.headers["set-cookie"]);
  const refreshTokenCookie = extractRefreshTokenCookie(loginSetCookie);
  const refreshToken = extractRefreshTokenValue(refreshTokenCookie);
  const sessionId = await getSessionIdByUserId(prisma, userId);

  return {
    loginResponse,
    loginBody,
    refreshTokenCookie,
    refreshToken,
    sessionId,
  };
}

type UserAuthInput = {
  app: INestApplication;
  prisma: PrismaService;
  userFactory: UserFactory;
};

type EstablishmentAuthInput = UserAuthInput & {
  establishmentFactory: EstablishmentFactory;
  envService: EnvService;
};

export async function makeEstablishmentAuth({
  app,
  prisma,
  userFactory,
  establishmentFactory,
  envService,
}: EstablishmentAuthInput) {
  const { user, plainPassword } = await userFactory.makePrismaUser({
    role: "ESTABLISHMENT",
    plainPassword: "strong-password",
  });
  const establishment = await establishmentFactory.makePrismaEstablishment({
    ownerId: user.id,
  });
  const login = await loginUser({
    app,
    prisma,
    userId: user.id.toString(),
    email: user.email.toString(),
    password: plainPassword ?? "",
  });
  const expiredAccessToken = await new JwtService({
    secret: envService.get("JWT_ACCESS_SECRET"),
  }).signAsync(
    {
      sub: user.id.toString(),
      role: user.role,
      sid: login.sessionId,
      type: "access",
    },
    {
      expiresIn: "-1s",
    },
  );

  return {
    accessToken: login.loginBody.accessToken,
    expiredAccessToken,
    establishment,
  };
}

export async function makeCustomerAuth({
  app,
  prisma,
  userFactory,
}: UserAuthInput) {
  const { user, plainPassword } = await userFactory.makePrismaUser({
    role: "CUSTOMER",
    plainPassword: "strong-password",
  });
  const login = await loginUser({
    app,
    prisma,
    userId: user.id.toString(),
    email: user.email.toString(),
    password: plainPassword ?? "",
  });

  return {
    accessToken: login.loginBody.accessToken,
  };
}

export async function makeEstablishmentUserWithoutProfileAuth({
  app,
  prisma,
  userFactory,
}: UserAuthInput) {
  const { user, plainPassword } = await userFactory.makePrismaUser({
    role: "ESTABLISHMENT",
    plainPassword: "strong-password",
  });
  const login = await loginUser({
    app,
    prisma,
    userId: user.id.toString(),
    email: user.email.toString(),
    password: plainPassword ?? "",
  });

  return {
    accessToken: login.loginBody.accessToken,
  };
}

export const makeEstablishmentAccessToken = makeEstablishmentAuth;
export const makeCustomerAccessToken = makeCustomerAuth;
export const makeEstablishmentUserWithoutProfileAccessToken =
  makeEstablishmentUserWithoutProfileAuth;
