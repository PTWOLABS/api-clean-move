import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeAppointment } from "../../../../../tests/factories/appointment-factory";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeService } from "../../../../../tests/factories/service-factory";
import { InMemoryAppointmentsRepository } from "../../../../../tests/repositories/in-memory-appointments-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { ListAppointmentsUseCase } from "./list-appointments";

let inMemoryAppointmentsRepository: InMemoryAppointmentsRepository;
let inMemoryCustomersRepository: InMemoryCustomersRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: ListAppointmentsUseCase;

describe("List appointments", () => {
  beforeEach(() => {
    inMemoryCustomersRepository = new InMemoryCustomersRepository();
    inMemoryAppointmentsRepository = new InMemoryAppointmentsRepository(
      inMemoryCustomersRepository,
    );
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );

    sut = new ListAppointmentsUseCase(
      inMemoryAppointmentsRepository,
      inMemoryEstablishmentsRepository,
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
      service: {
        serviceId: service.id,
        serviceName: service.serviceName.value,
        category: service.category,
        durationInMinutes: service.estimatedDuration?.upperBoundInMinutes,
        priceInCents: service.price.amountInCents,
      },
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
      service: {
        serviceId: service.id,
        serviceName: service.serviceName.value,
        category: service.category,
        durationInMinutes: service.estimatedDuration?.upperBoundInMinutes,
        priceInCents: service.price.amountInCents,
      },
      startsAt: new Date("2026-04-27T11:00:00.000Z"),
      endsAt: null,
      status: "SCHEDULED",
    });
    const wrongCustomerAppointment = makeAppointment({
      establishmentId: establishment.id,
      customerId: otherCustomer.id,
      service: {
        serviceId: service.id,
        serviceName: service.serviceName.value,
        category: service.category,
        durationInMinutes: service.estimatedDuration?.upperBoundInMinutes,
        priceInCents: service.price.amountInCents,
      },
      startsAt: new Date("2026-04-27T12:00:00.000Z"),
      endsAt: null,
      status: "DONE",
    });
    const wrongServiceAppointment = makeAppointment({
      establishmentId: establishment.id,
      customerId: customer.id,
      service: {
        serviceId: otherService.id,
        serviceName: otherService.serviceName.value,
        category: otherService.category,
        durationInMinutes: otherService.estimatedDuration?.upperBoundInMinutes,
        priceInCents: otherService.price.amountInCents,
      },
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
      establishmentOwnerId: establishment.ownerId.toString(),
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
      establishmentOwnerId: "missing-owner",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
