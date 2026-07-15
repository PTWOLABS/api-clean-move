import { ServiceCategorySnapshot } from "../../../catalog/domain/value-objects/service-category-ref";
import {
  InvalidServiceNameError,
  ServiceName,
} from "../../../catalog/domain/value-objects/service-name";
import { ValueObject } from "../../../../shared/entities/value-object";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { InvalidQuoteInputError } from "../errors/invalid-quote-input-error";

export type QuoteServiceSnapshot = {
  quoteServiceId: UniqueEntityId;
  serviceId: UniqueEntityId | null;
  serviceName: string;
  category?: ServiceCategorySnapshot | undefined;
  durationInMinutes?: number | undefined;
  priceInCents: number;
  isCourtesy: boolean;
};

export type QuoteServiceSnapshotInput = Omit<
  QuoteServiceSnapshot,
  "quoteServiceId" | "serviceId" | "isCourtesy"
> & {
  quoteServiceId?: UniqueEntityId;
  serviceId?: UniqueEntityId | null;
  isCourtesy?: boolean;
};

export class QuotedServiceSnapshot extends ValueObject<QuoteServiceSnapshot> {
  private constructor(props: QuoteServiceSnapshot) {
    super(props);
  }

  get quoteServiceId() {
    return this.props.quoteServiceId;
  }

  get serviceId() {
    return this.props.serviceId;
  }

  get serviceName() {
    return this.props.serviceName;
  }

  get category() {
    return this.props.category;
  }

  get durationInMinutes() {
    return this.props.durationInMinutes;
  }

  get priceInCents() {
    return this.props.priceInCents;
  }

  get isCourtesy() {
    return this.props.isCourtesy;
  }

  get effectivePriceInCents() {
    return this.isCourtesy ? 0 : this.priceInCents;
  }

  get courtesyValueInCents() {
    return this.isCourtesy ? this.priceInCents : 0;
  }

  withServiceId(serviceId: UniqueEntityId) {
    return QuotedServiceSnapshot.create({
      ...this.toValue(),
      serviceId,
    });
  }

  withServiceName(serviceName: string) {
    return QuotedServiceSnapshot.create({
      ...this.toValue(),
      serviceName,
    });
  }

  static create(props: QuoteServiceSnapshotInput) {
    let serviceName: ServiceName;

    try {
      serviceName = ServiceName.create(props.serviceName);
    } catch (error) {
      if (error instanceof InvalidServiceNameError) {
        throw new InvalidQuoteInputError(error.message);
      }

      throw new InvalidQuoteInputError("Invalid serviceName.");
    }

    if (
      props.quoteServiceId !== undefined &&
      !(props.quoteServiceId instanceof UniqueEntityId)
    ) {
      throw new InvalidQuoteInputError("Invalid quoteServiceId.");
    }

    if (
      props.serviceId !== undefined &&
      props.serviceId !== null &&
      !(props.serviceId instanceof UniqueEntityId)
    ) {
      throw new InvalidQuoteInputError("Invalid serviceId.");
    }

    if (!Number.isInteger(props.priceInCents) || props.priceInCents < 0) {
      throw new InvalidQuoteInputError(
        "Service price must be an integer greater than or equal to zero.",
      );
    }

    if (props.durationInMinutes !== undefined) {
      if (
        !Number.isInteger(props.durationInMinutes) ||
        props.durationInMinutes <= 0
      ) {
        throw new InvalidQuoteInputError(
          "Service duration must be an integer greater than zero.",
        );
      }
    }

    if (
      props.isCourtesy !== undefined &&
      typeof props.isCourtesy !== "boolean"
    ) {
      throw new InvalidQuoteInputError("isCourtesy must be a boolean.");
    }

    return new QuotedServiceSnapshot({
      ...props,
      quoteServiceId: props.quoteServiceId ?? new UniqueEntityId(),
      serviceId: props.serviceId ?? null,
      serviceName: serviceName.value,
      isCourtesy: props.isCourtesy ?? false,
    });
  }

  toValue(): QuoteServiceSnapshot {
    return { ...this.props };
  }
}
