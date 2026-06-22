import {
  Appointment as PrismaAppointmentRecord,
  AppointmentBookedService as PrismaAppointmentBookedServiceRecord,
  Prisma,
} from "../../../../generated/prisma/client";
import { Money } from "../../../../modules/catalog/domain/value-objects/money";
import { ServicePriceSpecificationValue } from "../../../../modules/catalog/domain/value-objects/service-price-specification";
import { Appointment } from "../../../../modules/scheduling/domain/entities/appointment";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";

function toCategorySnapshot(
  categoryId: string | null,
  categoryName: string | null,
) {
  if (!categoryId || !categoryName) {
    return undefined;
  }

  return {
    id: new UniqueEntityId(categoryId),
    name: categoryName,
  };
}

type PrismaAppointmentWithBookedServices = PrismaAppointmentRecord & {
  bookedServices: PrismaAppointmentBookedServiceRecord[];
};

function toPriceSpecificationSnapshot(
  bookedService: PrismaAppointmentBookedServiceRecord,
): ServicePriceSpecificationValue {
  if (bookedService.servicePriceSpecificationType === "FIXED") {
    return {
      type: "FIXED",
      fixedPriceInCents: bookedService.servicePriceDefaultInCents,
    };
  }

  if (bookedService.servicePriceSpecificationType === "STARTING_AT") {
    return {
      type: "STARTING_AT",
      minPriceInCents: bookedService.servicePriceDefaultInCents,
    };
  }

  const maxPriceInCents = bookedService.servicePriceRangeMaxInCents;

  if (maxPriceInCents === null) {
    throw new Error(
      "Invalid booked service record: servicePriceRangeMaxInCents is required for range pricing.",
    );
  }

  return {
    type: "RANGE",
    minPriceInCents: bookedService.servicePriceDefaultInCents,
    maxPriceInCents,
  };
}

function toBookedServicePricePersistence(
  priceSpecification: ServicePriceSpecificationValue | undefined,
  priceInCents: number,
): Pick<
  Prisma.AppointmentBookedServiceUncheckedCreateWithoutAppointmentInput,
  | "servicePriceDefaultInCents"
  | "servicePriceSpecificationType"
  | "servicePriceRangeMaxInCents"
> {
  const defaultPriceInCents =
    priceSpecification?.fixedPriceInCents ??
    priceSpecification?.minPriceInCents ??
    priceInCents;

  if (!priceSpecification || priceSpecification.type === "FIXED") {
    return {
      servicePriceDefaultInCents: defaultPriceInCents,
      servicePriceSpecificationType: "FIXED",
      servicePriceRangeMaxInCents: null,
    };
  }

  if (priceSpecification.type === "STARTING_AT") {
    return {
      servicePriceDefaultInCents: defaultPriceInCents,
      servicePriceSpecificationType: "STARTING_AT",
      servicePriceRangeMaxInCents: null,
    };
  }

  return {
    servicePriceDefaultInCents: defaultPriceInCents,
    servicePriceSpecificationType: "RANGE",
    servicePriceRangeMaxInCents:
      priceSpecification.maxPriceInCents ?? priceInCents,
  };
}

export class PrismaAppointmentMapper {
  static toDomain(raw: PrismaAppointmentWithBookedServices): Appointment {
    const hasVehicleSnapshot =
      raw.vehiclePlate !== null ||
      raw.vehicleBrand !== null ||
      raw.vehicleModel !== null ||
      raw.vehicleColor !== null ||
      raw.vehicleYear !== null;

    return Appointment.create(
      {
        establishmentId: new UniqueEntityId(raw.establishmentId),
        customerId: new UniqueEntityId(raw.customerId),
        customer: {
          fullName: raw.customerFullName,
        },
        vehicleId: raw.vehicleId ? new UniqueEntityId(raw.vehicleId) : null,
        services: raw.bookedServices
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((bookedService) => ({
            serviceId: new UniqueEntityId(bookedService.serviceId),
            serviceName: bookedService.serviceName,
            category: toCategorySnapshot(
              bookedService.serviceCategoryId,
              bookedService.serviceCategoryName,
            ),
            durationInMinutes:
              bookedService.serviceDurationInMinutes ?? undefined,
            priceSpecification: toPriceSpecificationSnapshot(bookedService),
            priceInCents: bookedService.servicePriceInCents,
            isActive: bookedService.serviceIsActive,
          })),
        vehicle: hasVehicleSnapshot
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
          raw.discountInCents !== null
            ? Money.create(raw.discountInCents)
            : null,
        status: raw.status,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
        doneAt: raw.doneAt,
        cancelledAt: raw.cancelledAt,
        deletedAt: raw.deletedAt,
      },
      new UniqueEntityId(raw.id),
    );
  }

  private static toBookedServicesCreate(
    raw: Appointment,
  ): Prisma.AppointmentBookedServiceUncheckedCreateWithoutAppointmentInput[] {
    return raw.services.map((service, index) => ({
      serviceId: service.serviceId.toString(),
      serviceName: service.serviceName,
      serviceCategoryId: service.category?.id.toString() ?? null,
      serviceCategoryName: service.category?.name ?? null,
      serviceDurationInMinutes: service.durationInMinutes ?? null,
      servicePriceInCents: service.priceInCents,
      ...toBookedServicePricePersistence(
        service.priceSpecification,
        service.priceInCents,
      ),
      serviceIsActive: service.isActive ?? true,
      position: index,
    }));
  }

  static toPrisma(raw: Appointment): Prisma.AppointmentUncheckedCreateInput {
    return {
      id: raw.id.toString(),
      establishmentId: raw.establishmentId.toString(),
      customerId: raw.customerId.toString(),
      customerFullName: raw.customer.fullName,
      vehicleId: raw.vehicleId?.toString() ?? null,
      bookedServices: {
        create: PrismaAppointmentMapper.toBookedServicesCreate(raw),
      },
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
      deletedAt: raw.deletedAt,
    };
  }

  static toPrismaUpdate(
    raw: Appointment,
  ): Prisma.AppointmentUncheckedUpdateInput {
    return {
      customerFullName: raw.customer.fullName,
      vehicleId: raw.vehicleId?.toString() ?? null,
      bookedServices: {
        deleteMany: {},
        create: PrismaAppointmentMapper.toBookedServicesCreate(raw),
      },
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
      deletedAt: raw.deletedAt,
    };
  }
}
