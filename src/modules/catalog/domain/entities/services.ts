import { AggregateRoot } from "../../../../shared/entities/aggregate-root";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Optional } from "../../../../shared/types/optional";
import { ServiceAlreadyDeletedError } from "../errors/service-already-deleted-error";
import { InvalidEstimatedDurationTransitionError } from "../errors/invalid-estimated-duration-transition-error";
import { EstimatedDuration } from "../value-objects/estimated-duration";
import { Money } from "../value-objects/money";
import { ServiceCategory } from "../value-objects/service-category";
import { ServiceName } from "../value-objects/service-name";

export type ServiceProps = {
  establishmentId: UniqueEntityId;
  serviceName: ServiceName;
  description: string | undefined;
  category: ServiceCategory | undefined;
  estimatedDuration: EstimatedDuration | undefined;
  price: Money;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export class Service extends AggregateRoot<ServiceProps> {
  get establishmentId() {
    return this.props.establishmentId;
  }

  get serviceName() {
    return this.props.serviceName;
  }

  get description() {
    return this.props.description;
  }

  get category() {
    return this.props.category;
  }

  get estimatedDuration() {
    return this.props.estimatedDuration;
  }

  get price() {
    return this.props.price;
  }

  get isActive() {
    return this.props.isActive;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }

  get deletedAt() {
    return this.props.deletedAt;
  }

  isDeleted() {
    return this.props.deletedAt !== null;
  }

  softDelete(referenceDate: Date = new Date()) {
    if (this.isDeleted()) {
      throw new ServiceAlreadyDeletedError();
    }

    this.props.deletedAt = referenceDate;
    this.touch();
  }

  update(data: {
    serviceName?: string;
    description?: string;
    category?: ServiceCategory;
    estimatedDuration?: {
      minInMinutes: number;
      maxInMinutes?: number | null | undefined;
    };
    price?: number;
    isActive?: boolean;
  }) {
    if (this.isDeleted()) {
      throw new ServiceAlreadyDeletedError();
    }

    const newEstimatedDuration =
      data.estimatedDuration !== undefined
        ? EstimatedDuration.create(data.estimatedDuration)
        : undefined;

    const newServiceName =
      data.serviceName !== undefined
        ? ServiceName.create(data.serviceName)
        : undefined;

    const newPrice =
      data.price !== undefined ? Money.create(data.price) : undefined;

    if (newEstimatedDuration) {
      this.changeEstimatedDuration(newEstimatedDuration);
    }

    if (newServiceName !== undefined) {
      this.changeServiceName(newServiceName);
    }

    if (newPrice) {
      this.changePrice(newPrice);
    }

    if (data.description !== undefined) {
      this.changeDescription(data.description);
    }

    if (data.category !== undefined) {
      this.changeCategory(data.category);
    }

    if (data.isActive !== undefined) {
      this.changeIsActive(data.isActive);
    }
  }

  changeServiceName(serviceName: ServiceName) {
    if (this.serviceName.equals(serviceName)) return;

    this.props.serviceName = serviceName;
    this.touch();
  }

  changeDescription(description: string) {
    const normalizedDescription = description.trim();

    if (this.description === normalizedDescription) return;

    this.props.description = normalizedDescription;
    this.touch();
  }

  changeCategory(category: ServiceCategory) {
    if (this.category === category) return;

    this.props.category = category;
    this.touch();
  }

  changeEstimatedDuration(estimatedDuration: EstimatedDuration) {
    if (this.estimatedDuration?.equals(estimatedDuration)) return;

    if (
      this.estimatedDuration &&
      this.estimatedDuration.maxInMinutes &&
      estimatedDuration.minInMinutes > this.estimatedDuration.maxInMinutes
    ) {
      throw new InvalidEstimatedDurationTransitionError();
    }

    this.props.estimatedDuration = estimatedDuration;
    this.touch();
  }

  changePrice(price: Money) {
    if (this.price.equalsValue(price)) return;

    this.props.price = price;
    this.touch();
  }

  changeIsActive(isActive: boolean) {
    if (this.isActive === isActive) return;

    this.props.isActive = isActive;
    this.touch();
  }

  private touch() {
    this.props.updatedAt = new Date();
  }

  static create(
    props: Optional<
      ServiceProps,
      | "createdAt"
      | "updatedAt"
      | "isActive"
      | "description"
      | "category"
      | "estimatedDuration"
      | "deletedAt"
    >,
    id?: UniqueEntityId,
  ) {
    const service = new Service(
      {
        ...props,
        description: props.description,
        category: props.category,
        estimatedDuration: props.estimatedDuration,
        isActive: props.isActive ?? true,
        deletedAt: props.deletedAt ?? null,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id,
    );

    return service;
  }
}
