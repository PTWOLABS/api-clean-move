import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeAppointment } from "../../../../../tests/factories/appointment-factory";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { makeServiceCategoryRef } from "../../../../../tests/helpers/service-category-ref";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryAppointmentsRepository } from "../../../../../tests/repositories/in-memory-appointments-repository";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { InactiveServiceError } from "../../../catalog/domain/errors/inactive-service-error";
import { Money } from "../../../catalog/domain/value-objects/money";
import { ServicePriceSpecification } from "../../../catalog/domain/value-objects/service-price-specification";
import { InvalidAppointmentInputError } from "../../../scheduling/domain/errors/invalid-appointment-input-error";
import { EstablishmentScopeService } from "../../services/establishment-scope";
import { UpdateAppointmentUseCase } from "./update-appointment";

let inMemoryAppointmentsRepository: InMemoryAppointmentsRepository;
let inMemoryCustomersRepository: InMemoryCustomersRepository;
let inMemoryCustomerVehiclesRepository: InMemoryCustomerVehiclesRepository;
let inMemoryEmployeesRepository: InMemoryEmployeesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let establishmentScope: EstablishmentScopeService;
let sut: UpdateAppointmentUseCase;

describe("Update appointment", () => {
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

    sut = new UpdateAppointmentUseCase(
      inMemoryAppointmentsRepository,
      inMemoryCustomersRepository,
      inMemoryCustomerVehiclesRepository,
      establishmentScope,
      inMemoryServicesRepository,
    );
  });

  it("should update appointment editable fields", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const newCustomer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const protectionCategory = makeServiceCategoryRef("Proteção");
    const service = makeService({
      establishmentId: establishment.id,
      category: protectionCategory,
    });
    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: newCustomer.id,
      plate: "DEF4G56",
      brand: "Honda",
      model: "Civic",
      color: "Preto",
      year: 2024,
    });
    const appointment = makeAppointment({
      establishmentId: establishment.id,
      customerId: customer.id,
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryCustomersRepository.create(newCustomer);
    await inMemoryServicesRepository.create(service);
    await inMemoryCustomerVehiclesRepository.create(vehicle);
    await inMemoryAppointmentsRepository.create(appointment);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      appointmentId: appointment.id.toString(),
      customerId: newCustomer.id.toString(),
      serviceIds: [service.id.toString()],
      vehicleId: vehicle.id.toString(),
      startsAt: new Date("2026-05-01T10:00:00.000Z"),
      endsAt: new Date("2026-05-01T12:00:00.000Z"),
      description: "  Cliente prefere cera premium.  ",
      discountInCents: 1500,
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.appointment.customerId).toEqual(newCustomer.id);
    expect(result.value.appointment.customer).toEqual({
      fullName: newCustomer.fullName,
    });
    expect(result.value.appointment.services).toEqual([
      {
        serviceId: service.id,
        serviceName: service.serviceName.value,
        category: protectionCategory,
        durationInMinutes: service.estimatedDuration?.upperBoundInMinutes,
        priceSpecification: service.priceSpecification.toValue(),
        priceInCents: service.price.amountInCents,
        isActive: service.isActive,
      },
    ]);
    expect(result.value.appointment.vehicleId).toEqual(vehicle.id);
    expect(result.value.appointment.vehicle).toEqual({
      plate: "DEF4G56",
      brand: "Honda",
      model: "Civic",
      color: "Preto",
      year: 2024,
    });
    expect(result.value.appointment.startsAt).toEqual(
      new Date("2026-05-01T10:00:00.000Z"),
    );
    expect(result.value.appointment.endsAt).toEqual(
      new Date("2026-05-01T12:00:00.000Z"),
    );
    expect(result.value.appointment.description).toBe(
      "Cliente prefere cera premium.",
    );
    expect(result.value.appointment.discountInCents?.amountInCents).toBe(1500);
    expect(inMemoryAppointmentsRepository.items[0]).toBe(
      result.value.appointment,
    );
  });

  it("should preserve omitted fields and clear nullable fields", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
    });
    const appointment = makeAppointment({
      establishmentId: establishment.id,
      customerId: customer.id,
      vehicleId: vehicle.id,
      vehicle: {
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        color: vehicle.color,
        year: vehicle.year,
      },
      endsAt: new Date("2026-04-06T11:00:00"),
      description: "Observacao",
      discountInCents: Money.create(500),
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryCustomerVehiclesRepository.create(vehicle);
    await inMemoryAppointmentsRepository.create(appointment);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      appointmentId: appointment.id.toString(),
      vehicleId: null,
      endsAt: null,
      description: null,
      discountInCents: null,
    });

    expect(result.isRight()).toBe(true);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.appointment.customerId).toEqual(customer.id);
    expect(result.value.appointment.services).toHaveLength(1);
    expect(result.value.appointment.startsAt).toEqual(
      new Date("2026-04-06T10:00:00"),
    );
    expect(result.value.appointment.vehicleId).toBeNull();
    expect(result.value.appointment.vehicle).toBeNull();
    expect(result.value.appointment.endsAt).toBeNull();
    expect(result.value.appointment.description).toBeNull();
    expect(result.value.appointment.discountInCents).toBeNull();
  });

  it("should reject customer changes when vehicle is omitted", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const newCustomer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: customer.id,
    });
    const appointment = makeAppointment({
      establishmentId: establishment.id,
      customerId: customer.id,
      vehicleId: vehicle.id,
      vehicle: {
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        color: vehicle.color,
        year: vehicle.year,
      },
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryCustomersRepository.create(newCustomer);
    await inMemoryCustomerVehiclesRepository.create(vehicle);
    await inMemoryAppointmentsRepository.create(appointment);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      appointmentId: appointment.id.toString(),
      customerId: newCustomer.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidAppointmentInputError);
    expect(appointment.customerId).toEqual(customer.id);
    expect(appointment.vehicleId).toEqual(vehicle.id);
  });

  it("should reject duplicate services", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const service = makeService({ establishmentId: establishment.id });
    const appointment = makeAppointment({
      establishmentId: establishment.id,
      customerId: customer.id,
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryServicesRepository.create(service);
    await inMemoryAppointmentsRepository.create(appointment);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      appointmentId: appointment.id.toString(),
      serviceIds: [service.id.toString(), service.id.toString()],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidAppointmentInputError);
  });

  it("should update appointment services with explicit charged price", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const service = makeService({
      establishmentId: establishment.id,
      priceSpecification: ServicePriceSpecification.create({
        type: "STARTING_AT",
        minPriceInCents: 25000,
      }),
    });
    const appointment = makeAppointment({
      establishmentId: establishment.id,
      customerId: customer.id,
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryServicesRepository.create(service);
    await inMemoryAppointmentsRepository.create(appointment);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      appointmentId: appointment.id.toString(),
      services: [
        {
          serviceId: service.id.toString(),
          priceInCents: 35000,
        },
      ],
    });

    expect(result.isRight()).toBe(true);
    if (result.isRight()) {
      expect(result.value.appointment.services[0]?.priceInCents).toBe(35000);
    }
  });

  it("should reject update with service charged price outside the catalog policy", async () => {
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
    const appointment = makeAppointment({
      establishmentId: establishment.id,
      customerId: customer.id,
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryServicesRepository.create(service);
    await inMemoryAppointmentsRepository.create(appointment);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      appointmentId: appointment.id.toString(),
      services: [
        {
          serviceId: service.id.toString(),
          priceInCents: 60001,
        },
      ],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidAppointmentInputError);
  });

  it("should reject inactive services", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const service = makeService({
      establishmentId: establishment.id,
      isActive: false,
    });
    const appointment = makeAppointment({
      establishmentId: establishment.id,
      customerId: customer.id,
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryServicesRepository.create(service);
    await inMemoryAppointmentsRepository.create(appointment);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      appointmentId: appointment.id.toString(),
      serviceIds: [service.id.toString()],
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InactiveServiceError);
  });

  it("should reject deleted customers and services", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const deletedCustomer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const deletedService = makeService({ establishmentId: establishment.id });
    const appointment = makeAppointment({
      establishmentId: establishment.id,
      customerId: customer.id,
    });
    deletedCustomer.softDelete(new Date("2026-04-27T10:00:00.000Z"));
    deletedService.softDelete(new Date("2026-04-27T10:00:00.000Z"));

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryCustomersRepository.create(deletedCustomer);
    await inMemoryServicesRepository.create(deletedService);
    await inMemoryAppointmentsRepository.create(appointment);

    const deletedCustomerResult = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      appointmentId: appointment.id.toString(),
      customerId: deletedCustomer.id.toString(),
    });
    const deletedServiceResult = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      appointmentId: appointment.id.toString(),
      serviceIds: [deletedService.id.toString()],
    });

    expect(deletedCustomerResult.isLeft()).toBe(true);
    expect(deletedCustomerResult.value).toBeInstanceOf(ResourceNotFoundError);
    expect(deletedServiceResult.isLeft()).toBe(true);
    expect(deletedServiceResult.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject missing customers and vehicles from another customer", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const anotherCustomer = makeCustomer({
      establishmentId: establishment.id,
      cpfCnpj: null,
    });
    const vehicle = makeCustomerVehicle({
      establishmentId: establishment.id,
      customerId: anotherCustomer.id,
    });
    const appointment = makeAppointment({
      establishmentId: establishment.id,
      customerId: customer.id,
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryCustomersRepository.create(anotherCustomer);
    await inMemoryCustomerVehiclesRepository.create(vehicle);
    await inMemoryAppointmentsRepository.create(appointment);

    const missingCustomerResult = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      appointmentId: appointment.id.toString(),
      customerId: "missing-customer",
    });
    const wrongVehicleResult = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      appointmentId: appointment.id.toString(),
      vehicleId: vehicle.id.toString(),
    });

    expect(missingCustomerResult.isLeft()).toBe(true);
    expect(missingCustomerResult.value).toBeInstanceOf(ResourceNotFoundError);
    expect(wrongVehicleResult.isLeft()).toBe(true);
    expect(wrongVehicleResult.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject appointments outside the establishment", async () => {
    const firstEstablishment = makeEstablishment();
    const secondEstablishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: firstEstablishment.id });
    const appointment = makeAppointment({
      establishmentId: firstEstablishment.id,
      customerId: customer.id,
    });

    await inMemoryEstablishmentsRepository.create(firstEstablishment);
    await inMemoryEstablishmentsRepository.create(secondEstablishment);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryAppointmentsRepository.create(appointment);

    const result = await sut.execute({
      actor: {
        userId: secondEstablishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      appointmentId: appointment.id.toString(),
      description: "Nova descricao",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should allow an employee scoped to the establishment to update", async () => {
    const establishment = makeEstablishment();
    const user = makeUser("EMPLOYEE");
    const employee = makeEmployee({
      establishmentId: establishment.id,
      userId: user.id,
    });
    const customer = makeCustomer({ establishmentId: establishment.id });
    const appointment = makeAppointment({
      establishmentId: establishment.id,
      customerId: customer.id,
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEmployeesRepository.create(employee);
    await inMemoryCustomersRepository.create(customer);
    await inMemoryAppointmentsRepository.create(appointment);

    const result = await sut.execute({
      actor: { userId: user.id.toString(), role: "EMPLOYEE" },
      appointmentId: appointment.id.toString(),
      description: "Atualizado pelo funcionario",
    });

    expect(result.isRight()).toBe(true);
    expect(appointment.description).toBe("Atualizado pelo funcionario");
  });
});
