import { describe, expect, it } from "vitest";

import { sanitizeUploadedFileName } from "./sanitize-uploaded-file-name";

describe("sanitizeUploadedFileName", () => {
  it("should strip path segments and keep safe characters", () => {
    expect(sanitizeUploadedFileName("..\\evil\\photo.jpg")).toBe("photo.jpg");
    expect(sanitizeUploadedFileName("avatar-final.png")).toBe(
      "avatar-final.png",
    );
  });
});
