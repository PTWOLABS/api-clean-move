import {
  DEFAULT_EMPLOYEE_FEATURES,
  EmployeeFeaturesPolicy,
  InvalidEmployeeFeatureError,
  SYSTEM_MANAGED_EMPLOYEE_FEATURES,
} from "./employee-features-policy";

describe("EmployeeFeaturesPolicy", () => {
  it("should return active default features when no extra feature is provided", () => {
    const features = EmployeeFeaturesPolicy.build();

    expect(features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
    ]);
    expect(features).toEqual(DEFAULT_EMPLOYEE_FEATURES);
  });

  it("should add allowed extra features after defaults", () => {
    const features = EmployeeFeaturesPolicy.build([
      "update:customers",
      "create:appointments",
      "update:employees:self",
    ]);

    expect(features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
      "create:appointments",
      "update:customers",
      "update:employees:self",
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
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
      "create:appointments",
      "delete:services",
    ]);
  });

  it.each([
    "read:appointments",
    "read:employees:self",
    "create:sessions:self",
    "read:sessions:self",
  ])(
    "should reject default or system-managed feature %s sent as extra",
    (feature) => {
      expect(() => EmployeeFeaturesPolicy.build([feature])).toThrow(
        InvalidEmployeeFeatureError,
      );
    },
  );

  it("should reject unknown features", () => {
    expect(() => EmployeeFeaturesPolicy.build(["approve:payments"])).toThrow(
      InvalidEmployeeFeatureError,
    );
  });

  it("should validate and normalize persisted final employee features", () => {
    const features = EmployeeFeaturesPolicy.normalizePersisted([
      "create:services",
      "read:sessions:self",
      "read:customers",
      "read:appointments",
      "create:sessions:self",
      "read:services",
      "read:employees:self",
      "create:services",
    ]);

    expect(features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
      "create:services",
    ]);
  });

  it("should reject invalid persisted employee features", () => {
    expect(() =>
      EmployeeFeaturesPolicy.normalizePersisted(["approve:payments"]),
    ).toThrow(InvalidEmployeeFeatureError);
  });

  it("should remove system-managed session features", () => {
    const features = EmployeeFeaturesPolicy.withoutSystemManagedFeatures([
      "read:appointments",
      "create:sessions:self",
      "read:sessions:self",
      "update:employees:self",
    ]);

    expect(SYSTEM_MANAGED_EMPLOYEE_FEATURES).toEqual([
      "create:sessions:self",
      "read:sessions:self",
    ]);
    expect(features).toEqual(["read:appointments", "update:employees:self"]);
  });

  it("should check if all required features are present", () => {
    expect(
      EmployeeFeaturesPolicy.hasAll(
        ["read:employees:self", "update:employees:self"],
        ["read:employees:self"],
      ),
    ).toBe(true);
    expect(
      EmployeeFeaturesPolicy.hasAll(
        ["read:employees:self"],
        ["read:employees:self", "update:employees:self"],
      ),
    ).toBe(false);
  });
});
