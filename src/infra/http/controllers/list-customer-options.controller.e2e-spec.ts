import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CustomerFactory } from "../../../../tests/factories/customer-factory";
import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import {
  customerOptionsResponseSchema,
  makeCustomerAuth,
  makeEstablishmentAuth,
} from "../../../../tests/helpers/establishment-operated-scheduling.e2e-helpers";
import {
  getHttpServer,
  makeEmployeeAuth,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

describe("ListCustomerOptionsController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userFactory: UserFactory;
  let establishmentFactory: EstablishmentFactory;
  let customerFactory: CustomerFactory;
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
    customerFactory = new CustomerFactory(prisma);
    envService = moduleRef.get(EnvService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should list active customer options with search, limit, and minimal shape", async () => {
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
    const firstCustomer = await customerFactory.makePrismaCustomer({
      establishmentId: firstOwner.establishment.id,
      fullName: "Ana Carolina",
      nickname: null,
    });
    const secondCustomer = await customerFactory.makePrismaCustomer({
      establishmentId: firstOwner.establishment.id,
      fullName: "Beatriz Souza",
      nickname: "Ana B",
      cpfCnpj: null,
    });
    const thirdCustomer = await customerFactory.makePrismaCustomer({
      establishmentId: firstOwner.establishment.id,
      fullName: "Camila Rocha",
      nickname: "Ana C",
      cpfCnpj: null,
    });
    const deletedCustomer = await customerFactory.makePrismaCustomer({
      establishmentId: firstOwner.establishment.id,
      fullName: "Ana Removida",
      cpfCnpj: null,
    });

    await customerFactory.makePrismaCustomer({
      establishmentId: secondOwner.establishment.id,
      fullName: "Ana Outside",
      cpfCnpj: null,
    });
    await prisma.customer.update({
      where: {
        id: deletedCustomer.id.toString(),
      },
      data: {
        deletedAt: new Date(),
      },
    });

    const response = await request(getHttpServer(app))
      .get("/customers/options")
      .set("Authorization", `Bearer ${firstOwner.accessToken}`)
      .query({ search: "ana", limit: 2 });
    const body = customerOptionsResponseSchema.parse(response.body);

    expect(response.status).toBe(200);
    expect(body.customers).toEqual([
      {
        id: firstCustomer.id.toString(),
        label: "Ana Carolina",
      },
      {
        id: secondCustomer.id.toString(),
        label: "Beatriz Souza",
      },
    ]);
    expect(body.customers.map((customer) => customer.id)).not.toContain(
      thirdCustomer.id.toString(),
    );
    expect(body.customers.map((customer) => customer.id)).not.toContain(
      deletedCustomer.id.toString(),
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
    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: owner.establishment.id,
      fullName: "Maria Silva",
      cpfCnpj: null,
    });

    const response = await request(getHttpServer(app))
      .get("/customers/options")
      .set("Authorization", `Bearer ${employee.accessToken}`);

    expect(response.status).toBe(200);
    const body = customerOptionsResponseSchema.parse(response.body);

    expect(body.customers).toEqual([
      {
        id: customer.id.toString(),
        label: "Maria Silva",
      },
    ]);
  });

  it("should enforce authentication, roles, and employee read customer feature", async () => {
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
    const employeeWithoutReadCustomers = await makeEmployeeAuth({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      establishment: owner.establishment,
    });

    await prisma.employee.update({
      where: {
        id: employeeWithoutReadCustomers.employee.id.toString(),
      },
      data: {
        features: [
          "read:appointments",
          "read:services",
          "read:employees:self",
          "create:sessions:self",
          "read:sessions:self",
        ],
      },
    });

    const noTokenResponse = await request(getHttpServer(app)).get(
      "/customers/options",
    );
    const invalidTokenResponse = await request(getHttpServer(app))
      .get("/customers/options")
      .set("Authorization", "Bearer invalid-token");
    const customerRoleResponse = await request(getHttpServer(app))
      .get("/customers/options")
      .set("Authorization", `Bearer ${customerRole.accessToken}`);
    const employeeWithoutFeatureResponse = await request(getHttpServer(app))
      .get("/customers/options")
      .set(
        "Authorization",
        `Bearer ${employeeWithoutReadCustomers.accessToken}`,
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
      .get("/customers/options")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .query({ limit: 0 });

    expect(response.status).toBe(400);
  });
});
