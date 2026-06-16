import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { ServiceName } from "../../../catalog/domain/value-objects/service-name";
import { ServicePriceSpecification } from "../../../catalog/domain/value-objects/service-price-specification";
import { EstablishmentScopeService } from "../../services/establishment-scope";
import { ListServiceOptionsUseCase } from "./list-service-options";

let inMemoryServicesRepository: InMemoryServicesRepository;
let inMemoryEmployeesRepository: InMemoryEmployeesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let establishmentScope: EstablishmentScopeService;
let sut: ListServiceOptionsUseCase;

describe("List service options", () => {
  beforeEach(() => {
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEmployeesRepository = new InMemoryEmployeesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );
    establishmentScope = new EstablishmentScopeService(
      inMemoryEstablishmentsRepository,
      inMemoryEmployeesRepository,
    );

    sut = new ListServiceOptionsUseCase(
      inMemoryServicesRepository,
      establishmentScope,
    );
  });

  it("should list active service options matching service name", async () => {
    const establishment = makeEstablishment();
    const otherEstablishment = makeEstablishment();
    const firstService = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Lavagem Completa"),
    });
    const secondService = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Lavagem Simples"),
    });
    const thirdService = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Polimento Tecnico"),
      description: "Lavagem descrita apenas no texto.",
    });
    const inactiveService = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Lavagem Inativa"),
      isActive: false,
    });
    const deletedService = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Lavagem Removida"),
    });
    const otherService = makeService({
      establishmentId: otherEstablishment.id,
      serviceName: ServiceName.create("Lavagem Externa"),
    });

    deletedService.softDelete(new Date("2026-05-26T10:00:00.000Z"));

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEstablishmentsRepository.create(otherEstablishment);
    await inMemoryServicesRepository.create(firstService);
    await inMemoryServicesRepository.create(secondService);
    await inMemoryServicesRepository.create(thirdService);
    await inMemoryServicesRepository.create(inactiveService);
    await inMemoryServicesRepository.create(deletedService);
    await inMemoryServicesRepository.create(otherService);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      search: "lavagem",
      limit: 2,
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.services).toEqual([
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
        id: secondService.id.toString(),
        label: "Lavagem Simples",
        priceInCents: 30000,
        priceSpecification: {
          type: "FIXED",
          fixedPriceInCents: 30000,
        },
      },
    ]);
  });

  it("should include price specification details for non-fixed services", async () => {
    const establishment = makeEstablishment();
    const rangeService = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Polimento Premium"),
      priceSpecification: ServicePriceSpecification.create({
        type: "RANGE",
        minPriceInCents: 30000,
        maxPriceInCents: 60000,
      }),
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryServicesRepository.create(rangeService);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.services).toEqual([
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

  it("should allow employee scope", async () => {
    const establishment = makeEstablishment();
    const user = makeUser("EMPLOYEE");
    const employee = makeEmployee({
      establishmentId: establishment.id,
      userId: user.id,
    });
    const service = makeService({
      establishmentId: establishment.id,
      serviceName: ServiceName.create("Lavagem Simples"),
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEmployeesRepository.create(employee);
    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      actor: { userId: user.id.toString(), role: "EMPLOYEE" },
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.services).toEqual([
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

  it("should reject a missing establishment", async () => {
    const result = await sut.execute({
      actor: { userId: "missing-owner", role: "ESTABLISHMENT" },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
