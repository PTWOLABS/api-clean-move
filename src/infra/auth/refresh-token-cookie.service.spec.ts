import { describe, expect, it } from "vitest";

import { EnvService } from "../env/env.service";
import {
  CookieResponseLike,
  RefreshTokenCookieService,
} from "./refresh-token-cookie.service";

type NodeEnv = "development" | "test" | "production" | "staging";
type CapturedCookie = {
  name: string;
  value: string;
  options: Parameters<CookieResponseLike["cookie"]>[2];
};

function makeSut(nodeEnv: NodeEnv) {
  const envService = {
    get(key: string) {
      if (key === "NODE_ENV") {
        return nodeEnv;
      }

      if (key === "REFRESH_TOKEN_TTL_IN_MS") {
        return 1_296_000_000;
      }

      throw new Error(`Unexpected env key: ${key}`);
    },
  } as unknown as EnvService;

  const sut = new RefreshTokenCookieService(envService);
  let capturedCookie: CapturedCookie | null = null;
  const response: CookieResponseLike = {
    cookie(name, value, options) {
      capturedCookie = { name, value, options };
    },
  };

  return {
    sut,
    response,
    getCapturedCookie: () => capturedCookie,
  };
}

describe("RefreshTokenCookieService", () => {
  it.each([
    ["production", true, "none"],
    ["staging", true, "none"],
    ["development", false, "lax"],
    ["test", false, "lax"],
  ] as const)(
    "should build refresh token cookie options for %s",
    (nodeEnv, secure, sameSite) => {
      const { sut, response, getCapturedCookie } = makeSut(nodeEnv);

      sut.set(response, "refresh-token");

      const capturedCookie = getCapturedCookie();

      expect(capturedCookie).not.toBeNull();
      expect(capturedCookie?.name).toBe("refresh_token");
      expect(capturedCookie?.value).toBe("refresh-token");
      expect(capturedCookie?.options).toEqual({
        httpOnly: true,
        path: "/auth",
        maxAge: 1_296_000_000,
        secure,
        sameSite,
      });
    },
  );
});
