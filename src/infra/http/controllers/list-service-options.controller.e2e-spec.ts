import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { ServiceFactory } from "../../../../tests/factories/service-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  makeCustomerAuth,
  makeEstablishmentAuth,
  serviceOptionsResponseSchema,
} from "../../../../tests/helpers/establishment-operated-scheduling.e2e-helpers";
import {
  getHttpServer,
  makeEmployeeAuth,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { ServiceName } from "../../../modules/catalog/domain/value-objects/service-name";
import { ServicePriceSpecification } from "../../../modules/catalog/domain/value-objects/service-price-specification";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

describe("ListServiceOptionsController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userFactory: UserFactory;
  let establishmentFactory: EstablishmentFactory;
  let serviceFactory: ServiceFactory;
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
    serviceFactory = new ServiceFactory(prisma);
    envService = moduleRef.get(EnvService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should list active service options with search, limit, and minimal shape", async () => {
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
    const firstService = await serviceFactory.makePrismaService({
      establishmentId: firstOwner.establishment.id,
      serviceName: ServiceName.create("Lavagem Completa"),
    });
    const secondService = await serviceFactory.makePrismaService({
      establishmentId: firstOwner.establishment.id,
      serviceName: ServiceName.create("Lavagem Simples"),
    });
    const thirdService = await serviceFactory.makePrismaService({
      establishmentId: firstOwner.establishment.id,
      serviceName: ServiceName.create("Lavagem Premium"),
    });
    const descriptionOnlyMatch = await serviceFactory.makePrismaService({
      establishmentId: firstOwner.establishment.id,
      serviceName: ServiceName.create("Polimento Tecnico"),
      description: "Lavagem descrita apenas no texto.",
    });
    const inactiveService = await serviceFactory.makePrismaService({
      establishmentId: firstOwner.establishment.id,
      serviceName: ServiceName.create("Lavagem Inativa"),
      isActive: false,
    });
    const deletedService = await serviceFactory.makePrismaService({
      establishmentId: firstOwner.establishment.id,
      serviceName: ServiceName.create("Lavagem Removida"),
    });

    await serviceFactory.makePrismaService({
      establishmentId: secondOwner.establishment.id,
      serviceName: ServiceName.create("Lavagem Externa"),
    });
    await prisma.service.update({
      where: {
        id: deletedService.id.toString(),
      },
      data: {
        deletedAt: new Date(),
      },
    });

    const response = await request(getHttpServer(app))
      .get("/services/options")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .query({ search: "lavagem", limit: 2 });
    const body = serviceOptionsResponseSchema.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.services).toEqual([
      {
        id: firstService.id.toString(),
        label: "Lavagem Completa",
        priceInCents: 30000,
        priceSpecification: {
          type: "FIXED",
          fixedPriceInCents: 30000,
        },
      },
      {
        id: thirdService.id.toString(),
        label: "Lavagem Premium",
        priceInCents: 30000,
        priceSpecification: {
          type: "FIXED",
          fixedPriceInCents: 30000,
        },
      },
    ]);
    expect(body.services.map((service) => service.id)).not.toContain(
      secondService.id.toString(),
    );
    expect(body.services.map((service) => service.id)).not.toContain(
      descriptionOnlyMatch.id.toString(),
    );
    expect(body.services.map((service) => service.id)).not.toContain(
      inactiveService.id.toString(),
    );
    expect(body.services.map((service) => service.id)).not.toContain(
      deletedService.id.toString(),
    );
  });

  it("should allow employee scope", async () => {
    const owner = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const employee = await makeEmployeeAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      establishment: owner.establishment,
    });
    const service = await serviceFactory.makePrismaService({
      establishmentId: owner.establishment.id,
      serviceName: ServiceName.create("Lavagem Simples"),
    });

    const response = await request(getHttpServer(app))
      .get("/services/options")
      .set("Authorization", `Bearer ${employee.accessToken}`);
    const body = serviceOptionsResponseSchema.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.services).toEqual([
      {
        id: service.id.toString(),
        label: "Lavagem Simples",
        priceInCents: 30000,
        priceSpecification: {
          type: "FIXED",
          fixedPriceInCents: 30000,
        },
      },
    ]);
  });

  it("should return range price specification for services with range pricing", async () => {
    const owner = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });
    const rangeService = await serviceFactory.makePrismaService({
      establishmentId: owner.establishment.id,
      serviceName: ServiceName.create("Polimento Premium"),
      priceSpecification: ServicePriceSpecification.create({
        type: "RANGE",
        minPriceInCents: 30000,
        maxPriceInCents: 60000,
      }),
    });

    const response = await request(getHttpServer(app))
      .get("/services/options")
      .set("Authorization", `Bearer ${owner.accessToken}`);
    const body = serviceOptionsResponseSchema.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.services).toEqual([
      {
        id: rangeService.id.toString(),
        label: "Polimento Premium",
        priceInCents: 30000,
        priceSpecification: {
          type: "RANGE",
          minPriceInCents: 30000,
          maxPriceInCents: 60000,
        },
      },
    ]);
  });

  it("should enforce authentication, roles, and employee read services feature", async () => {
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
    const employeeWithoutReadServices = await makeEmployeeAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      establishment: owner.establishment,
    });

    await prisma.employee.update({
      where: {
        id: employeeWithoutReadServices.employee.id.toString(),
      },
      data: {
        features: [
          "read:appointments",
          "read:customers",
          "read:employees:self",
          "create:sessions:self",
          "read:sessions:self",
        ],
      },
    });

    const noTokenResponse = await request(getHttpServer(app)).get(
      "/services/options",
    );
    const invalidTokenResponse = await request(getHttpServer(app))
      .get("/services/options")
      .set("Authorization", "Bearer invalid-token");
    const customerRoleResponse = await request(getHttpServer(app))
      .get("/services/options")
      .set("Authorization", `Bearer ${customerRole.accessToken}`);
    const employeeWithoutFeatureResponse = await request(getHttpServer(app))
      .get("/services/options")
      .set(
        "Authorization",
        `Bearer ${employeeWithoutReadServices.accessToken}`,
      );

    expect(noTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.status).toBe(401);
    expect(customerRoleResponse.status).toBe(403);
    expect(employeeWithoutFeatureResponse.status).toBe(403);
  });

  it("should reject invalid query params", async () => {
    const owner = await makeEstablishmentAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const response = await request(getHttpServer(app))
      .get("/services/options")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .query({ limit: 0 });

    expect(response.status).toBe(400);
  });
});
