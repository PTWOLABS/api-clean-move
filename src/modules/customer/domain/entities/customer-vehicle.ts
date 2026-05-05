import { AggregateRoot } from "../../../../shared/entities/aggregate-root";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Optional } from "../../../../shared/types/optional";
import { InvalidCustomerInputError } from "../errors/invalid-customer-input-error";

export type CustomerVehicleProps = {
  establishmentId: UniqueEntityId;
  customerId: UniqueEntityId;
  imageUrl: string | null;
  plate: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
  notes: string | null;
  deletedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export class CustomerVehicle extends AggregateRoot<CustomerVehicleProps> {
  get establishmentId() {
    return this.props.establishmentId;
  }

  get customerId() {
    return this.props.customerId;
  }

  get imageUrl() {
    return this.props.imageUrl;
  }

  get plate() {
    return this.props.plate;
  }

  get brand() {
    return this.props.brand;
  }

  get model() {
    return this.props.model;
  }

  get color() {
    return this.props.color;
  }

  get year() {
    return this.props.year;
  }

  get notes() {
    return this.props.notes;
  }

  get deletedAt() {
    return this.props.deletedAt;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }

  static create(
    props: Optional<
      CustomerVehicleProps,
      "createdAt" | "updatedAt" | "deletedAt" | "imageUrl"
    >,
    id?: UniqueEntityId,
  ) {
    return new CustomerVehicle(
      {
        ...props,
        imageUrl: CustomerVehicle.normalizeOptionalText(props.imageUrl ?? null),
        plate: CustomerVehicle.normalizePlate(props.plate),
        brand: CustomerVehicle.normalizeOptionalText(props.brand),
        model: CustomerVehicle.normalizeOptionalText(props.model),
        color: CustomerVehicle.normalizeOptionalText(props.color),
        notes: CustomerVehicle.normalizeOptionalText(props.notes),
        year: CustomerVehicle.normalizeYear(props.year),
        deletedAt: props.deletedAt ?? null,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id,
    );
  }

  update(data: {
    imageUrl?: string | null;
    plate?: string | null;
    brand?: string | null;
    model?: string | null;
    color?: string | null;
    year?: number | null;
    notes?: string | null;
  }) {
    if (data.imageUrl !== undefined) {
      this.props.imageUrl = CustomerVehicle.normalizeOptionalText(
        data.imageUrl,
      );
    }

    if (data.plate !== undefined) {
      this.props.plate = CustomerVehicle.normalizePlate(data.plate);
    }

    if (data.brand !== undefined) {
      this.props.brand = CustomerVehicle.normalizeOptionalText(data.brand);
    }

    if (data.model !== undefined) {
      this.props.model = CustomerVehicle.normalizeOptionalText(data.model);
    }

    if (data.color !== undefined) {
      this.props.color = CustomerVehicle.normalizeOptionalText(data.color);
    }

    if (data.year !== undefined) {
      this.props.year = CustomerVehicle.normalizeYear(data.year);
    }

    if (data.notes !== undefined) {
      this.props.notes = CustomerVehicle.normalizeOptionalText(data.notes);
    }

    this.touch();
  }

  softDelete(referenceDate: Date = new Date()) {
    this.props.deletedAt = referenceDate;
    this.touch();
  }

  isDeleted() {
    return this.props.deletedAt !== null;
  }

  private touch() {
    this.props.updatedAt = new Date();
  }

  private static normalizePlate(value: string | null) {
    if (value === null) {
      return null;
    }

    const normalized = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    if (!normalized) {
      return null;
    }

    if (normalized.length !== 7) {
      throw new InvalidCustomerInputError("plate must have exactly 7 chars.");
    }

    return normalized;
  }

  private static normalizeYear(value: number | null) {
    if (value === null) {
      return null;
    }

    if (!Number.isInteger(value) || value < 1900) {
      throw new InvalidCustomerInputError("year must be a valid integer.");
    }

    return value;
  }

  private static normalizeOptionalText(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }
}
