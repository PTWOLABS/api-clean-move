import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { EstablishmentScopeService } from "../../services/establishment-scope";
import { ListEstablishmentServicesUseCase } from "./list-establishment-services";
import { ServiceName } from "../../../catalog/domain/value-objects/service-name";
import { makeService } from "../../../../../tests/factories/service-factory";

let inMemoryServicesRepository: InMemoryServicesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryEmployeesRepository: InMemoryEmployeesRepository;
let establishmentScope: EstablishmentScopeService;
let sut: ListEstablishmentServicesUseCase;

describe("List establishment services (backoffice)", () => {
  beforeEach(() => {
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );
    inMemoryEmployeesRepository = new InMemoryEmployeesRepository();
    establishmentScope = new EstablishmentScopeService(
      inMemoryEstablishmentsRepository,
      inMemoryEmployeesRepository,
    );
    sut = new ListEstablishmentServicesUseCase(
      inMemoryServicesRepository,
      inMemoryEstablishmentsRepository,
      establishmentScope,
    );
  });

  it("should list services when establishment owner requests own establishment", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryServicesRepository.create(
      makeService({
        establishmentId: establishment.id,
        serviceName: ServiceName.create("Owned service"),
      }),
    );

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      establishmentId: establishment.id.toString(),
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.items).toHaveLength(1);
    expect(result.value.totalItems).toBe(1);
  });

  it("should list services when employee requests their establishment", async () => {
    const establishment = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryServicesRepository.create(
      makeService({
        establishmentId: establishment.id,
        serviceName: ServiceName.create("Employee service"),
      }),
    );

    const employeeUser = makeUser("EMPLOYEE");
    const employee = makeEmployee({
      userId: employeeUser.id,
      establishmentId: establishment.id,
    });
    await inMemoryEmployeesRepository.create(employee);

    const result = await sut.execute({
      actor: {
        userId: employeeUser.id.toString(),
        role: "EMPLOYEE",
      },
      establishmentId: establishment.id.toString(),
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.items).toHaveLength(1);
    expect(result.value.totalItems).toBe(1);
  });

  it("should return not found when establishment id does not exist", async () => {
    const owner = makeUser("ESTABLISHMENT");

    const result = await sut.execute({
      actor: {
        userId: owner.id.toString(),
        role: "ESTABLISHMENT",
      },
      establishmentId: "00000000-0000-4000-8000-000000000099",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject establishment owner listing another establishment", async () => {
    const ownerA = makeUser("ESTABLISHMENT");
    const ownerB = makeUser("ESTABLISHMENT");
    const establishmentA = makeEstablishment({ ownerId: ownerA.id });
    const establishmentB = makeEstablishment({ ownerId: ownerB.id });
    await inMemoryEstablishmentsRepository.create(establishmentA);
    await inMemoryEstablishmentsRepository.create(establishmentB);

    const result = await sut.execute({
      actor: {
        userId: ownerA.id.toString(),
        role: "ESTABLISHMENT",
      },
      establishmentId: establishmentB.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should reject employee listing another establishment", async () => {
    const establishmentA = makeEstablishment();
    const establishmentB = makeEstablishment();
    await inMemoryEstablishmentsRepository.create(establishmentA);
    await inMemoryEstablishmentsRepository.create(establishmentB);

    const employeeUser = makeUser("EMPLOYEE");
    const employee = makeEmployee({
      userId: employeeUser.id,
      establishmentId: establishmentA.id,
    });
    await inMemoryEmployeesRepository.create(employee);

    const result = await sut.execute({
      actor: {
        userId: employeeUser.id.toString(),
        role: "EMPLOYEE",
      },
      establishmentId: establishmentB.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });
});
