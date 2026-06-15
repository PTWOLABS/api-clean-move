import { describe, expect, it } from "vitest";

import { hasAnyProvidedValue } from "./has-any-provided-value";

describe("hasAnyProvidedValue", () => {
  it("should return false for missing or empty object data", () => {
    expect(hasAnyProvidedValue(undefined)).toBe(false);
    expect(hasAnyProvidedValue(null)).toBe(false);
    expect(hasAnyProvidedValue({})).toBe(false);
    expect(hasAnyProvidedValue({ name: undefined })).toBe(false);
    expect(hasAnyProvidedValue({ nested: {} })).toBe(false);
    expect(hasAnyProvidedValue({ nested: { name: undefined } })).toBe(false);
  });

  it("should return true when any value is provided", () => {
    expect(hasAnyProvidedValue({ name: "Clean Move" })).toBe(true);
    expect(hasAnyProvidedValue({ name: null })).toBe(true);
    expect(hasAnyProvidedValue({ nested: { name: "Clean Move" } })).toBe(true);
    expect(hasAnyProvidedValue({ createdAt: new Date() })).toBe(true);
  });
});
