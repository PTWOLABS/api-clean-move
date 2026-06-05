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
import { EnvService } from "../../env/env.service";
import {
  getHttpServer,
  loginUser,
  makeEmployeeAuth,
  makeEstablishmentAuth,
} from "../../../../tests/helpers/auth-session.e2e-helpers";

const establishmentResponseSchema = z.object({
  establishment: z.object({
    id: z.uuid(),
    tradeName: z.string().nullable(),
    legalBusinessName: z.string().nullable(),
    cnpj: z.string().nullable(),
    slug: z.string().nullable(),
  }),
});

const messageResponseSchema = z.object({
  message: z.union([z.string(), z.array(z.string())]),
});

describe("UpdateEstablishmentController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hashGenerator: HashGenerator;
  let userFactory: UserFactory;
  let establishmentFactory: EstablishmentFactory;
  let envService: EnvService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

  it("should update commercial fields for oauth draft establishment owner", async () => {
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
      .patch(`/establishments/${establishment.id.toString()}`)
      .set("Authorization", `Bearer ${loginBody.accessToken}`)
      .send({
        tradeName: "Clean Move",
        legalBusinessName: "Clean Move Servicos LTDA",
        cnpj: "61911322000187",
        slug: "clean-move",
      });

    expect(response.status).toBe(200);

    const body = establishmentResponseSchema.parse(response.body);
    expect(body.establishment.tradeName).toBe("Clean Move");
    expect(body.establishment.legalBusinessName).toBe(
      "Clean Move Servicos LTDA",
    );
    expect(body.establishment.cnpj).toBe("61911322000187");
    expect(body.establishment.slug).toBe("clean-move");
  });

  it("should return 400 for empty body", async () => {
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
      .patch(`/establishments/${establishment.id.toString()}`)
      .set("Authorization", `Bearer ${loginBody.accessToken}`)
      .send({});

    expect(response.status).toBe(400);
    messageResponseSchema.parse(response.body);
  });

  it("should return 403 when owner tries to update another establishment", async () => {
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
      .patch(`/establishments/${otherEstablishment.id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tradeName: "Should Fail" });

    expect(response.status).toBe(403);
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
      .patch("/establishments/00000000-0000-4000-8000-000000000099")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tradeName: "Fail" });

    expect(response.status).toBe(404);
  });

  it("should return 409 when cnpj is already in use", async () => {
    const first = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const second = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const existingCnpj = first.establishment.cnpj?.toString();
    expect(existingCnpj).toBeTruthy();

    const response = await request(getHttpServer(app))
      .patch(`/establishments/${second.establishment.id.toString()}`)
      .set("Authorization", `Bearer ${second.accessToken}`)
      .send({ cnpj: existingCnpj });

    expect(response.status).toBe(409);
  });

  it("should return 403 for employee role", async () => {
    const { accessToken, establishment } = await makeEmployeeAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
    });

    const response = await request(getHttpServer(app))
      .patch(`/establishments/${establishment.id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tradeName: "Employee Fail" });

    expect(response.status).toBe(403);
  });
});
