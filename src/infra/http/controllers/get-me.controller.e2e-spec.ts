import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get(PrismaService);
    hashGenerator = moduleRef.get(HashGenerator);
    userFactory = new UserFactory(prisma, hashGenerator);
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
  });
});
