import { describe, expect, it, beforeEach } from "vitest";

import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import type { EnvService } from "../../../../infra/env/env.service";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { FakeObjectStorage } from "../../../../../tests/helpers/fake-object-storage";
import { UploadDomainImageUseCase } from "./upload-domain-image";

describe("UploadDomainImageUseCase", () => {
  let sut: UploadDomainImageUseCase;
  let envService: Pick<EnvService, "get">;
  let objectStorage: FakeObjectStorage;
  let establishmentsRepository: InMemoryEstablishmentsRepository;
  let employeesRepository: InMemoryEmployeesRepository;
  let customersRepository: InMemoryCustomersRepository;
  let vehiclesRepository: InMemoryCustomerVehiclesRepository;

  beforeEach(() => {
    envService = {
      get(key) {
        if (key === "AWS_S3_PUBLIC_BASE_URL") {
          return "https://cdn.example.com";
        }

        throw new Error(`Unexpected env key: ${String(key)}`);
      },
    } as EnvService;

    objectStorage = new FakeObjectStorage();
    const servicesRepository = new InMemoryServicesRepository();
    establishmentsRepository = new InMemoryEstablishmentsRepository(
      servicesRepository,
    );
    employeesRepository = new InMemoryEmployeesRepository();
    customersRepository = new InMemoryCustomersRepository();
    vehiclesRepository = new InMemoryCustomerVehiclesRepository();

    sut = new UploadDomainImageUseCase(
      envService as EnvService,
      objectStorage,
      establishmentsRepository,
      employeesRepository,
      customersRepository,
      vehiclesRepository,
    );
  });

  it("should upload employee profile image and persist URL", async () => {
    const ownerId = new UniqueEntityId();
    const establishment = makeEstablishment({ ownerId });
    await establishmentsRepository.create(establishment);

    const employee = makeEmployee({
      establishmentId: establishment.id,
    });
    await employeesRepository.create(employee);

    const file = {
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      mimetype: "image/jpeg",
      originalname: "photo.jpg",
    };

    const result = await sut.execute({
      establishmentOwnerId: ownerId.toString(),
      kind: "EMPLOYEE_PROFILE",
      entityId: employee.id.toString(),
      file,
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.url).toMatch(
        /^https:\/\/cdn\.example\.com\/employee-profile\//,
      );
      expect(result.value.objectKey).toMatch(
        /^employee-profile\/.+\/photo\.jpg$/,
      );
    }

    expect(objectStorage.puts).toHaveLength(1);
    expect(objectStorage.puts[0]?.contentType).toBe("image/jpeg");

    const saved = await employeesRepository.findByIdAndEstablishmentId(
      employee.id.toString(),
      establishment.id.toString(),
    );
    expect(saved?.profileImageUrl).toBe(
      result.isRight() ? result.value.url : null,
    );
  });

  it("should reject unsupported mime type", async () => {
    const ownerId = new UniqueEntityId();
    const establishment = makeEstablishment({ ownerId });
    await establishmentsRepository.create(establishment);

    const result = await sut.execute({
      establishmentOwnerId: ownerId.toString(),
      kind: "ESTABLISHMENT_BANNER",
      entityId: establishment.id.toString(),
      file: {
        buffer: Buffer.from("x"),
        mimetype: "application/pdf",
        originalname: "doc.pdf",
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(objectStorage.puts).toHaveLength(0);
  });

  it("should return not found when employee belongs to another establishment", async () => {
    const ownerId = new UniqueEntityId();
    const establishment = makeEstablishment({ ownerId });
    await establishmentsRepository.create(establishment);

    const otherEstablishment = makeEstablishment({});
    const employee = makeEmployee({
      establishmentId: otherEstablishment.id,
    });
    await employeesRepository.create(employee);

    const result = await sut.execute({
      establishmentOwnerId: ownerId.toString(),
      kind: "EMPLOYEE_PROFILE",
      entityId: employee.id.toString(),
      file: {
        buffer: Buffer.from([0xff, 0xd8, 0xff]),
        mimetype: "image/jpeg",
        originalname: "a.jpg",
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(objectStorage.puts).toHaveLength(0);
    if (result.isLeft()) {
      expect(result.value).toBeInstanceOf(ResourceNotFoundError);
    }
  });

  it("should persist vehicle image URL", async () => {
    const ownerId = new UniqueEntityId();
    const establishment = makeEstablishment({ ownerId });
    await establishmentsRepository.create(establishment);

    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
    });
    await vehiclesRepository.create(vehicle);

    const result = await sut.execute({
      establishmentOwnerId: ownerId.toString(),
      kind: "VEHICLE",
      entityId: vehicle.id.toString(),
      file: {
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        mimetype: "image/png",
        originalname: "car.png",
      },
    });

    expect(result.isRight()).toBe(true);
    if (!result.isRight()) {
      return;
    }

    const saved = await vehiclesRepository.findByIdAndEstablishmentId(
      vehicle.id.toString(),
      establishment.id.toString(),
    );
    expect(saved?.imageUrl).toBe(result.value.url);
  });

  it("should persist customer profile image URL", async () => {
    const ownerId = new UniqueEntityId();
    const establishment = makeEstablishment({ ownerId });
    await establishmentsRepository.create(establishment);

    const customer = makeCustomer({
      establishmentId: establishment.id,
    });
    await customersRepository.create(customer);

    const result = await sut.execute({
      establishmentOwnerId: ownerId.toString(),
      kind: "CUSTOMER_PROFILE",
      entityId: customer.id.toString(),
      file: {
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        mimetype: "image/png",
        originalname: "customer.png",
      },
    });

    expect(result.isRight()).toBe(true);
    if (!result.isRight()) {
      return;
    }

    const saved = await customersRepository.findByIdAndEstablishmentId(
      customer.id.toString(),
      establishment.id.toString(),
    );
    expect(saved?.profileImageUrl).toBe(result.value.url);
  });

  it("should forbid banner upload when entity id is not the owner establishment", async () => {
    const ownerId = new UniqueEntityId();
    const establishment = makeEstablishment({ ownerId });
    await establishmentsRepository.create(establishment);

    const other = makeEstablishment({});
    await establishmentsRepository.create(other);

    const result = await sut.execute({
      establishmentOwnerId: ownerId.toString(),
      kind: "ESTABLISHMENT_BANNER",
      entityId: other.id.toString(),
      file: {
        buffer: Buffer.from([0xff, 0xd8, 0xff]),
        mimetype: "image/jpeg",
        originalname: "b.jpg",
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(objectStorage.puts).toHaveLength(0);
  });

  it("should not upload vehicle image when customer id does not match vehicle owner", async () => {
    const ownerId = new UniqueEntityId();
    const establishment = makeEstablishment({ ownerId });
    await establishmentsRepository.create(establishment);

    const customerA = makeCustomer({
      establishmentId: establishment.id,
    });
    const customerB = makeCustomer({
      establishmentId: establishment.id,
    });
    await customersRepository.create(customerA);
    await customersRepository.create(customerB);

    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customerA.id,
    });
    await vehiclesRepository.create(vehicle);

    const result = await sut.execute({
      establishmentOwnerId: ownerId.toString(),
      kind: "VEHICLE",
      entityId: vehicle.id.toString(),
      customerId: customerB.id.toString(),
      file: {
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        mimetype: "image/png",
        originalname: "mismatch.png",
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(objectStorage.puts).toHaveLength(0);
    if (result.isLeft()) {
      expect(result.value).toBeInstanceOf(ResourceNotFoundError);
    }
  });
});
