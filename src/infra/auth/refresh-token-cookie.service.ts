import { Injectable } from "@nestjs/common";
import { EnvService } from "../env/env.service";
import { HeaderValue } from "./authenticated-user";

type RequestLike = {
  headers: Record<string, HeaderValue>;
};

type ResponseCookieOptions = {
  httpOnly: boolean;
  path: string;
  maxAge: number;
  secure: boolean;
  sameSite: "lax" | "none";
  expires?: Date;
};

export type CookieResponseLike = {
  cookie(name: string, value: string, options: ResponseCookieOptions): void;
};

const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";

@Injectable()
export class RefreshTokenCookieService {
  constructor(private readonly envService: EnvService) {}

  get(request: RequestLike): string | null {
    const cookieHeader = this.getHeaderValue(request.headers.cookie);

    if (!cookieHeader) {
      return null;
    }

    const cookies = cookieHeader.split(";");

    for (const cookie of cookies) {
      const [rawName, ...rawValue] = cookie.trim().split("=");

      if (rawName === REFRESH_TOKEN_COOKIE_NAME) {
        return decodeURIComponent(rawValue.join("="));
      }
    }

    return null;
  }

  set(response: CookieResponseLike, refreshToken: string): void {
    response.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      refreshToken,
      this.buildCookieOptions(this.envService.get("REFRESH_TOKEN_TTL_IN_MS")),
    );
  }

  clear(response: CookieResponseLike): void {
    response.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      "",
      this.buildCookieOptions(0, new Date(0)),
    );
  }

  private buildCookieOptions(maxAge: number, expires?: Date) {
    const nodeEnv = this.envService.get("NODE_ENV");
    const usesCrossSiteCookiePolicy =
      nodeEnv === "production" || nodeEnv === "staging";

    return {
      httpOnly: true,
      path: "/auth",
      maxAge,
      secure: usesCrossSiteCookiePolicy,
      sameSite: usesCrossSiteCookiePolicy ? "none" : "lax",
      ...(expires ? { expires } : {}),
    } satisfies ResponseCookieOptions;
  }

  private getHeaderValue(header: HeaderValue): string | undefined {
    if (Array.isArray(header)) {
      return header[0];
    }

    return header;
  }
}
