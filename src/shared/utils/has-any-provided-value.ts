export function hasAnyProvidedValue(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).some((item): boolean => {
    if (item === undefined) {
      return false;
    }

    if (
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      !(item instanceof Date)
    ) {
      return hasAnyProvidedValue(item);
    }

    return true;
  });
}
