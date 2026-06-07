import { describe, expect, it } from "vitest";

import { buildPublicObjectUrl } from "./build-public-object-url";
import { extractObjectKeyFromPublicUrl } from "./extract-object-key-from-public-url";

describe("extractObjectKeyFromPublicUrl", () => {
  it("should extract object key from a URL built with buildPublicObjectUrl", () => {
    const base = "https://cdn.example.com";
    const key = "user-profile/uuid/photo.png";
    const url = buildPublicObjectUrl(base, key);

    expect(extractObjectKeyFromPublicUrl(base, url)).toBe(key);
  });

  it("should handle trailing slash on public base URL", () => {
    const base = "https://cdn.example.com/";
    const key = "user-profile/uuid/photo.png";
    const url = buildPublicObjectUrl(base, key);

    expect(extractObjectKeyFromPublicUrl(base, url)).toBe(key);
  });

  it("should return null when URL belongs to a different base", () => {
    expect(
      extractObjectKeyFromPublicUrl(
        "https://cdn.example.com",
        "https://other.example.com/user-profile/uuid/photo.png",
      ),
    ).toBeNull();
  });

  it("should return null for empty key segment", () => {
    expect(
      extractObjectKeyFromPublicUrl(
        "https://cdn.example.com",
        "https://cdn.example.com/",
      ),
    ).toBeNull();
  });
});
