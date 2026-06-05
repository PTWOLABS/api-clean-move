import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

import { UserFactory } from "../../../../tests/factories/user-factory";
import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import {
  getHttpServer,
  loginUser,
} from "../../../../tests/helpers/auth-session.e2e-helpers";

const updateUserResponseSchema = z.object({
  user: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    role: z.enum(["CUSTOMER", "ESTABLISHMENT", "ADMIN", "EMPLOYEE"]),
    profileImageUrl: z.string().nullable(),
    phone: z.string().nullable(),
    address: z
      .object({
        street: z.string(),
        complement: z.string().nullable(),
        country: z.string(),
        state: z.string(),
        zipCode: z.string(),
        city: z.string(),
      })
      .nullable(),
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

const messageResponseSchema = z.object({
  message: z.union([z.string(), z.array(z.string())]),
});

describe("UpdateUserController (e2e)", () => {
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

  async function loginEstablishmentOwner() {
    const { user, plainPassword } = await userFactory.makePrismaUser({
      role: "ESTABLISHMENT",
      plainPassword: "strong-password",
    });

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

    return { accessToken: loginBody.accessToken };
  }

  it("should update user name with PATCH /user/me", async () => {
    const { accessToken } = await loginEstablishmentOwner();

    const response = await request(getHttpServer(app))
      .patch("/user/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Novo Nome" });

    expect(response.status).toBe(200);
    const body = updateUserResponseSchema.parse(response.body);
    expect(body.user.name).toBe("Novo Nome");
  });

  it("should return 400 for empty body", async () => {
    const { accessToken } = await loginEstablishmentOwner();

    const response = await request(getHttpServer(app))
      .patch("/user/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(400);
    messageResponseSchema.parse(response.body);
  });

  it("should return 400 when profileImageUrl is sent", async () => {
    const { accessToken } = await loginEstablishmentOwner();

    const response = await request(getHttpServer(app))
      .patch("/user/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ profileImageUrl: "https://example.com/avatar.png" });

    expect(response.status).toBe(400);
  });

  it("should return 400 when establishment block is sent", async () => {
    const { accessToken } = await loginEstablishmentOwner();

    const response = await request(getHttpServer(app))
      .patch("/user/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ establishment: { tradeName: "Fail" } });

    expect(response.status).toBe(400);
    messageResponseSchema.parse(response.body);
  });
});
