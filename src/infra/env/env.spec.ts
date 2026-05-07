import { describe, expect, it } from "vitest";

import { envSchema } from "./env";

function baseEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    PORT: "3000",
    FRONTEND_URL: "http://localhost:5000",
    POSTGRES_HOST: "localhost",
    POSTGRES_PORT: "5432",
    POSTGRES_DB: "clean_move",
    POSTGRES_USER: "postgres",
    POSTGRES_PASSWORD: "postgres",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/clean_move",
    NODE_ENV: "development",
    GOOGLE_CLIENT_ID: "google-client-id",
    JWT_ACCESS_SECRET: "test-access-secret-with-at-least-32-chars",
    JWT_REFRESH_SECRET: "test-refresh-secret-with-at-least-32-char",
    JWT_ACCESS_EXPIRES_IN: "15m",
    REFRESH_TOKEN_TTL_IN_MS: "1296000000",
    AWS_REGION: "us-east-1",
    AWS_S3_BUCKET: "my-bucket",
    AWS_S3_PUBLIC_BASE_URL: "https://cdn.example.com",
    ...overrides,
  };
}

describe("envSchema", () => {
  it("should parse a valid development configuration without static AWS credentials", () => {
    const result = envSchema.safeParse(baseEnv());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.AWS_REGION).toBe("us-east-1");
      expect(result.data.AWS_S3_BUCKET).toBe("my-bucket");
      expect(result.data.AWS_S3_PUBLIC_BASE_URL).toBe(
        "https://cdn.example.com",
      );
      expect(result.data.AWS_ACCESS_KEY_ID).toBeUndefined();
      expect(result.data.AWS_SECRET_ACCESS_KEY).toBeUndefined();
      expect(result.data.AWS_S3_ENDPOINT).toBeUndefined();
    }
  });

  it("should parse when both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set", () => {
    const result = envSchema.safeParse(
      baseEnv({
        AWS_ACCESS_KEY_ID: "AKIAEXAMPLE",
        AWS_SECRET_ACCESS_KEY: "secret-key-value-min-length",
      }),
    );

    expect(result.success).toBe(true);
  });

  it("should reject when only AWS_ACCESS_KEY_ID is set", () => {
    const result = envSchema.safeParse(
      baseEnv({
        AWS_ACCESS_KEY_ID: "AKIAEXAMPLE",
        AWS_SECRET_ACCESS_KEY: undefined,
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("AWS_SECRET_ACCESS_KEY");
    }
  });

  it("should reject when only AWS_SECRET_ACCESS_KEY is set", () => {
    const result = envSchema.safeParse(
      baseEnv({
        AWS_ACCESS_KEY_ID: undefined,
        AWS_SECRET_ACCESS_KEY: "only-secret",
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("AWS_ACCESS_KEY_ID");
    }
  });

  it("should treat blank AWS credential env vars as unset and parse", () => {
    const result = envSchema.safeParse(
      baseEnv({
        AWS_ACCESS_KEY_ID: "   ",
        AWS_SECRET_ACCESS_KEY: "",
      }),
    );

    expect(result.success).toBe(true);
  });

  it("should reject invalid AWS_S3_PUBLIC_BASE_URL", () => {
    const result = envSchema.safeParse(
      baseEnv({ AWS_S3_PUBLIC_BASE_URL: "not-a-url" }),
    );

    expect(result.success).toBe(false);
  });

  it("should reject empty AWS_S3_BUCKET", () => {
    const result = envSchema.safeParse(baseEnv({ AWS_S3_BUCKET: "   " }));

    expect(result.success).toBe(false);
  });

  it("should require https FRONTEND_URL and AWS_S3_PUBLIC_BASE_URL in production", () => {
    const httpPublic = envSchema.safeParse(
      baseEnv({
        NODE_ENV: "production",
        FRONTEND_URL: "https://app.example.com",
        AWS_S3_PUBLIC_BASE_URL: "http://cdn.example.com",
      }),
    );

    expect(httpPublic.success).toBe(false);
    if (!httpPublic.success) {
      const paths = httpPublic.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("AWS_S3_PUBLIC_BASE_URL");
    }

    const httpFrontend = envSchema.safeParse(
      baseEnv({
        NODE_ENV: "production",
        FRONTEND_URL: "http://app.example.com",
        AWS_S3_PUBLIC_BASE_URL: "https://cdn.example.com",
      }),
    );

    expect(httpFrontend.success).toBe(false);

    const validProd = envSchema.safeParse(
      baseEnv({
        NODE_ENV: "production",
        FRONTEND_URL: "https://app.example.com",
        AWS_S3_PUBLIC_BASE_URL: "https://cdn.example.com",
      }),
    );

    expect(validProd.success).toBe(true);
  });

  it("should allow http AWS_S3_PUBLIC_BASE_URL when NODE_ENV is not production", () => {
    const result = envSchema.safeParse(
      baseEnv({ AWS_S3_PUBLIC_BASE_URL: "http://localhost:9000" }),
    );

    expect(result.success).toBe(true);
  });

  it("should parse optional AWS_S3_ENDPOINT for local object storage", () => {
    const result = envSchema.safeParse(
      baseEnv({ AWS_S3_ENDPOINT: "http://127.0.0.1:4566" }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.AWS_S3_ENDPOINT).toBe("http://127.0.0.1:4566");
    }
  });

  it("should omit AWS_S3_ENDPOINT when set to blank string", () => {
    const result = envSchema.safeParse(baseEnv({ AWS_S3_ENDPOINT: "  " }));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.AWS_S3_ENDPOINT).toBeUndefined();
    }
  });
});
