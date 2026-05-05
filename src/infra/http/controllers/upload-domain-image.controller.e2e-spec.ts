import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import z from "zod";

import { ObjectStorage } from "../../../modules/application/repositories/object-storage";
import { CustomerFactory } from "../../../../tests/factories/customer-factory";
import { EstablishmentFactory } from "../../../../tests/factories/establishment-factory";
import { UserFactory } from "../../../../tests/factories/user-factory";
import { FakeObjectStorage } from "../../../../tests/helpers/fake-object-storage";
import {
  getHttpServer,
  makeEstablishmentAccessToken,
} from "../../../../tests/helpers/auth-session.e2e-helpers";
import { HashGenerator } from "../../../modules/application/repositories/hash-generator";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EnvService } from "../../env/env.service";

const uploadResponseSchema = z.object({
  url: z.url(),
  objectKey: z.string().min(1),
});

const employeeResponseSchema = z.object({
  employee: z.object({
    id: z.uuid(),
  }),
});

const vehicleResponseSchema = z.object({
  vehicle: z.object({
    id: z.uuid(),
  }),
});

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("UploadDomainImageController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userFactory: UserFactory;
  let establishmentFactory: EstablishmentFactory;
  let customerFactory: CustomerFactory;
  let envService: EnvService;
  let fakeObjectStorage: FakeObjectStorage;

  beforeAll(async () => {
    fakeObjectStorage = new FakeObjectStorage();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ObjectStorage)
      .useValue(fakeObjectStorage)
      .compile();

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

  it("should upload employee profile image", async () => {
    const { accessToken } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const registerResponse = await request(getHttpServer(app))
      .post("/employees")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Photo Employee",
        email: "photo-employee-upload@example.com",
        password: "StrongPass1!",
      });

    expect(registerResponse.status).toBe(201);
    const registerBody = employeeResponseSchema.parse(registerResponse.body);
    const employeeId = registerBody.employee.id;

    const uploadResponse = await request(getHttpServer(app))
      .post(`/employees/${employeeId}/profile-image`)
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", tinyPng, "avatar.png");

    expect(uploadResponse.status).toBe(201);
    const body = uploadResponseSchema.parse(uploadResponse.body);
    expect(body.url).toContain("employee-profile");
    expect(fakeObjectStorage.puts).toHaveLength(1);
    expect(fakeObjectStorage.puts[0]?.contentType).toBe("image/png");

    const row = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    expect(row?.profileImageUrl).toBe(body.url);
  });

  it("should upload establishment banner when entity id matches", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const uploadResponse = await request(getHttpServer(app))
      .post(`/establishments/${establishment.id.toString()}/banner-image`)
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", tinyPng, "banner.png");

    expect(uploadResponse.status).toBe(201);
    const body = uploadResponseSchema.parse(uploadResponse.body);

    const row = await prisma.establishment.findUnique({
      where: { id: establishment.id.toString() },
    });
    expect(row?.bannerImageUrl).toBe(body.url);
  });

  it("should upload vehicle image", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });

    const vehicleResponse = await request(getHttpServer(app))
      .post(`/customers/${customer.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        plate: "xyz9k88",
        brand: "Honda",
        model: "Civic",
        color: "Black",
        year: 2020,
        notes: null,
      });

    expect(vehicleResponse.status).toBe(201);
    const vehicleBody = vehicleResponseSchema.parse(vehicleResponse.body);
    const vehicleId = vehicleBody.vehicle.id;

    const uploadResponse = await request(getHttpServer(app))
      .post(`/customers/${customer.id.toString()}/vehicles/${vehicleId}/image`)
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", tinyPng, "vehicle.png");

    expect(uploadResponse.status).toBe(201);
    const body = uploadResponseSchema.parse(uploadResponse.body);

    const row = await prisma.customerVehicle.findUnique({
      where: { id: vehicleId },
    });
    expect(row?.imageUrl).toBe(body.url);
  });

  it("should reject vehicle image upload when customerId does not match vehicle owner", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const customerA = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const customerB = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });

    const vehicleResponse = await request(getHttpServer(app))
      .post(`/customers/${customerA.id.toString()}/vehicles`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        plate: "abc1d23",
        brand: "Toyota",
        model: "Corolla",
        color: "Silver",
        year: 2022,
        notes: null,
      });

    expect(vehicleResponse.status).toBe(201);
    const vehicleBody = vehicleResponseSchema.parse(vehicleResponse.body);
    const vehicleId = vehicleBody.vehicle.id;

    const previousPuts = fakeObjectStorage.puts.length;
    const uploadResponse = await request(getHttpServer(app))
      .post(`/customers/${customerB.id.toString()}/vehicles/${vehicleId}/image`)
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", tinyPng, "vehicle-mismatch.png");

    expect(uploadResponse.status).toBe(404);
    expect(fakeObjectStorage.puts.length).toBe(previousPuts);

    const row = await prisma.customerVehicle.findUnique({
      where: { id: vehicleId },
    });
    expect(row?.imageUrl).toBeNull();
  });

  it("should upload customer profile image", async () => {
    const { accessToken, establishment } = await makeEstablishmentAccessToken({
      app,
      prisma,
      userFactory,
      establishmentFactory,
      envService,
    });

    const customer = await customerFactory.makePrismaCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });

    const uploadResponse = await request(getHttpServer(app))
      .post(`/customers/${customer.id.toString()}/profile-image`)
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", tinyPng, "customer.png");

    expect(uploadResponse.status).toBe(201);
    const body = uploadResponseSchema.parse(uploadResponse.body);

    const row = await prisma.customer.findUnique({
      where: { id: customer.id.toString() },
    });
    expect(row?.profileImageUrl).toBe(body.url);
  });
});
