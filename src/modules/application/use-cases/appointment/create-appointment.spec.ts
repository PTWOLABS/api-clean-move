import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryAppointmentsRepository } from "../../../../../tests/repositories/in-memory-appointments-repository";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { ServicePriceSpecification } from "../../../catalog/domain/value-objects/service-price-specification";
import { InvalidAppointmentInputError } from "../../../scheduling/domain/errors/invalid-appointment-input-error";
import { EstablishmentScopeService } from "../../services/establishment-scope";
import { CreateAppointmentUseCase } from "./create-appointment";

let inMemoryAppointmentsRepository: InMemoryAppointmentsRepository;
let inMemoryCustomersRepository: InMemoryCustomersRepository;
let inMemoryCustomerVehiclesRepository: InMemoryCustomerVehiclesRepository;
let inMemoryEmployeesRepository: InMemoryEmployeesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let establishmentScope: EstablishmentScopeService;
let sut: CreateAppointmentUseCase;

describe("Create appointment", () => {
  beforeEach(() => {
    inMemoryAppointmentsRepository = new InMemoryAppointmentsRepository();
    inMemoryCustomersRepository = new InMemoryCustomersRepository();
    inMemoryCustomerVehiclesRepository =
      new InMemoryCustomerVehiclesRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEmployeesRepository = new InMemoryEmployeesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );
    establishmentScope = new EstablishmentScopeService(
      inMemoryEstablishmentsRepository,
      inMemoryEmployeesRepository,
    );

    sut = new CreateAppointmentUseCase(
      inMemoryAppointmentsRepository,
      inMemoryCustomersRepository,
      inMemoryCustomerVehiclesRepository,
      establishmentScope,
      inMemoryServicesRepository,
    );
  });

  it("should create an appointment without endsAt", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const service = makeService({ establishmentId: establishment.id });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      customerId: customer.id.toString(),
      serviceIds: [service.id.toString()],
      startsAt: new Date("2026-04-27T10:00:00.000Z"),
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(inMemoryAppointmentsRepository.items[0]).toBe(
      result.value.appointment,
    );
    expect(result.value.appointment.endsAt).toBeNull();
    expect(result.value.appointment.status).toBe("SCHEDULED");
    expect(result.value.appointment.customer).toEqual({
      fullName: customer.fullName,
    });
    expect(result.value.appointment.services[0]?.serviceId).toEqual(service.id);
  });

  it("should create an appointment with vehicle snapshot", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const service = makeService({ establishmentId: establishment.id });
    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
      plate: "ABC1D23",
      brand: "Toyota",
      model: "Corolla",
      color: "Prata",
      year: 2022,
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryServicesRepository.create(service);
    await inMemoryCustomerVehiclesRepository.create(vehicle);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      customerId: customer.id.toString(),
      serviceIds: [service.id.toString()],
      vehicleId: vehicle.id.toString(),
      startsAt: new Date("2026-04-27T10:00:00.000Z"),
      endsAt: new Date("2026-04-27T11:00:00.000Z"),
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.appointment.vehicleId).toEqual(vehicle.id);
    expect(result.value.appointment.vehicle).toEqual({
      plate: "ABC1D23",
      brand: "Toyota",
      model: "Corolla",
      color: "Prata",
      year: 2022,
    });
  });

  it("should create an appointment with explicit service charged price", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const service = makeService({
      establishmentId: establishment.id,
      priceSpecification: ServicePriceSpecification.create({
        type: "STARTING_AT",
        minPriceInCents: 25000,
      }),
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      customerId: customer.id.toString(),
      services: [
        {
          serviceId: service.id.toString(),
          priceInCents: 35000,
        },
      ],
      startsAt: new Date("2026-06-16T12:00:00.000Z"),
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.appointment.services[0]?.priceInCents).toBe(35000);
    }
  });

  it("should reject an appointment service price outside the catalog policy", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const service = makeService({
      establishmentId: establishment.id,
      priceSpecification: ServicePriceSpecification.create({
        type: "RANGE",
        minPriceInCents: 30000,
        maxPriceInCents: 60000,
      }),
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      customerId: customer.id.toString(),
      services: [
        {
          serviceId: service.id.toString(),
          priceInCents: 60001,
        },
      ],
      startsAt: new Date("2026-06-16T12:00:00.000Z"),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidAppointmentInputError);
  });

  it("should reject a deleted customer", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const service = makeService({ establishmentId: establishment.id });
    customer.softDelete(new Date("2026-04-27T10:00:00.000Z"));

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      customerId: customer.id.toString(),
      serviceIds: [service.id.toString()],
      startsAt: new Date("2026-04-27T10:00:00.000Z"),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject a deleted vehicle", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const service = makeService({ establishmentId: establishment.id });
    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
    });
    vehicle.softDelete(new Date("2026-04-27T10:00:00.000Z"));

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryServicesRepository.create(service);
    await inMemoryCustomerVehiclesRepository.create(vehicle);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      customerId: customer.id.toString(),
      serviceIds: [service.id.toString()],
      vehicleId: vehicle.id.toString(),
      startsAt: new Date("2026-04-27T10:00:00.000Z"),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject a vehicle from another customer", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const anotherCustomer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const service = makeService({ establishmentId: establishment.id });
    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: anotherCustomer.id,
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryCustomersRepository.create(anotherCustomer);
    await inMemoryServicesRepository.create(service);
    await inMemoryCustomerVehiclesRepository.create(vehicle);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      customerId: customer.id.toString(),
      serviceIds: [service.id.toString()],
      vehicleId: vehicle.id.toString(),
      startsAt: new Date("2026-04-27T10:00:00.000Z"),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject a soft-deleted service", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const service = makeService({
      establishmentId: establishment.id,
      deletedAt: new Date("2026-04-27T09:00:00.000Z"),
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      customerId: customer.id.toString(),
      serviceIds: [service.id.toString()],
      startsAt: new Date("2026-04-27T10:00:00.000Z"),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should allow two appointments at the same startsAt", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const service = makeService({ establishmentId: establishment.id });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryServicesRepository.create(service);

    const firstAppointment = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      customerId: customer.id.toString(),
      serviceIds: [service.id.toString()],
      startsAt: new Date("2026-04-27T10:00:00.000Z"),
    });
    const secondAppointment = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      customerId: customer.id.toString(),
      serviceIds: [service.id.toString()],
      startsAt: new Date("2026-04-27T10:00:00.000Z"),
    });

    expect(firstAppointment.isRight()).toBe(true);
    expect(secondAppointment.isRight()).toBe(true);
    expect(inMemoryAppointmentsRepository.items).toHaveLength(2);
  });

  it("should create an appointment for an employee scoped to the establishment", async () => {
    const establishment = makeEstablishment();
    const user = makeUser("EMPLOYEE");
    const employee = makeEmployee({
      establishmentId: establishment.id,
      userId: user.id,
    });
    const customer = makeCustomer({ establishmentId: establishment.id });
    const service = makeService({ establishmentId: establishment.id });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEmployeesRepository.create(employee);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      actor: { userId: user.id.toString(), role: "EMPLOYEE" },
      customerId: customer.id.toString(),
      serviceIds: [service.id.toString()],
      startsAt: new Date("2026-04-27T10:00:00.000Z"),
    });

    expect(result.isRight()).toBe(true);
  });
});
