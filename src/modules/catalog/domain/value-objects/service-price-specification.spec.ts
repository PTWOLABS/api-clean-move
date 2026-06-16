import {
  InvalidServicePriceSpecificationError,
  ServicePriceSpecification,
} from "./service-price-specification";

describe("ServicePriceSpecification", () => {
  it("should create a fixed price specification", () => {
    const price = ServicePriceSpecification.create({
      type: "FIXED",
      fixedPriceInCents: 8000,
    });

    expect(price.type).toBe("FIXED");
    expect(price.defaultChargePriceInCents).toBe(8000);
    expect(price.toValue()).toEqual({
      type: "FIXED",
      fixedPriceInCents: 8000,
    });
  });

  it("should create a starting-at price specification", () => {
    const price = ServicePriceSpecification.create({
      type: "STARTING_AT",
      minPriceInCents: 25000,
    });

    expect(price.type).toBe("STARTING_AT");
    expect(price.defaultChargePriceInCents).toBe(25000);
    expect(price.toValue()).toEqual({
      type: "STARTING_AT",
      minPriceInCents: 25000,
    });
  });

  it("should create a range price specification", () => {
    const price = ServicePriceSpecification.create({
      type: "RANGE",
      minPriceInCents: 30000,
      maxPriceInCents: 60000,
    });

    expect(price.type).toBe("RANGE");
    expect(price.defaultChargePriceInCents).toBe(30000);
    expect(price.toValue()).toEqual({
      type: "RANGE",
      minPriceInCents: 30000,
      maxPriceInCents: 60000,
    });
  });

  it("should reject missing required fields", () => {
    expect(() => ServicePriceSpecification.create({ type: "FIXED" })).toThrow(
      InvalidServicePriceSpecificationError,
    );

    expect(() =>
      ServicePriceSpecification.create({ type: "STARTING_AT" }),
    ).toThrow(InvalidServicePriceSpecificationError);

    expect(() =>
      ServicePriceSpecification.create({
        type: "RANGE",
        minPriceInCents: 30000,
      }),
    ).toThrow(InvalidServicePriceSpecificationError);
  });

  it("should reject negative and non-integer prices", () => {
    expect(() =>
      ServicePriceSpecification.create({
        type: "FIXED",
        fixedPriceInCents: -1,
      }),
    ).toThrow("fixedPriceInCents must be a non-negative integer.");

    expect(() =>
      ServicePriceSpecification.create({
        type: "STARTING_AT",
        minPriceInCents: 12.5,
      }),
    ).toThrow("minPriceInCents must be a non-negative integer.");
  });

  it("should reject a range max below min", () => {
    expect(() =>
      ServicePriceSpecification.create({
        type: "RANGE",
        minPriceInCents: 60000,
        maxPriceInCents: 30000,
      }),
    ).toThrow(
      "maxPriceInCents must be greater than or equal to minPriceInCents.",
    );
  });

  it("should validate charged prices", () => {
    const fixed = ServicePriceSpecification.create({
      type: "FIXED",
      fixedPriceInCents: 8000,
    });
    const startingAt = ServicePriceSpecification.create({
      type: "STARTING_AT",
      minPriceInCents: 25000,
    });
    const range = ServicePriceSpecification.create({
      type: "RANGE",
      minPriceInCents: 30000,
      maxPriceInCents: 60000,
    });

    expect(() => fixed.assertCanCharge(8000)).not.toThrow();
    expect(() => fixed.assertCanCharge(9000)).toThrow(
      "charged price must equal fixed service price.",
    );

    expect(() => startingAt.assertCanCharge(25000)).not.toThrow();
    expect(() => startingAt.assertCanCharge(24999)).toThrow(
      "charged price must be greater than or equal to service minimum price.",
    );

    expect(() => range.assertCanCharge(30000)).not.toThrow();
    expect(() => range.assertCanCharge(60000)).not.toThrow();
    expect(() => range.assertCanCharge(29999)).toThrow(
      "charged price must be within service price range.",
    );
    expect(() => range.assertCanCharge(60001)).toThrow(
      "charged price must be within service price range.",
    );
  });
});
