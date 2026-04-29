import {
  Appointment,
  AppointmentProps,
} from "../../src/modules/scheduling/domain/entities/appointment";
import { UniqueEntityId } from "../../src/shared/entities/unique-entity-id";

export function makeAppointment(
  override?: Partial<AppointmentProps>,
  id?: UniqueEntityId,
) {
  return Appointment.create(
    {
      establishmentId: new UniqueEntityId(),
      customerId: new UniqueEntityId(),
      vehicleId: null,
      service: {
        serviceId: new UniqueEntityId(),
        serviceName: "Lavagem simples",
        category: "WASH",
        durationInMinutes: 60,
        priceInCents: 30000,
      },
      vehicle: null,
      startsAt: new Date("2026-04-06T10:00:00"),
      endsAt: new Date("2026-04-06T11:00:00"),
      description: null,
      discountInCents: null,
      status: "SCHEDULED",
      createdAt: new Date("2026-04-01T08:00:00"),
      updatedAt: new Date("2026-04-01T08:00:00"),
      doneAt: null,
      cancelledAt: null,
      ...override,
    },
    id,
  );
}
