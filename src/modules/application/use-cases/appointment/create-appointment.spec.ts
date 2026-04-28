import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { InMemoryAppointmentsRepository } from "../../../../../tests/repositories/in-memory-appointments-repository";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { CreateAppointmentUseCase } from "./create-appointment";

let inMemoryAppointmentsRepository: InMemoryAppointmentsRepository;
let inMemoryCustomersRepository: InMemoryCustomersRepository;
let inMemoryCustomerVehiclesRepository: InMemoryCustomerVehiclesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: CreateAppointmentUseCase;

describe("Create appointment", () => {
  beforeEach(() => {
    inMemoryAppointmentsRepository = new InMemoryAppointmentsRepository();
    inMemoryCustomersRepository = new InMemoryCustomersRepository();
    inMemoryCustomerVehiclesRepository =
      new InMemoryCustomerVehiclesRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );

    sut = new CreateAppointmentUseCase(
      inMemoryAppointmentsRepository,
      inMemoryCustomersRepository,
      inMemoryCustomerVehiclesRepository,
      inMemoryEstablishmentsRepository,
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
      establishmentOwnerId: establishment.ownerId.toString(),
      customerId: customer.id.toString(),
      serviceId: service.id.toString(),
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
    expect(result.value.appointment.service.serviceId).toEqual(service.id);
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
      establishmentOwnerId: establishment.ownerId.toString(),
      customerId: customer.id.toString(),
      serviceId: service.id.toString(),
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

  it("should reject a deleted customer", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const service = makeService({ establishmentId: establishment.id });
    customer.softDelete(new Date("2026-04-27T10:00:00.000Z"));

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryServicesRepository.create(service);

    const result = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      customerId: customer.id.toString(),
      serviceId: service.id.toString(),
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
      establishmentOwnerId: establishment.ownerId.toString(),
      customerId: customer.id.toString(),
      serviceId: service.id.toString(),
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
      establishmentOwnerId: establishment.ownerId.toString(),
      customerId: customer.id.toString(),
      serviceId: service.id.toString(),
      vehicleId: vehicle.id.toString(),
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
      establishmentOwnerId: establishment.ownerId.toString(),
      customerId: customer.id.toString(),
      serviceId: service.id.toString(),
      startsAt: new Date("2026-04-27T10:00:00.000Z"),
    });
    const secondAppointment = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      customerId: customer.id.toString(),
      serviceId: service.id.toString(),
      startsAt: new Date("2026-04-27T10:00:00.000Z"),
    });

    expect(firstAppointment.isRight()).toBe(true);
    expect(secondAppointment.isRight()).toBe(true);
    expect(inMemoryAppointmentsRepository.items).toHaveLength(2);
  });
});
