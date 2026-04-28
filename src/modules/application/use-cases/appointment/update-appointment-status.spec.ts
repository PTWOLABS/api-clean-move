import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeAppointment } from "../../../../../tests/factories/appointment-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { InMemoryAppointmentsRepository } from "../../../../../tests/repositories/in-memory-appointments-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { UpdateAppointmentStatusUseCase } from "./update-appointment-status";

let inMemoryAppointmentsRepository: InMemoryAppointmentsRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let sut: UpdateAppointmentStatusUseCase;

describe("Update appointment status", () => {
  beforeEach(() => {
    inMemoryAppointmentsRepository = new InMemoryAppointmentsRepository();
    inMemoryServicesRepository = new InMemoryServicesRepository();
    inMemoryEstablishmentsRepository = new InMemoryEstablishmentsRepository(
      inMemoryServicesRepository,
    );

    sut = new UpdateAppointmentStatusUseCase(
      inMemoryAppointmentsRepository,
      inMemoryEstablishmentsRepository,
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
      establishmentOwnerId: establishment.ownerId.toString(),
      appointmentId: appointment.id.toString(),
      status: "DONE",
    });

    expect(doneResult.isRight()).toBe(true);
    expect(appointment.status).toBe("DONE");
    expect(appointment.doneAt).toBeInstanceOf(Date);
    expect(appointment.cancelledAt).toBeNull();

    const cancelledResult = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
      appointmentId: appointment.id.toString(),
      status: "CANCELLED",
    });

    expect(cancelledResult.isRight()).toBe(true);
    expect(appointment.status).toBe("CANCELLED");
    expect(appointment.cancelledAt).toBeInstanceOf(Date);
    expect(appointment.doneAt).toBeNull();

    const scheduledResult = await sut.execute({
      establishmentOwnerId: establishment.ownerId.toString(),
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
      establishmentOwnerId: secondEstablishment.ownerId.toString(),
      appointmentId: appointment.id.toString(),
      status: "DONE",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });
});
