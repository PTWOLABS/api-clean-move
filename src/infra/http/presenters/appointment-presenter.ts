import { Appointment } from "../../../modules/scheduling/domain/entities/appointment";
import { AppointmentItemDTO } from "../contracts/appointment.dto";

export class AppointmentPresenter {
  static toHTTP(appointment: Appointment): AppointmentItemDTO {
    return {
      id: appointment.id.toString(),
      establishmentId: appointment.establishmentId.toString(),
      customerId: appointment.customerId.toString(),
      vehicleId: appointment.vehicleId?.toString() ?? null,
      services: appointment.services.map((service) => ({
        id: service.serviceId.toString(),
        name: service.serviceName,
        category: service.category ?? null,
        durationInMinutes: service.durationInMinutes ?? null,
        priceInCents: service.priceInCents,
      })),
      vehicle: appointment.vehicle
        ? {
            plate: appointment.vehicle.plate,
            brand: appointment.vehicle.brand,
            model: appointment.vehicle.model,
            color: appointment.vehicle.color,
            year: appointment.vehicle.year,
          }
        : null,
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt?.toISOString() ?? null,
      description: appointment.description,
      discountInCents: appointment.discountInCents?.amountInCents ?? null,
      status: appointment.status,
      createdAt: appointment.createdAt.toISOString(),
      updatedAt: appointment.updatedAt.toISOString(),
      doneAt: appointment.doneAt?.toISOString() ?? null,
      cancelledAt: appointment.cancelledAt?.toISOString() ?? null,
    };
  }
}
