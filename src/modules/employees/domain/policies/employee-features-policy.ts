export const DEFAULT_EMPLOYEE_FEATURES = [
  "read:appointments",
  "read:services",
  "read:customers",
  "read:employees:self",
  "create:sessions:self",
  "read:sessions:self",
] as const;

export const SYSTEM_MANAGED_EMPLOYEE_FEATURES = [
  "create:sessions:self",
  "read:sessions:self",
] as const;

export const ALLOWED_EXTRA_EMPLOYEE_FEATURES = [
  "create:appointments",
  "create:services",
  "create:customers",
  "update:appointments",
  "update:services",
  "update:customers",
  "delete:appointments",
  "delete:services",
  "delete:customers",
  "update:employees:self",
] as const;

export const ALLOWED_EMPLOYEE_FEATURES = [
  ...DEFAULT_EMPLOYEE_FEATURES,
  ...ALLOWED_EXTRA_EMPLOYEE_FEATURES,
] as const;

export type DefaultEmployeeFeature = (typeof DEFAULT_EMPLOYEE_FEATURES)[number];
export type SystemManagedEmployeeFeature =
  (typeof SYSTEM_MANAGED_EMPLOYEE_FEATURES)[number];
export type ExtraEmployeeFeature =
  (typeof ALLOWED_EXTRA_EMPLOYEE_FEATURES)[number];
export type EmployeeFeature = (typeof ALLOWED_EMPLOYEE_FEATURES)[number];

export class InvalidEmployeeFeatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidEmployeeFeatureError";
  }
}

export class EmployeeFeaturesPolicy {
  static build(extraFeatures: string[] = []): EmployeeFeature[] {
    const defaultFeatures = new Set<string>(DEFAULT_EMPLOYEE_FEATURES);
    const allowedExtraFeatures = new Set<string>(
      ALLOWED_EXTRA_EMPLOYEE_FEATURES,
    );

    for (const feature of extraFeatures) {
      if (defaultFeatures.has(feature)) {
        throw new InvalidEmployeeFeatureError(
          `${feature} is a default employee feature and cannot be sent as extra.`,
        );
      }

      if (!allowedExtraFeatures.has(feature)) {
        throw new InvalidEmployeeFeatureError(
          `Invalid employee feature: ${feature}`,
        );
      }
    }

    const requestedFeatures = new Set(extraFeatures);

    return [
      ...DEFAULT_EMPLOYEE_FEATURES,
      ...ALLOWED_EXTRA_EMPLOYEE_FEATURES.filter((feature) =>
        requestedFeatures.has(feature),
      ),
    ];
  }

  static normalizePersisted(features: string[]): EmployeeFeature[] {
    for (const feature of features) {
      if (!EmployeeFeaturesPolicy.isEmployeeFeature(feature)) {
        throw new InvalidEmployeeFeatureError(
          `Invalid persisted employee feature: ${feature}`,
        );
      }
    }

    const requestedFeatures = new Set(features);

    return ALLOWED_EMPLOYEE_FEATURES.filter((feature) =>
      requestedFeatures.has(feature),
    );
  }

  static withoutSystemManagedFeatures(
    features: EmployeeFeature[],
  ): EmployeeFeature[] {
    const systemManagedFeatures = new Set<string>(
      SYSTEM_MANAGED_EMPLOYEE_FEATURES,
    );

    return features.filter((feature) => !systemManagedFeatures.has(feature));
  }

  static hasAll(
    features: readonly EmployeeFeature[],
    requiredFeatures: readonly EmployeeFeature[],
  ) {
    return requiredFeatures.every((feature) => features.includes(feature));
  }

  static isEmployeeFeature(feature: string): feature is EmployeeFeature {
    return (ALLOWED_EMPLOYEE_FEATURES as readonly string[]).includes(feature);
  }
}
