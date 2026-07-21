import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  makeCustomerAuth,
  makeEstablishmentAuth,
  serviceCategoryOptionsResponseSchema,
} from "../../../../tests/helpers/establishment-operated-scheduling.e2e-helpers";
import { seedServiceCategory } from "../../../../tests/helpers/service-category-seed";
import {
  getHttpServer,
  makeEmployeeAuth,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

describe("ListServiceCategoryOptionsController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
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
    userFactory = new UserFactory(prisma, moduleRef.get(HashGenerator));
    establishmentFactory = new EstablishmentFactory(prisma);
    envService = moduleRef.get(EnvService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should list active category options with search, page, size, and totalItems", async () => {
    const firstOwner = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const secondOwner = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const firstCategory = await seedServiceCategory(
      prisma,
      firstOwner.establishment.id.toString(),
      "Opt Alpha",
    );
    const secondCategory = await seedServiceCategory(
      prisma,
      firstOwner.establishment.id.toString(),
      "Opt Beta",
    );
    const thirdCategory = await seedServiceCategory(
      prisma,
      firstOwner.establishment.id.toString(),
      "Opt Gamma",
    );
    const deletedCategory = await seedServiceCategory(
      prisma,
      firstOwner.establishment.id.toString(),
      "Opt Deleted",
    );

    await seedServiceCategory(
      prisma,
      secondOwner.establishment.id.toString(),
      "Opt Outside",
    );
    await prisma.serviceCategory.update({
      where: {
        id: deletedCategory.id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    const response = await request(getHttpServer(app))
      .get("/service-categories/options")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .query({ search: "opt", size: 2 });
    const body = serviceCategoryOptionsResponseSchema.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.categories).toEqual([
      {
        id: firstCategory.id,
        label: "Opt Alpha",
      },
      {
        id: secondCategory.id,
        label: "Opt Beta",
      },
    ]);
    expect(body.totalItems).toBe(3);
    expect(body.categories.map((category) => category.id)).not.toContain(
      thirdCategory.id,
    );
    expect(body.categories.map((category) => category.id)).not.toContain(
      deletedCategory.id,
    );

    const secondPageResponse = await request(getHttpServer(app))
      .get("/service-categories/options")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .query({ search: "opt", page: 2, size: 2 });
    const secondPageBody = serviceCategoryOptionsResponseSchema.parse(
      secondPageResponse.body,
    );

    expect(secondPageResponse.status).toBe(200);
    expect(secondPageBody.categories).toEqual([
      {
        id: thirdCategory.id,
        label: "Opt Gamma",
      },
    ]);
    expect(secondPageBody.totalItems).toBe(3);
  });

  it("should enforce authentication and establishment role only", async () => {
    const owner = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const customerRole = await makeCustomerAuth({
      app,
      prisma,
      userFactory,
    });
    const employee = await makeEmployeeAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      establishment: owner.establishment,
    });

    const noTokenResponse = await request(getHttpServer(app)).get(
      "/service-categories/options",
    );
    const invalidTokenResponse = await request(getHttpServer(app))
      .get("/service-categories/options")
      .set("Authorization", "Bearer invalid-token");
    const customerRoleResponse = await request(getHttpServer(app))
      .get("/service-categories/options")
      .set("Authorization", `Bearer ${customerRole.accessToken}`);
    const employeeResponse = await request(getHttpServer(app))
      .get("/service-categories/options")
      .set("Authorization", `Bearer ${employee.accessToken}`);

    expect(noTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.status).toBe(401);
    expect(customerRoleResponse.status).toBe(403);
    expect(employeeResponse.status).toBe(403);
  });

  it("should reject invalid query params", async () => {
    const owner = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const invalidSizeResponse = await request(getHttpServer(app))
      .get("/service-categories/options")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .query({ size: 0 });
    const invalidPageResponse = await request(getHttpServer(app))
      .get("/service-categories/options")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .query({ page: 0 });

    expect(invalidSizeResponse.status).toBe(400);
    expect(invalidPageResponse.status).toBe(400);
  });
});
