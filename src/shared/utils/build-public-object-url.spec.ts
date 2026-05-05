import { describe, expect, it } from "vitest";

import { buildPublicObjectUrl } from "./build-public-object-url";

describe("buildPublicObjectUrl", () => {
  it("should join base URL and object key", () => {
    expect(buildPublicObjectUrl("https://cdn.example.com/", "a/b/c.jpg")).toBe(
      "https://cdn.example.com/a/b/c.jpg",
    );
    expect(buildPublicObjectUrl("https://cdn.example.com", "/a/b.jpg")).toBe(
      "https://cdn.example.com/a/b.jpg",
    );
  });
});
