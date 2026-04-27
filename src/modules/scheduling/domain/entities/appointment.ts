import { ServiceCategory } from "../../../catalog/domain/value-objects/service-category";
import { Money } from "../../../catalog/domain/value-objects/money";
import { AggregateRoot } from "../../../../shared/entities/aggregate-root";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Optional } from "../../../../shared/types/optional";
import { InvalidAppointmentInputError } from "../errors/invalid-appointment-input-error";

export type AppointmentStatus = "SCHEDULED" | "DONE" | "CANCELLED";

export type AppointmentServiceSnapshot = {
  serviceId: UniqueEntityId;
  serviceName: string;
  category: ServiceCategory | undefined;
  durationInMinutes: number | undefined;
  priceInCents: number;
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
  vehicleId: UniqueEntityId | null;
  service: AppointmentServiceSnapshot;
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
};

type AppointmentCreateProps = Optional<
  AppointmentProps,
  "status" | "createdAt" | "updatedAt" | "doneAt" | "cancelledAt"
>;

export class Appointment extends AggregateRoot<AppointmentProps> {
  get establishmentId() {
    return this.props.establishmentId;
  }

  get customerId() {
    return this.props.customerId;
  }

  get vehicleId() {
    return this.props.vehicleId;
  }

  get service() {
    return this.props.service;
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
      },
      id,
    );

    appointment.assertValidState();

    return appointment;
  }

  changeStatus(status: AppointmentStatus, referenceDate: Date = new Date()) {
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

  private touch() {
    this.props.updatedAt = new Date();
  }

  private assertValidState() {
    this.assertValidDate(this.props.startsAt, "startsAt must be a valid date.");
    this.assertNullableDate(this.props.endsAt, "endsAt must be a valid date.");
    this.assertValidDate(this.props.createdAt, "createdAt must be a valid date.");
    this.assertValidDate(this.props.updatedAt, "updatedAt must be a valid date.");
    this.assertNullableDate(this.props.doneAt, "doneAt must be a valid date.");
    this.assertNullableDate(
      this.props.cancelledAt,
      "cancelledAt must be a valid date.",
    );

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
