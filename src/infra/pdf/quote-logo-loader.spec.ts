import { afterEach, describe, expect, it, vi } from "vitest";

import { loadQuoteLogo } from "./quote-logo-loader";

describe("loadQuoteLogo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should load a supported logo", async () => {
    const logo = Buffer.from("valid-image-bytes");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(logo, {
        headers: {
          "content-length": String(logo.length),
          "content-type": "image/png",
        },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      loadQuoteLogo("https://cdn.example.com/logo.png"),
    ).resolves.toEqual(logo);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    ["a missing URL", null],
    ["an unsupported protocol", "file:///tmp/logo.png"],
  ])("should return null for %s", async (_, imageUrl) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadQuoteLogo(imageUrl)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should return null for unsupported or oversized responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("not-an-image", {
          headers: {
            "content-length": String(6 * 1024 * 1024),
            "content-type": "image/svg+xml",
          },
          status: 200,
        }),
      ),
    );

    await expect(
      loadQuoteLogo("https://cdn.example.com/logo.svg"),
    ).resolves.toBeNull();
  });

  it("should preserve PDF generation when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));

    await expect(
      loadQuoteLogo("https://cdn.example.com/logo.png"),
    ).resolves.toBeNull();
  });
});
