import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeAppointment } from "../../../../../tests/factories/appointment-factory";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryAppointmentsRepository } from "../../../../../tests/repositories/in-memory-appointments-repository";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { EstablishmentScopeService } from "../../services/establishment-scope";
import { DeleteAppointmentUseCase } from "./delete-appointment";

let inMemoryAppointmentsRepository: InMemoryAppointmentsRepository;
let inMemoryEmployeesRepository: InMemoryEmployeesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let establishmentScope: EstablishmentScopeService;
let sut: DeleteAppointmentUseCase;

describe("Delete appointment", () => {
  beforeEach(() => {
    inMemoryAppointmentsRepository = new InMemoryAppointmentsRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEmployeesRepository = new InMemoryEmployeesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );
    establishmentScope = new EstablishmentScopeService(
      inMemoryEstablishmentsRepository,
      inMemoryEmployeesRepository,
    );

    sut = new DeleteAppointmentUseCase(
      inMemoryAppointmentsRepository,
      establishmentScope,
    );
  });

  it("should delete an appointment from the authenticated establishment", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const appointment = makeAppointment({
      establishmentId: establishment.id,
      customerId: customer.id,
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryAppointmentsRepository.create(appointment);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      appointmentId: appointment.id.toString(),
    });

    expect(result.isRight()).toBe(true);
    expect(inMemoryAppointmentsRepository.items).toHaveLength(1);
    expect(inMemoryAppointmentsRepository.items[0]?.isDeleted()).toBe(true);
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
    await inMemoryAppointmentsRepository.create(appointment);

    const result = await sut.execute({
      actor: {
        userId: secondEstablishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      appointmentId: appointment.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
    expect(inMemoryAppointmentsRepository.items).toEqual([appointment]);
  });

  it("should reject missing appointments", async () => {
    const establishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      appointmentId: "missing-appointment",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should allow an employee scoped to the establishment to delete", async () => {
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
    await inMemoryAppointmentsRepository.create(appointment);

    const result = await sut.execute({
      actor: { userId: user.id.toString(), role: "EMPLOYEE" },
      appointmentId: appointment.id.toString(),
    });

    expect(result.isRight()).toBe(true);
    expect(inMemoryAppointmentsRepository.items).toHaveLength(1);
    expect(inMemoryAppointmentsRepository.items[0]?.isDeleted()).toBe(true);
  });

  it("should reject done appointments", async () => {
    const establishment = makeEstablishment();
    const customer = makeCustomer({ establishmentId: establishment.id });
    const appointment = makeAppointment({
      establishmentId: establishment.id,
      customerId: customer.id,
      status: "DONE",
      doneAt: new Date("2026-04-06T12:00:00.000Z"),
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryAppointmentsRepository.create(appointment);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      appointmentId: appointment.id.toString(),
    });

    expect(result.isLeft()).toBe(true);
    expect(appointment.isDeleted()).toBe(false);
  });
});
