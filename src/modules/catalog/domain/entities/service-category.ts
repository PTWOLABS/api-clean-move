import { AggregateRoot } from "../../../../shared/entities/aggregate-root";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Optional } from "../../../../shared/types/optional";
import { ServiceCategoryAlreadyDeletedError } from "../errors/service-category-already-deleted-error";
import { CategoryName } from "../value-objects/category-name";

export type ServiceCategoryProps = {
  establishmentId: UniqueEntityId;
  name: CategoryName;
  deletedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export class ServiceCategory extends AggregateRoot<ServiceCategoryProps> {
  get establishmentId() {
    return this.props.establishmentId;
  }

  get name() {
    return this.props.name;
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

  isDeleted() {
    return this.props.deletedAt !== null;
  }

  rename(name: CategoryName) {
    if (this.isDeleted()) {
      throw new ServiceCategoryAlreadyDeletedError();
    }

    if (this.name.equals(name)) {
      return;
    }

    this.props.name = name;
    this.touch();
  }

  softDelete(referenceDate: Date = new Date()) {
    if (this.isDeleted()) {
      throw new ServiceCategoryAlreadyDeletedError();
    }

    this.props.deletedAt = referenceDate;
    this.touch();
  }

  private touch() {
    this.props.updatedAt = new Date();
  }

  static create(
    props: Optional<
      ServiceCategoryProps,
      "createdAt" | "updatedAt" | "deletedAt"
    >,
    id?: UniqueEntityId,
  ) {
    return new ServiceCategory(
      {
        ...props,
        deletedAt: props.deletedAt ?? null,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id,
    );
  }
}
