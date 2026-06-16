import { ValueObject } from "../../../../shared/entities/value-object";

export type ServicePriceSpecificationType = "FIXED" | "STARTING_AT" | "RANGE";

export type ServicePriceSpecificationValue = {
  type: ServicePriceSpecificationType;
  fixedPriceInCents?: number;
  minPriceInCents?: number;
  maxPriceInCents?: number;
};

type ServicePriceSpecificationProps = {
  type: ServicePriceSpecificationType;
  defaultPriceInCents: number;
  maxPriceInCents?: number;
};

export class InvalidServicePriceSpecificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidServicePriceSpecificationError";
  }
}

export class ServicePriceSpecification extends ValueObject<ServicePriceSpecificationProps> {
  private constructor(props: ServicePriceSpecificationProps) {
    super(props);
  }

  get type() {
    return this.props.type;
  }

  get defaultChargePriceInCents() {
    return this.props.defaultPriceInCents;
  }

  get maxPriceInCents() {
    return this.props.maxPriceInCents;
  }

  assertCanCharge(priceInCents: number) {
    ServicePriceSpecification.assertNonNegativeInteger(
      priceInCents,
      "priceInCents",
    );

    if (
      this.type === "FIXED" &&
      priceInCents !== this.defaultChargePriceInCents
    ) {
      throw new InvalidServicePriceSpecificationError(
        "charged price must equal fixed service price.",
      );
    }

    if (
      this.type === "STARTING_AT" &&
      priceInCents < this.defaultChargePriceInCents
    ) {
      throw new InvalidServicePriceSpecificationError(
        "charged price must be greater than or equal to service minimum price.",
      );
    }

    if (this.type === "RANGE") {
      const maxPriceInCents = this.props.maxPriceInCents;

      if (
        maxPriceInCents === undefined ||
        priceInCents < this.defaultChargePriceInCents ||
        priceInCents > maxPriceInCents
      ) {
        throw new InvalidServicePriceSpecificationError(
          "charged price must be within service price range.",
        );
      }
    }
  }

  toValue(): ServicePriceSpecificationValue {
    if (this.type === "FIXED") {
      return {
        type: "FIXED",
        fixedPriceInCents: this.defaultChargePriceInCents,
      };
    }

    if (this.type === "STARTING_AT") {
      return {
        type: "STARTING_AT",
        minPriceInCents: this.defaultChargePriceInCents,
      };
    }

    const maxPriceInCents = this.props.maxPriceInCents;

    if (maxPriceInCents === undefined) {
      throw new InvalidServicePriceSpecificationError(
        "maxPriceInCents must be a non-negative integer.",
      );
    }

    return {
      type: "RANGE",
      minPriceInCents: this.defaultChargePriceInCents,
      maxPriceInCents,
    };
  }

  static create(value: ServicePriceSpecificationValue) {
    if (value.type === "FIXED") {
      ServicePriceSpecification.assertNonNegativeInteger(
        value.fixedPriceInCents,
        "fixedPriceInCents",
      );

      return new ServicePriceSpecification({
        type: "FIXED",
        defaultPriceInCents: value.fixedPriceInCents,
      });
    }

    if (value.type === "STARTING_AT") {
      ServicePriceSpecification.assertNonNegativeInteger(
        value.minPriceInCents,
        "minPriceInCents",
      );

      return new ServicePriceSpecification({
        type: "STARTING_AT",
        defaultPriceInCents: value.minPriceInCents,
      });
    }

    if (value.type === "RANGE") {
      ServicePriceSpecification.assertNonNegativeInteger(
        value.minPriceInCents,
        "minPriceInCents",
      );
      ServicePriceSpecification.assertNonNegativeInteger(
        value.maxPriceInCents,
        "maxPriceInCents",
      );

      if (value.maxPriceInCents < value.minPriceInCents) {
        throw new InvalidServicePriceSpecificationError(
          "maxPriceInCents must be greater than or equal to minPriceInCents.",
        );
      }

      return new ServicePriceSpecification({
        type: "RANGE",
        defaultPriceInCents: value.minPriceInCents,
        maxPriceInCents: value.maxPriceInCents,
      });
    }

    throw new InvalidServicePriceSpecificationError(
      "Invalid service price specification type.",
    );
  }

  private static assertNonNegativeInteger(
    value: unknown,
    fieldName: string,
  ): asserts value is number {
    if (!Number.isInteger(value) || (value as number) < 0) {
      throw new InvalidServicePriceSpecificationError(
        `${fieldName} must be a non-negative integer.`,
      );
    }
  }
}
