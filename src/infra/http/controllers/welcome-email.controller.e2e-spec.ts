import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import z from "zod";

import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  getHttpServer,
  makeEstablishmentAccessToken,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import { CapturingEmailSender } from "../../../../tests/helpers/password-reset.e2e-helpers";
import { EmailSender } from "../../../modules/application/gateways/email-sender";
import {
  OAuthIdTokenVerifier,
  OAuthUserClaims,
} from "../../../modules/application/services/oauth-id-token-verifier";
import { AppModule } from "../../app.module";
import { GoogleIdTokenVerifier } from "../../auth/google-id-token-verifier";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

const registerEstablishmentResponseSchema = z.object({
  establishmentId: z.uuid(),
});

const employeeResponseSchema = z.object({
  employee: z.object({
    id: z.uuid(),
    userId: z.uuid(),
  }),
});

function calculateCnpjCheckDigit(digits: number[], weights: number[]) {
  const sum = digits.reduce((total, digit, index) => {
    return total + digit * weights[index]!;
  }, 0);
  const remainder = sum % 11;

  return remainder < 2 ? 0 : 11 - remainder;
}

function makeValidCnpj(sequence: number) {
  const base = `11222333${String(sequence).padStart(4, "0")}`;
  const baseDigits = Array.from(base, Number);
  const firstDigit = calculateCnpjCheckDigit(
    baseDigits,
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  const secondDigit = calculateCnpjCheckDigit(
    [...baseDigits, firstDigit],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );

  return `${base}${firstDigit}${secondDigit}`;
}

function makeEstablishmentRegistrationPayload(sequence: number) {
  return {
    name: "Maria Silva",
    tradeName: `Welcome Establishment ${sequence}`,
    legalBusinessName: `WELCOME BUSINESS ${sequence} LTDA`,
    email: `welcome-owner-${sequence}@example.com`,
    password: "welcome-password-1",
    cnpj: makeValidCnpj(sequence),
    phone: "11987654321",
    address: {
      street: "street-1",
      country: "country-1",
      state: "state-1",
      zipCode: "11111-111",
      city: "city-1",
    },
  };
}

describe("Welcome email (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let envService: EnvService;
  let userFactory: UserFactory;
  let establishmentFactory: EstablishmentFactory;
  let capturingEmailSender: CapturingEmailSender;

  const oauthClaimsByToken = new Map<string, OAuthUserClaims>([
    [
      "welcome-oauth-customer-token",
      {
        provider: "GOOGLE",
        subjectId: "google-sub-welcome-customer",
        email: "welcome-oauth-customer@example.com",
        emailVerified: true,
        name: "OAuth Welcome Customer",
      },
    ],
  ]);

  const oauthIdTokenVerifierMock: OAuthIdTokenVerifier = {
    verifyGoogleIdToken: async (idToken: string): Promise<OAuthUserClaims> => {
      const claims = oauthClaimsByToken.get(idToken);

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
      .overrideProvider(EmailSender)
      .useValue(capturingEmailSender)
      .overrideProvider(OAuthIdTokenVerifier)
      .useValue(oauthIdTokenVerifierMock)
      .overrideProvider(GoogleIdTokenVerifier)
      .useValue(oauthIdTokenVerifierMock)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get(PrismaService);
    envService = moduleRef.get(EnvService);
    userFactory = new UserFactory(prisma, moduleRef.get(HashGenerator));
    establishmentFactory = new EstablishmentFactory(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    capturingEmailSender.clear();
  });

  it("should send welcome email when registering an establishment", async () => {
    const payload = makeEstablishmentRegistrationPayload(9001);

    const response = await request(getHttpServer(app))
      .post("/register/establishment")
      .send(payload);

    expect(response.status).toBe(201);
    registerEstablishmentResponseSchema.parse(response.body);

    expect(capturingEmailSender.sent).toHaveLength(1);
    expect(capturingEmailSender.sent[0]?.to).toBe(payload.email);
    expect(capturingEmailSender.sent[0]?.subject).toBe(
      "Bem-vindo(a) à Clean Move",
    );
    expect(capturingEmailSender.sent[0]?.html).toContain("Olá, Maria");
    expect(capturingEmailSender.sent[0]?.html).toContain(
      `href="${new URL("/login", envService.get("FRONTEND_URL")).toString()}"`,
    );
    expect(capturingEmailSender.sent[0]?.text).toContain("Equipe Clean Move");
  });

  it("should not send welcome email when registering an employee", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    capturingEmailSender.clear();

    const response = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Employee User",
        email: "welcome-employee@example.com",
        password: "strong-password",
      });

    expect(response.status).toBe(201);
    employeeResponseSchema.parse(response.body);
    expect(capturingEmailSender.sent).toHaveLength(0);
  });

  it("should send welcome email when creating a new customer via OAuth", async () => {
    const response = await request(getHttpServer(app))
      .post("/auth/google")
      .send({
        idToken: "welcome-oauth-customer-token",
        role: "CUSTOMER",
      });

    expect(response.status).toBe(200);

    expect(capturingEmailSender.sent).toHaveLength(1);
    expect(capturingEmailSender.sent[0]?.to).toBe(
      "welcome-oauth-customer@example.com",
    );
    expect(capturingEmailSender.sent[0]?.subject).toBe(
      "Bem-vindo(a) à Clean Move",
    );
    expect(capturingEmailSender.sent[0]?.html).toContain("Olá, OAuth");
    expect(capturingEmailSender.sent[0]?.html).toContain("Boas-vindas");
  });
});
