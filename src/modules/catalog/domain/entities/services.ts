import { AggregateRoot } from "../../../../shared/entities/aggregate-root";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Optional } from "../../../../shared/types/optional";
import { ServiceAlreadyDeletedError } from "../errors/service-already-deleted-error";
import { InvalidEstimatedDurationTransitionError } from "../errors/invalid-estimated-duration-transition-error";
import { EstimatedDuration } from "../value-objects/estimated-duration";
import { Money } from "../value-objects/money";
import { ServiceCategoryRef } from "../value-objects/service-category-ref";
import { ServiceName } from "../value-objects/service-name";
import {
  ServicePriceSpecification,
  ServicePriceSpecificationValue,
} from "../value-objects/service-price-specification";

export type ServiceProps = {
  establishmentId: UniqueEntityId;
  serviceName: ServiceName;
  description: string | undefined;
  category: ServiceCategoryRef | undefined;
  estimatedDuration: EstimatedDuration | undefined;
  priceSpecification: ServicePriceSpecification;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type ServiceCreateProps = Optional<
  ServiceProps,
  | "createdAt"
  | "updatedAt"
  | "isActive"
  | "description"
  | "category"
  | "estimatedDuration"
  | "deletedAt"
  | "priceSpecification"
> & {
  price?: Money;
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

  get categoryId() {
    return this.props.category?.id;
  }

  get estimatedDuration() {
    return this.props.estimatedDuration;
  }

  get priceSpecification() {
    return this.props.priceSpecification;
  }

  get price() {
    return Money.create(
      this.props.priceSpecification.defaultChargePriceInCents,
    );
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
    categoryId?: string | null;
    categoryName?: string;
    estimatedDuration?: {
      minInMinutes: number;
      maxInMinutes?: number | null | undefined;
    };
    price?: number;
    priceSpecification?: ServicePriceSpecificationValue;
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

    const newPriceSpecification =
      data.priceSpecification !== undefined
        ? ServicePriceSpecification.create(data.priceSpecification)
        : data.price !== undefined
          ? ServicePriceSpecification.create({
              type: "FIXED",
              fixedPriceInCents: data.price,
            })
          : undefined;

    if (newEstimatedDuration) {
      this.changeEstimatedDuration(newEstimatedDuration);
    }

    if (newServiceName !== undefined) {
      this.changeServiceName(newServiceName);
    }

    if (newPriceSpecification) {
      this.changePriceSpecification(newPriceSpecification);
    }

    if (data.description !== undefined) {
      this.changeDescription(data.description);
    }

    if (data.categoryId !== undefined) {
      if (data.categoryId === null) {
        this.clearCategory();
      } else if (data.categoryName) {
        this.changeCategory({
          id: new UniqueEntityId(data.categoryId),
          name: data.categoryName,
        });
      }
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

  changeCategory(category: ServiceCategoryRef) {
    if (
      this.category?.id.equals(category.id) &&
      this.category.name === category.name
    ) {
      return;
    }

    this.props.category = category;
    this.touch();
  }

  clearCategory() {
    if (!this.category) return;

    this.props.category = undefined;
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

  changePriceSpecification(priceSpecification: ServicePriceSpecification) {
    if (this.priceSpecification.equals(priceSpecification)) return;

    this.props.priceSpecification = priceSpecification;
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

  static create(props: ServiceCreateProps, id?: UniqueEntityId) {
    const { price, ...serviceProps } = props;
    const priceSpecification =
      serviceProps.priceSpecification ??
      ServicePriceSpecification.create({
        type: "FIXED",
        fixedPriceInCents: price?.amountInCents ?? 0,
      });

    const service = new Service(
      {
        ...serviceProps,
        description: serviceProps.description,
        category: serviceProps.category,
        estimatedDuration: serviceProps.estimatedDuration,
        priceSpecification,
        isActive: serviceProps.isActive ?? true,
        deletedAt: serviceProps.deletedAt ?? null,
        createdAt: serviceProps.createdAt ?? new Date(),
        updatedAt: serviceProps.updatedAt ?? new Date(),
      },
      id,
    );

    return service;
  }
}
