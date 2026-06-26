import { ServiceCategorySnapshot } from "../../../catalog/domain/value-objects/service-category-ref";
import { Money } from "../../../catalog/domain/value-objects/money";
import { ServicePriceSpecificationValue } from "../../../catalog/domain/value-objects/service-price-specification";
import { AggregateRoot } from "../../../../shared/entities/aggregate-root";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Optional } from "../../../../shared/types/optional";
import { AppointmentAlreadyDeletedError } from "../errors/appointment-already-deleted-error";
import { DoneAppointmentCannotBeDeletedError } from "../errors/done-appointment-cannot-be-deleted-error";
import { InvalidAppointmentInputError } from "../errors/invalid-appointment-input-error";
import { BookedServiceSnapshot } from "../value-objects/booked-service-snapshot";

export type AppointmentStatus = "SCHEDULED" | "DONE" | "CANCELLED";
export type AppointmentResourceStatus = "UNCHANGED" | "UPDATED" | "DELETED";

type AppointmentCurrentResourceStatuses = {
  customer?: AppointmentResourceStatus;
  services?: Map<string, AppointmentResourceStatus>;
  vehicle?: AppointmentResourceStatus;
};

export type AppointmentServiceSnapshot = {
  serviceId: UniqueEntityId;
  serviceName: string;
  category: ServiceCategorySnapshot | undefined;
  durationInMinutes: number | undefined;
  priceSpecification?: ServicePriceSpecificationValue;
  priceInCents: number;
  isActive?: boolean;
};

export type AppointmentCustomerSnapshot = {
  fullName: string;
};

export type AppointmentVehicleSnapshot = {
  plate: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
} | null;

export type AppointmentProps = {
  establishmentId: UniqueEntityId;
  customerId: UniqueEntityId;
  customer: AppointmentCustomerSnapshot;
  vehicleId: UniqueEntityId | null;
  services: AppointmentServiceSnapshot[];
  vehicle: AppointmentVehicleSnapshot;
  startsAt: Date;
  endsAt: Date | null;
  description: string | null;
  discountInCents: Money | null;
  status: AppointmentStatus;
  createdAt: Date;
  updatedAt: Date;
  doneAt: Date | null;
  cancelledAt: Date | null;
  deletedAt: Date | null;
};

type AppointmentCreateProps = Optional<
  AppointmentProps,
  "status" | "createdAt" | "updatedAt" | "doneAt" | "cancelledAt" | "deletedAt"
>;

type AppointmentUpdateProps = Partial<
  Pick<
    AppointmentProps,
    | "customerId"
    | "customer"
    | "vehicleId"
    | "services"
    | "vehicle"
    | "startsAt"
    | "endsAt"
    | "description"
    | "discountInCents"
  >
>;

export class Appointment extends AggregateRoot<AppointmentProps> {
  private currentResourceStatuses: AppointmentCurrentResourceStatuses = {};

  get establishmentId() {
    return this.props.establishmentId;
  }

  get customerId() {
    return this.props.customerId;
  }

  get customer() {
    return this.props.customer;
  }

  get vehicleId() {
    return this.props.vehicleId;
  }

  get services() {
    return this.props.services;
  }

  get vehicle() {
    return this.props.vehicle;
  }

  get startsAt() {
    return this.props.startsAt;
  }

  get endsAt() {
    return this.props.endsAt;
  }

  get description() {
    return this.props.description;
  }

  get discountInCents() {
    return this.props.discountInCents;
  }

  get status() {
    return this.props.status;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }

  get doneAt() {
    return this.props.doneAt;
  }

  get cancelledAt() {
    return this.props.cancelledAt;
  }

  get deletedAt() {
    return this.props.deletedAt;
  }

  get customerCurrentResourceStatus(): AppointmentResourceStatus {
    return this.currentResourceStatuses.customer ?? "UNCHANGED";
  }

  get vehicleCurrentResourceStatus(): AppointmentResourceStatus {
    return this.currentResourceStatuses.vehicle ?? "UNCHANGED";
  }

  getServiceCurrentResourceStatus(
    serviceId: UniqueEntityId,
  ): AppointmentResourceStatus {
    return (
      this.currentResourceStatuses.services?.get(serviceId.toString()) ??
      "UNCHANGED"
    );
  }

  setCurrentResourceStatuses(statuses: {
    customer: AppointmentResourceStatus;
    services: Array<{
      serviceId: UniqueEntityId;
      status: AppointmentResourceStatus;
    }>;
    vehicle?: AppointmentResourceStatus;
  }) {
    this.currentResourceStatuses = {
      customer: statuses.customer,
      services: new Map(
        statuses.services.map((service) => [
          service.serviceId.toString(),
          service.status,
        ]),
      ),
      ...(statuses.vehicle ? { vehicle: statuses.vehicle } : {}),
    };
  }

  static totalServicesPriceInCents(services: AppointmentServiceSnapshot[]) {
    return services.reduce((total, service) => total + service.priceInCents, 0);
  }

  static create(props: AppointmentCreateProps, id?: UniqueEntityId) {
    const appointment = new Appointment(
      {
        ...props,
        description: Appointment.normalizeDescription(props.description),
        discountInCents: props.discountInCents ?? null,
        status: props.status ?? "SCHEDULED",
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
        doneAt: props.doneAt ?? null,
        cancelledAt: props.cancelledAt ?? null,
        deletedAt: props.deletedAt ?? null,
      },
      id,
    );

    appointment.assertValidState();

    return appointment;
  }

  changeStatus(status: AppointmentStatus, referenceDate: Date = new Date()) {
    this.assertNotDeleted();
    this.assertValidDate(referenceDate, "referenceDate must be a valid date.");

    this.props.status = status;

    if (status === "DONE") {
      this.props.doneAt = referenceDate;
      this.props.cancelledAt = null;
    }

    if (status === "CANCELLED") {
      this.props.cancelledAt = referenceDate;
      this.props.doneAt = null;
    }

    if (status === "SCHEDULED") {
      this.props.doneAt = null;
      this.props.cancelledAt = null;
    }

    this.touch();
  }

  update(props: AppointmentUpdateProps) {
    this.assertNotDeleted();

    const previousProps = this.props;

    this.props = {
      ...this.props,
      ...props,
      ...(props.description !== undefined
        ? { description: Appointment.normalizeDescription(props.description) }
        : {}),
    };

    try {
      this.assertValidState();
    } catch (error) {
      this.props = previousProps;
      throw error;
    }

    this.touch();
  }

  softDelete(referenceDate: Date = new Date()) {
    this.assertValidDate(referenceDate, "referenceDate must be a valid date.");

    if (this.status === "DONE") {
      throw new DoneAppointmentCannotBeDeletedError();
    }

    if (this.isDeleted()) {
      throw new AppointmentAlreadyDeletedError();
    }

    this.props.deletedAt = referenceDate;
    this.touch();
  }

  isDeleted() {
    return this.props.deletedAt !== null;
  }

  private touch() {
    this.props.updatedAt = new Date();
  }

  private assertNotDeleted() {
    if (this.isDeleted()) {
      throw new AppointmentAlreadyDeletedError();
    }
  }

  private assertValidState() {
    this.assertValidDate(this.props.startsAt, "startsAt must be a valid date.");
    this.assertNullableDate(this.props.endsAt, "endsAt must be a valid date.");
    this.assertValidDate(
      this.props.createdAt,
      "createdAt must be a valid date.",
    );
    this.assertValidDate(
      this.props.updatedAt,
      "updatedAt must be a valid date.",
    );
    this.assertNullableDate(this.props.doneAt, "doneAt must be a valid date.");
    this.assertNullableDate(
      this.props.cancelledAt,
      "cancelledAt must be a valid date.",
    );
    this.assertNullableDate(
      this.props.deletedAt,
      "deletedAt must be a valid date.",
    );

    if (this.props.services.length === 0) {
      throw new InvalidAppointmentInputError(
        "At least one service is required.",
      );
    }

    if (!this.props.customer?.fullName?.trim()) {
      throw new InvalidAppointmentInputError("customer.fullName is required.");
    }

    const serviceIds = new Set<string>();

    for (const service of this.props.services) {
      const serviceId = service.serviceId.toString();

      if (serviceIds.has(serviceId)) {
        throw new InvalidAppointmentInputError(
          "Duplicate services are not allowed in the same appointment.",
        );
      }

      serviceIds.add(serviceId);

      BookedServiceSnapshot.create({
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        category: service.category,
        durationInMinutes: service.durationInMinutes,
        priceInCents: service.priceInCents,
      });
    }

    if (this.props.discountInCents) {
      const discountInCents = this.props.discountInCents.amountInCents;
      const totalServicesPriceInCents = Appointment.totalServicesPriceInCents(
        this.props.services,
      );

      if (discountInCents <= 0) {
        throw new InvalidAppointmentInputError(
          "discountInCents must be greater than zero.",
        );
      }

      if (discountInCents > totalServicesPriceInCents) {
        throw new InvalidAppointmentInputError(
          "discountInCents must be less than or equal to total services price.",
        );
      }
    }

    if (
      this.props.endsAt &&
      this.props.endsAt.getTime() <= this.props.startsAt.getTime()
    ) {
      throw new InvalidAppointmentInputError(
        "endsAt must be greater than startsAt.",
      );
    }
  }

  private assertValidDate(value: Date, message: string) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new InvalidAppointmentInputError(message);
    }
  }

  private assertNullableDate(value: Date | null, message: string) {
    if (value === null) {
      return;
    }

    this.assertValidDate(value, message);
  }

  private static normalizeDescription(description: string | null) {
    const normalizedDescription = description?.trim();

    if (!normalizedDescription) {
      return null;
    }

    return normalizedDescription;
  }
}
