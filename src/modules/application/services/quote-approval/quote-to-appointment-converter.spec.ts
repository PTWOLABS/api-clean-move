import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeCustomerVehicle } from "../../../../../tests/factories/customer-vehicle-factory";
import { makeQuote } from "../../../../../tests/factories/quote-factory";
import { InMemoryAppointmentsRepository } from "../../../../../tests/repositories/in-memory-appointments-repository";
import { InMemoryCustomerVehiclesRepository } from "../../../../../tests/repositories/in-memory-customer-vehicles-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import { QuoteToAppointmentConverter } from "./quote-to-appointment-converter";

let appointmentsRepository: InMemoryAppointmentsRepository;
let customersRepository: InMemoryCustomersRepository;
let customerVehiclesRepository: InMemoryCustomerVehiclesRepository;
let sut: QuoteToAppointmentConverter;

describe("Quote to appointment converter", () => {
  beforeEach(() => {
    customersRepository = new InMemoryCustomersRepository();
    customerVehiclesRepository = new InMemoryCustomerVehiclesRepository();
    appointmentsRepository = new InMemoryAppointmentsRepository(
      customersRepository,
    );
    sut = new QuoteToAppointmentConverter(
      appointmentsRepository,
      customersRepository,
      customerVehiclesRepository,
    );
  });

  it("should create an appointment from resolved quote snapshots", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({
      establishmentId,
      fullName: "Nome atual do cliente",
    });
    const vehicle = makeCustomerVehicle({
      establishmentId,
      customerId: customer.id,
      model: "Modelo atual",
    });
    const catalogServiceId = new UniqueEntityId("service-1");
    const quote = makeQuote({
      establishmentId,
      customerId: customer.id,
      vehicleId: vehicle.id,
      customer: {
        name: "Nome do snapshot",
        phone: null,
        email: null,
        cpfCnpj: null,
        address: null,
      },
      vehicle: {
        plate: "ABC1D23",
        brand: "Honda",
        model: "HR-V",
        color: "Branco",
        year: 2025,
      },
      services: [
        {
          quoteServiceId: new UniqueEntityId("quote-service-1"),
          serviceId: catalogServiceId,
          serviceName: "Nome do snapshot",
          durationInMinutes: 60,
          priceInCents: 5000,
          isCourtesy: false,
        },
      ],
    });

    await customersRepository.create(customer);
    await customerVehiclesRepository.create(vehicle);

    const appointment = await sut.convert({
      quote,
      startsAt: new Date("2026-07-20T13:00:00.000Z"),
      endsAt: new Date("2026-07-20T15:00:00.000Z"),
    });

    expect(appointmentsRepository.items).toContain(appointment);
    expect(appointment.customer.fullName).toBe("Nome do snapshot");
    expect(appointment.vehicle).toEqual(quote.vehicle);
    expect(appointment.services[0]).toMatchObject({
      serviceId: catalogServiceId,
      serviceName: "Nome do snapshot",
      durationInMinutes: 60,
      priceInCents: 5000,
    });
  });

  it("should reject unresolved service references", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({ establishmentId });
    const quote = makeQuote({
      establishmentId,
      customerId: customer.id,
      services: [
        {
          quoteServiceId: new UniqueEntityId("quote-service-1"),
          serviceId: null,
          serviceName: "Servico sem catalogo",
          priceInCents: 5000,
          isCourtesy: false,
        },
      ],
    });

    await customersRepository.create(customer);

    await expect(
      sut.convert({
        quote,
        startsAt: new Date("2026-07-20T13:00:00.000Z"),
        endsAt: null,
      }),
    ).rejects.toBeInstanceOf(InvalidQuoteInputError);
  });

  it("should reject deleted customers", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({ establishmentId });
    customer.softDelete(new Date("2026-07-13T10:00:00.000Z"));
    const quote = makeQuote({
      establishmentId,
      customerId: customer.id,
    });

    await customersRepository.create(customer);

    await expect(
      sut.convert({
        quote,
        startsAt: new Date("2026-07-20T13:00:00.000Z"),
        endsAt: null,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("should reject vehicle references not owned by the resolved customer", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({ establishmentId });
    const otherCustomer = makeCustomer({ establishmentId });
    const vehicle = makeCustomerVehicle({
      establishmentId,
      customerId: otherCustomer.id,
    });
    const quote = makeQuote({
      establishmentId,
      customerId: customer.id,
      vehicleId: vehicle.id,
    });

    await customersRepository.create(customer);
    await customersRepository.create(otherCustomer);
    await customerVehiclesRepository.create(vehicle);

    await expect(
      sut.convert({
        quote,
        startsAt: new Date("2026-07-20T13:00:00.000Z"),
        endsAt: null,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
