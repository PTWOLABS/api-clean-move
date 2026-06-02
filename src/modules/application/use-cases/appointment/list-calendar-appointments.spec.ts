import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { makeAppointment } from "../../../../../tests/factories/appointment-factory";
import { makeEmployee } from "../../../../../tests/factories/employee-factory";
import { makeEstablishment } from "../../../../../tests/factories/establishment-factory";
import { makeUser } from "../../../../../tests/factories/user-factory";
import { InMemoryAppointmentsRepository } from "../../../../../tests/repositories/in-memory-appointments-repository";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { InMemoryEmployeesRepository } from "../../../../../tests/repositories/in-memory-employees-repository";
import { InMemoryEstablishmentsRepository } from "../../../../../tests/repositories/in-memory-establishment-repository";
import { InMemoryServicesRepository } from "../../../../../tests/repositories/in-memory-services-repository";
import { EstablishmentScopeService } from "../../services/establishment-scope";
import { ListCalendarAppointmentsUseCase } from "./list-calendar-appointments";

let inMemoryAppointmentsRepository: InMemoryAppointmentsRepository;
let inMemoryCustomersRepository: InMemoryCustomersRepository;
let inMemoryEmployeesRepository: InMemoryEmployeesRepository;
let inMemoryEstablishmentsRepository: InMemoryEstablishmentsRepository;
let inMemoryServicesRepository: InMemoryServicesRepository;
let establishmentScope: EstablishmentScopeService;
let sut: ListCalendarAppointmentsUseCase;

const rangeStartsAt = new Date("2026-04-10T08:00:00.000Z");
const rangeEndsAt = new Date("2026-04-17T08:00:00.000Z");

describe("List calendar appointments", () => {
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

    sut = new ListCalendarAppointmentsUseCase(
      inMemoryAppointmentsRepository,
      establishmentScope,
    );
  });

  it("should return an empty list when there are no appointments in the range", async () => {
    const establishment = makeEstablishment();

    await inMemoryEstablishmentsRepository.create(establishment);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      filters: {
        startsAt: rangeStartsAt,
        endsAt: rangeEndsAt,
      },
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.appointments).toEqual([]);
    expect(result.value.totalItems).toBe(0);
  });

  it("should list appointments that intersect the requested range", async () => {
    const establishment = makeEstablishment();
    const otherEstablishment = makeEstablishment();
    const startsBeforeEndsWithin = makeAppointment({
      establishmentId: establishment.id,
      startsAt: new Date("2026-04-09T10:00:00.000Z"),
      endsAt: new Date("2026-04-12T10:00:00.000Z"),
    });
    const startsWithinEndsAfter = makeAppointment({
      establishmentId: establishment.id,
      startsAt: new Date("2026-04-15T10:00:00.000Z"),
      endsAt: new Date("2026-04-20T10:00:00.000Z"),
    });
    const fullyInside = makeAppointment({
      establishmentId: establishment.id,
      startsAt: new Date("2026-04-11T10:00:00.000Z"),
      endsAt: new Date("2026-04-12T10:00:00.000Z"),
    });
    const fullyOutside = makeAppointment({
      establishmentId: establishment.id,
      startsAt: new Date("2026-04-20T10:00:00.000Z"),
      endsAt: new Date("2026-04-21T10:00:00.000Z"),
    });
    const otherEstablishmentAppointment = makeAppointment({
      establishmentId: otherEstablishment.id,
      startsAt: new Date("2026-04-11T10:00:00.000Z"),
      endsAt: new Date("2026-04-12T10:00:00.000Z"),
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEstablishmentsRepository.create(otherEstablishment);
    await inMemoryAppointmentsRepository.create(startsBeforeEndsWithin);
    await inMemoryAppointmentsRepository.create(startsWithinEndsAfter);
    await inMemoryAppointmentsRepository.create(fullyInside);
    await inMemoryAppointmentsRepository.create(fullyOutside);
    await inMemoryAppointmentsRepository.create(otherEstablishmentAppointment);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      filters: {
        startsAt: rangeStartsAt,
        endsAt: rangeEndsAt,
      },
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.appointments).toEqual([
      startsBeforeEndsWithin,
      fullyInside,
      startsWithinEndsAfter,
    ]);
    expect(result.value.totalItems).toBe(3);
  });

  it("should filter appointments by status", async () => {
    const establishment = makeEstablishment();
    const scheduledAppointment = makeAppointment({
      establishmentId: establishment.id,
      startsAt: new Date("2026-04-11T10:00:00.000Z"),
      endsAt: new Date("2026-04-12T10:00:00.000Z"),
      status: "SCHEDULED",
    });
    const doneAppointment = makeAppointment({
      establishmentId: establishment.id,
      startsAt: new Date("2026-04-12T10:00:00.000Z"),
      endsAt: new Date("2026-04-13T10:00:00.000Z"),
      status: "DONE",
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryAppointmentsRepository.create(scheduledAppointment);
    await inMemoryAppointmentsRepository.create(doneAppointment);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      filters: {
        startsAt: rangeStartsAt,
        endsAt: rangeEndsAt,
        status: "DONE",
      },
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.appointments).toEqual([doneAppointment]);
    expect(result.value.totalItems).toBe(1);
  });

  it("should order appointments by startsAt ascending", async () => {
    const establishment = makeEstablishment();
    const laterAppointment = makeAppointment({
      establishmentId: establishment.id,
      startsAt: new Date("2026-04-15T10:00:00.000Z"),
      endsAt: new Date("2026-04-16T10:00:00.000Z"),
    });
    const earlierAppointment = makeAppointment({
      establishmentId: establishment.id,
      startsAt: new Date("2026-04-11T10:00:00.000Z"),
      endsAt: new Date("2026-04-12T10:00:00.000Z"),
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryAppointmentsRepository.create(laterAppointment);
    await inMemoryAppointmentsRepository.create(earlierAppointment);

    const result = await sut.execute({
      actor: {
        userId: establishment.ownerId.toString(),
        role: "ESTABLISHMENT",
      },
      filters: {
        startsAt: rangeStartsAt,
        endsAt: rangeEndsAt,
      },
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.appointments).toEqual([
      earlierAppointment,
      laterAppointment,
    ]);
    expect(result.value.totalItems).toBe(2);
  });

  it("should reject a missing establishment", async () => {
    const result = await sut.execute({
      actor: { userId: "missing-owner", role: "ESTABLISHMENT" },
      filters: {
        startsAt: rangeStartsAt,
        endsAt: rangeEndsAt,
      },
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should list appointments for employee actor", async () => {
    const establishment = makeEstablishment();
    const user = makeUser("EMPLOYEE");
    const employee = makeEmployee({
      establishmentId: establishment.id,
      userId: user.id,
    });
    const appointment = makeAppointment({
      establishmentId: establishment.id,
      startsAt: new Date("2026-04-11T10:00:00.000Z"),
      endsAt: new Date("2026-04-12T10:00:00.000Z"),
    });

    await inMemoryEstablishmentsRepository.create(establishment);
    await inMemoryEmployeesRepository.create(employee);
    await inMemoryAppointmentsRepository.create(appointment);

    const result = await sut.execute({
      actor: { userId: user.id.toString(), role: "EMPLOYEE" },
      filters: {
        startsAt: rangeStartsAt,
        endsAt: rangeEndsAt,
      },
    });

    expect(result.isRight()).toBe(true);
    if (result.isLeft()) throw result.value;
    expect(result.value.appointments).toEqual([appointment]);
    expect(result.value.totalItems).toBe(1);
  });
});
