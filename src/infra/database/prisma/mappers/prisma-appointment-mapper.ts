import {
  Appointment as PrismaAppointmentRecord,
  Prisma,
} from "../../../../generated/prisma/client";
import { Money } from "../../../../modules/catalog/domain/value-objects/money";
import { Appointment } from "../../../../modules/scheduling/domain/entities/appointment";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";

export class PrismaAppointmentMapper {
  static toDomain(raw: PrismaAppointmentRecord): Appointment {
    return Appointment.create(
      {
        establishmentId: new UniqueEntityId(raw.establishmentId),
        customerId: new UniqueEntityId(raw.customerId),
        vehicleId: raw.vehicleId ? new UniqueEntityId(raw.vehicleId) : null,
        service: {
          serviceId: new UniqueEntityId(raw.bookedServiceId),
          serviceName: raw.bookedServiceName,
          category: raw.bookedServiceCategory ?? undefined,
          durationInMinutes: raw.bookedServiceDurationInMinutes ?? undefined,
          priceInCents: raw.bookedServicePriceInCents,
        },
        vehicle: raw.vehicleId
          ? {
              plate: raw.vehiclePlate,
              brand: raw.vehicleBrand,
              model: raw.vehicleModel,
              color: raw.vehicleColor,
              year: raw.vehicleYear,
            }
          : null,
        startsAt: raw.startsAt,
        endsAt: raw.endsAt,
        description: raw.description,
        discountInCents:
          raw.discountInCents !== null ? Money.create(raw.discountInCents) : null,
        status: raw.status,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
        doneAt: raw.doneAt,
        cancelledAt: raw.cancelledAt,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPrisma(raw: Appointment): Prisma.AppointmentUncheckedCreateInput {
    return {
      id: raw.id.toString(),
      establishmentId: raw.establishmentId.toString(),
      customerId: raw.customerId.toString(),
      vehicleId: raw.vehicleId?.toString() ?? null,
      bookedServiceId: raw.service.serviceId.toString(),
      bookedServiceName: raw.service.serviceName,
      bookedServiceCategory: raw.service.category ?? null,
      bookedServiceDurationInMinutes: raw.service.durationInMinutes ?? null,
      bookedServicePriceInCents: raw.service.priceInCents,
      vehiclePlate: raw.vehicle?.plate ?? null,
      vehicleBrand: raw.vehicle?.brand ?? null,
      vehicleModel: raw.vehicle?.model ?? null,
      vehicleColor: raw.vehicle?.color ?? null,
      vehicleYear: raw.vehicle?.year ?? null,
      startsAt: raw.startsAt,
      endsAt: raw.endsAt,
      description: raw.description,
      discountInCents: raw.discountInCents?.amountInCents ?? null,
      status: raw.status,
      ...(raw.createdAt ? { createdAt: raw.createdAt } : {}),
      ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
      doneAt: raw.doneAt,
      cancelledAt: raw.cancelledAt,
    };
  }

  static toPrismaUpdate(
    raw: Appointment,
  ): Prisma.AppointmentUncheckedUpdateInput {
    return {
      vehicleId: raw.vehicleId?.toString() ?? null,
      bookedServiceId: raw.service.serviceId.toString(),
      bookedServiceName: raw.service.serviceName,
      bookedServiceCategory: raw.service.category ?? null,
      bookedServiceDurationInMinutes: raw.service.durationInMinutes ?? null,
      bookedServicePriceInCents: raw.service.priceInCents,
      vehiclePlate: raw.vehicle?.plate ?? null,
      vehicleBrand: raw.vehicle?.brand ?? null,
      vehicleModel: raw.vehicle?.model ?? null,
      vehicleColor: raw.vehicle?.color ?? null,
      vehicleYear: raw.vehicle?.year ?? null,
      startsAt: raw.startsAt,
      endsAt: raw.endsAt,
      description: raw.description,
      discountInCents: raw.discountInCents?.amountInCents ?? null,
      status: raw.status,
      ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
      doneAt: raw.doneAt,
      cancelledAt: raw.cancelledAt,
    };
  }
}
