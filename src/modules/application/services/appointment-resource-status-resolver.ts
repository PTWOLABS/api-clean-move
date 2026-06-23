import { Injectable } from "@nestjs/common";

import {
  Appointment,
  AppointmentResourceStatus,
  AppointmentServiceSnapshot,
  AppointmentVehicleSnapshot,
} from "../../scheduling/domain/entities/appointment";
import { Service } from "../../catalog/domain/entities/services";
import { ServicePriceSpecificationValue } from "../../catalog/domain/value-objects/service-price-specification";
import { Customer } from "../../customer/domain/entities/customer";
import { CustomerVehicle } from "../../customer/domain/entities/customer-vehicle";
import { CustomersRepository } from "../repositories/customers-repository";
import { CustomerVehiclesRepository } from "../repositories/customer-vehicles-repository";
import { ServicesRepository } from "../repositories/services-repository";

@Injectable()
export class AppointmentResourceStatusResolver {
  constructor(
    private customersRepository: CustomersRepository,
    private customerVehiclesRepository: CustomerVehiclesRepository,
    private servicesRepository: ServicesRepository,
  ) {}

  async applyToAppointments(
    appointments: Appointment[],
    establishmentId: string,
  ): Promise<void> {
    if (appointments.length === 0) {
      return;
    }

    const customerIds = unique(
      appointments.map((appointment) => appointment.customerId.toString()),
    );
    const serviceIds = unique(
      appointments.flatMap((appointment) =>
        appointment.services.map((service) => service.serviceId.toString()),
      ),
    );
    const vehicleIds = unique(
      appointments
        .map((appointment) => appointment.vehicleId?.toString())
        .filter((vehicleId): vehicleId is string => vehicleId !== undefined),
    );

    const [customers, services, vehicles] = await Promise.all([
      this.customersRepository.findManyByIdsAndEstablishmentIdIncludingDeleted(
        customerIds,
        establishmentId,
      ),
      this.servicesRepository.findManyByIdsAndEstablishmentIdIncludingDeleted(
        serviceIds,
        establishmentId,
      ),
      this.customerVehiclesRepository.findManyByIdsAndEstablishmentIdIncludingDeleted(
        vehicleIds,
        establishmentId,
      ),
    ]);

    const customersById = mapById(customers); // {customer-1: {id: string; fullName: string}}
    const servicesById = mapById(services);
    const vehiclesById = mapById(vehicles);

    for (const appointment of appointments) {
      const vehicleStatus = resolveVehicleStatus(
        appointment.vehicle,
        appointment.vehicleId?.toString() ?? null,
        appointment.vehicleId
          ? vehiclesById.get(appointment.vehicleId.toString())
          : undefined,
      );

      appointment.setCurrentResourceStatuses({
        customer: resolveCustomerStatus(
          appointment.customer.fullName,
          customersById.get(appointment.customerId.toString()),
        ),
        services: appointment.services.map((service) => ({
          serviceId: service.serviceId,
          status: resolveServiceStatus(
            service,
            servicesById.get(service.serviceId.toString()),
          ),
        })),
        ...(vehicleStatus ? { vehicle: vehicleStatus } : {}),
      });
    }
  }
}

function resolveCustomerStatus(
  snapshotFullName: string,
  customer: Customer | undefined,
): AppointmentResourceStatus {
  if (!customer || customer.isDeleted()) {
    return "DELETED";
  }

  return customer.fullName === snapshotFullName ? "UNCHANGED" : "UPDATED";
}

function resolveServiceStatus(
  snapshot: AppointmentServiceSnapshot,
  service: Service | undefined,
): AppointmentResourceStatus {
  if (!service || service.isDeleted()) {
    return "DELETED";
  }

  const currentDuration =
    service.estimatedDuration?.upperBoundInMinutes ?? undefined;
  const snapshotPriceSpecification =
    snapshot.priceSpecification ?? legacyFixedPriceSpecification(snapshot);

  if (
    service.serviceName.value !== snapshot.serviceName ||
    currentDuration !== snapshot.durationInMinutes ||
    service.isActive !== (snapshot.isActive ?? true) ||
    !servicePriceSpecificationsEqual(
      service.priceSpecification.toValue(),
      snapshotPriceSpecification,
    )
  ) {
    return "UPDATED";
  }

  return "UNCHANGED";
}

function legacyFixedPriceSpecification(
  snapshot: AppointmentServiceSnapshot,
): ServicePriceSpecificationValue {
  return {
    type: "FIXED",
    fixedPriceInCents: snapshot.priceInCents,
  };
}

function servicePriceSpecificationsEqual(
  current: ServicePriceSpecificationValue,
  snapshot: ServicePriceSpecificationValue,
): boolean {
  return (
    current.type === snapshot.type &&
    (current.fixedPriceInCents ?? null) ===
      (snapshot.fixedPriceInCents ?? null) &&
    (current.minPriceInCents ?? null) === (snapshot.minPriceInCents ?? null) &&
    (current.maxPriceInCents ?? null) === (snapshot.maxPriceInCents ?? null)
  );
}

function resolveVehicleStatus(
  snapshot: AppointmentVehicleSnapshot,
  vehicleId: string | null,
  vehicle: CustomerVehicle | undefined,
): AppointmentResourceStatus | undefined {
  if (!snapshot) {
    return undefined;
  }

  if (!vehicleId) {
    return "UNCHANGED";
  }

  if (!vehicle || vehicle.isDeleted()) {
    return "DELETED";
  }

  if (
    vehicle.plate !== snapshot.plate ||
    vehicle.brand !== snapshot.brand ||
    vehicle.model !== snapshot.model ||
    vehicle.color !== snapshot.color ||
    vehicle.year !== snapshot.year
  ) {
    return "UPDATED";
  }

  return "UNCHANGED";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function mapById<T extends { id: { toString(): string } }>(items: T[]) {
  return new Map(items.map((item) => [item.id.toString(), item]));
}
