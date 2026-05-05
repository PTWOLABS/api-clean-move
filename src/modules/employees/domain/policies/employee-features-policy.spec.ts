import {
  DEFAULT_EMPLOYEE_FEATURES,
  EmployeeFeaturesPolicy,
  InvalidEmployeeFeatureError,
} from "./employee-features-policy";

describe("EmployeeFeaturesPolicy", () => {
  it("should return only default features when no extra feature is provided", () => {
    const features = EmployeeFeaturesPolicy.build();

    expect(features).toEqual(DEFAULT_EMPLOYEE_FEATURES);
  });

  it("should add allowed extra features after defaults", () => {
    const features = EmployeeFeaturesPolicy.build([
      "update:customers",
      "create:appointments",
    ]);

    expect(features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "create:appointments",
      "update:customers",
    ]);
  });

  it("should remove duplicated extra features", () => {
    const features = EmployeeFeaturesPolicy.build([
      "create:appointments",
      "create:appointments",
      "delete:services",
    ]);

    expect(features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "create:appointments",
      "delete:services",
    ]);
  });

  it("should reject default features sent as extras", () => {
    expect(() => EmployeeFeaturesPolicy.build(["read:appointments"])).toThrow(
      InvalidEmployeeFeatureError,
    );
  });

  it("should reject unknown features", () => {
    expect(() => EmployeeFeaturesPolicy.build(["approve:payments"])).toThrow(
      InvalidEmployeeFeatureError,
    );
  });

  it("should validate persisted final employee features", () => {
    const features = EmployeeFeaturesPolicy.normalizePersisted([
      "read:appointments",
      "read:services",
      "read:customers",
      "create:services",
    ]);

    expect(features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "create:services",
    ]);
  });
});
