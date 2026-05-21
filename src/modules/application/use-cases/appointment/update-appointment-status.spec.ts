import { NotAllowedError } from "../../../../shared/errors/not-allowed-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeAppointment } from "../../../../../tests/factories/appointment-factory";
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryAppointmentsRepository } from "../../../../../tests/repositories/in-memory-appointments-repository";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { EstablishmentScopeService } from "../../services/establishment-scope";
import { UpdateAppointmentStatusUseCase } from "./update-appointment-status";

let inMemoryAppointmentsRepository: InMemoryAppointmentsRepository;
let inMemoryEmployeesRepository: InMemoryEmployeesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let establishmentScope: EstablishmentScopeService;
let sut: UpdateAppointmentStatusUseCase;

describe("Update appointment status", () => {
  beforeEach(() => {
    inMemoryAppointmentsRepository = new InMemoryAppointmentsRepository();
    inMemoryEmployeesRepository = new InMemoryEmployeesRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );
    establishmentScope = new EstablishmentScopeService(
      inMemoryEstablishmentsRepository,
      inMemoryEmployeesRepository,
    );

    sut = new UpdateAppointmentStatusUseCase(
      inMemoryAppointmentsRepository,
      establishmentScope,
    );
  });

  it("should change appointment status to done, cancelled and scheduled", async () => {
    const establishment = makeEstablishment();
    const appointment = makeAppointment({
      establishmentId: establishment.id,
      status: "SCHEDULED",
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryAppointmentsRepository.create(appointment);

    const doneResult = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      appointmentId: appointment.id.toString(),
      status: "DONE",
    });

    expect(doneResult.isRight()).toBe(true);
    expect(appointment.status).toBe("DONE");
    expect(appointment.doneAt).toBeInstanceOf(Date);
    expect(appointment.cancelledAt).toBeNull();

    const cancelledResult = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      appointmentId: appointment.id.toString(),
      status: "CANCELLED",
    });

    expect(cancelledResult.isRight()).toBe(true);
    expect(appointment.status).toBe("CANCELLED");
    expect(appointment.cancelledAt).toBeInstanceOf(Date);
    expect(appointment.doneAt).toBeNull();

    const scheduledResult = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      appointmentId: appointment.id.toString(),
      status: "SCHEDULED",
    });

    expect(scheduledResult.isRight()).toBe(true);
    expect(appointment.status).toBe("SCHEDULED");
    expect(appointment.doneAt).toBeNull();
    expect(appointment.cancelledAt).toBeNull();
  });

  it("should reject appointments outside the establishment", async () => {
    const firstEstablishment = makeEstablishment();
    const secondEstablishment = makeEstablishment();
    const appointment = makeAppointment({
      establishmentId: firstEstablishment.id,
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
      status: "DONE",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should allow employee with update appointments feature to mark done", async () => {
    const establishment = makeEstablishment();
    const user = makeUser("EMPLOYEE");
    const employee = makeEmployee({
      establishmentId: establishment.id,
      userId: user.id,
      extraFeatures: ["update:appointments"],
    });
    const appointment = makeAppointment({
      establishmentId: establishment.id,
      status: "SCHEDULED",
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEmployeesRepository.create(employee);
    await inMemoryAppointmentsRepository.create(appointment);

    const result = await sut.execute({
      actor: { userId: user.id.toString(), role: "EMPLOYEE" },
      appointmentId: appointment.id.toString(),
      status: "DONE",
    });

    expect(result.isRight()).toBe(true);
    expect(appointment.status).toBe("DONE");
  });

  it("should allow employee with delete appointments feature to cancel", async () => {
    const establishment = makeEstablishment();
    const user = makeUser("EMPLOYEE");
    const employee = makeEmployee({
      establishmentId: establishment.id,
      userId: user.id,
      extraFeatures: ["delete:appointments"],
    });
    const appointment = makeAppointment({
      establishmentId: establishment.id,
      status: "SCHEDULED",
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEmployeesRepository.create(employee);
    await inMemoryAppointmentsRepository.create(appointment);

    const result = await sut.execute({
      actor: { userId: user.id.toString(), role: "EMPLOYEE" },
      appointmentId: appointment.id.toString(),
      status: "CANCELLED",
    });

    expect(result.isRight()).toBe(true);
    expect(appointment.status).toBe("CANCELLED");
  });

  it("should reject employee without update appointments feature for done", async () => {
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
      appointmentId: appointment.id.toString(),
      status: "DONE",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });

  it("should reject employee without delete appointments feature for cancel", async () => {
    const establishment = makeEstablishment();
    const user = makeUser("EMPLOYEE");
    const employee = makeEmployee({
      establishmentId: establishment.id,
      userId: user.id,
      extraFeatures: ["update:appointments"],
    });
    const appointment = makeAppointment({
      establishmentId: establishment.id,
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEmployeesRepository.create(employee);
    await inMemoryAppointmentsRepository.create(appointment);

    const result = await sut.execute({
      actor: { userId: user.id.toString(), role: "EMPLOYEE" },
      appointmentId: appointment.id.toString(),
      status: "CANCELLED",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotAllowedError);
  });
});
