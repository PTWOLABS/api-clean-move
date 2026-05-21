import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeAppointment } from "../../../../../tests/factories/appointment-factory";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { Employee } from "../../../employees/domain/entities/employee";
import { InMemoryAppointmentsRepository } from "../../../../../tests/repositories/in-memory-appointments-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { EstablishmentScopeService } from "../../services/establishment-scope";
import { ListAppointmentsUseCase } from "./list-appointments";

let inMemoryAppointmentsRepository: InMemoryAppointmentsRepository;
let inMemoryCustomersRepository: InMemoryCustomersRepository;
let inMemoryEmployeesRepository: InMemoryEmployeesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let establishmentScope: EstablishmentScopeService;
let sut: ListAppointmentsUseCase;

describe("List appointments", () => {
  beforeEach(() => {
    inMemoryCustomersRepository = new InMemoryCustomersRepository();
    inMemoryAppointmentsRepository = new InMemoryAppointmentsRepository(
      inMemoryCustomersRepository,
    );
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEmployeesRepository = new InMemoryEmployeesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );
    establishmentScope = new EstablishmentScopeService(
      inMemoryEstablishmentsRepository,
      inMemoryEmployeesRepository,
    );

    sut = new ListAppointmentsUseCase(
      inMemoryAppointmentsRepository,
      establishmentScope,
    );
  });

  it("should list appointments with establishment scoped filters", async () => {
    const establishment = makeEstablishment();
    const otherEstablishment = makeEstablishment();
    const customer = makeCustomer({
      establishmentId: establishment.id,
      nickname: "Mary",
    });
    const otherCustomer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
      plate: "ABC1D23",
    });
    const service = makeService({ establishmentId: establishment.id });
    const otherService = makeService({ establishmentId: establishment.id });
    const matchingAppointment = makeAppointment({
      establishmentId: establishment.id,
      customerId: customer.id,
      vehicleId: vehicle.id,
      services: [
        {
          serviceId: service.id,
          serviceName: service.serviceName.value,
          category: service.category,
          durationInMinutes: service.estimatedDuration?.upperBoundInMinutes,
          priceInCents: service.price.amountInCents,
        },
      ],

      vehicle: {
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        color: vehicle.color,
        year: vehicle.year,
      },
      startsAt: new Date("2026-04-27T10:00:00.000Z"),
      endsAt: null,
      status: "DONE",
    });
    const wrongStatusAppointment = makeAppointment({
      establishmentId: establishment.id,
      customerId: customer.id,
      vehicleId: vehicle.id,
      services: [
        {
          serviceId: service.id,
          serviceName: service.serviceName.value,
          category: service.category,
          durationInMinutes: service.estimatedDuration?.upperBoundInMinutes,
          priceInCents: service.price.amountInCents,
        },
      ],

      startsAt: new Date("2026-04-27T11:00:00.000Z"),
      endsAt: null,
      status: "SCHEDULED",
    });
    const wrongCustomerAppointment = makeAppointment({
      establishmentId: establishment.id,
      customerId: otherCustomer.id,
      services: [
        {
          serviceId: service.id,
          serviceName: service.serviceName.value,
          category: service.category,
          durationInMinutes: service.estimatedDuration?.upperBoundInMinutes,
          priceInCents: service.price.amountInCents,
        },
      ],

      startsAt: new Date("2026-04-27T12:00:00.000Z"),
      endsAt: null,
      status: "DONE",
    });
    const wrongServiceAppointment = makeAppointment({
      establishmentId: establishment.id,
      customerId: customer.id,
      services: [
        {
          serviceId: otherService.id,
          serviceName: otherService.serviceName.value,
          category: otherService.category,
          durationInMinutes:
            otherService.estimatedDuration?.upperBoundInMinutes,
          priceInCents: otherService.price.amountInCents,
        },
      ],

      startsAt: new Date("2026-04-27T13:00:00.000Z"),
      endsAt: null,
      status: "DONE",
    });
    const otherEstablishmentAppointment = makeAppointment({
      establishmentId: otherEstablishment.id,
      startsAt: new Date("2026-04-27T10:00:00.000Z"),
      endsAt: null,
      status: "DONE",
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEstablishmentsRepository.create(otherEstablishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryCustomersRepository.create(otherCustomer);
    await inMemoryAppointmentsRepository.create(matchingAppointment);
    await inMemoryAppointmentsRepository.create(wrongStatusAppointment);
    await inMemoryAppointmentsRepository.create(wrongCustomerAppointment);
    await inMemoryAppointmentsRepository.create(wrongServiceAppointment);
    await inMemoryAppointmentsRepository.create(otherEstablishmentAppointment);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      filters: {
        status: "DONE",
        customerId: customer.id.toString(),
        customerName: "maria",
        customerNickname: "mary",
        serviceId: service.id.toString(),
        serviceName: service.serviceName.value,
        vehicleId: vehicle.id.toString(),
        vehiclePlate: "abc-1d23",
        vehicleBrand: "toy",
        vehicleModel: "cor",
        search: "corolla",
        startsAt: new Date("2026-04-27T09:00:00.000Z"),
        endsAt: new Date("2026-04-27T10:30:00.000Z"),
      },
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.appointments).toEqual([matchingAppointment]);
  });

  it("should reject a missing establishment", async () => {
    const result = await sut.execute({
      actor: { userId: "missing-owner", role: "ESTABLISHMENT" },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should allow employee with read appointments feature", async () => {
    const establishment = makeEstablishment();
    const user = makeUser("EMPLOYEE");
    const employee = makeEmployee({
      establishmentId: establishment.id,
      userId: user.id,
    });
    const appointment = makeAppointment({
      establishmentId: establishment.id,
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEmployeesRepository.create(employee);
    await inMemoryAppointmentsRepository.create(appointment);

    const result = await sut.execute({
      actor: { userId: user.id.toString(), role: "EMPLOYEE" },
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.appointments).toEqual([appointment]);
  });

  it("should reject employee without read appointments feature", async () => {
    const user = makeUser("EMPLOYEE");
    const employee = Employee.restore({
      establishmentId: new UniqueEntityId(),
      userId: user.id,
      profileImageUrl: null,
      name: user.name,
      cpf: null,
      birthDate: null,
      features: [
        "read:services",
        "read:customers",
        "read:employees:self",
        "create:sessions:self",
        "read:sessions:self",
      ],
      deletedAt: null,
      createdAt: new Date("2026-05-05T10:00:00.000Z"),
      updatedAt: new Date("2026-05-05T10:00:00.000Z"),
    });
    const establishment = makeEstablishment(
      undefined,
      employee.establishmentId,
    );

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEmployeesRepository.create(employee);

    const result = await sut.execute({
      actor: { userId: user.id.toString(), role: "EMPLOYEE" },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });
});
