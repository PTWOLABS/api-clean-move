import { z } from "zod";
import type { StringValue } from "ms";

try {
  process.loadEnvFile();
} catch (error) {
  // CI and containerized environments may inject vars without a local .env file.
  const isMissingEnvFile =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT";

  if (!isMissingEnvFile) {
    throw error;
  }
}

export const nodeEnvSchema = z.enum(["development", "test", "production"]);
const nonEmptyStringSchema = z.string().trim().min(1);
const jwtExpiresInSchema = z.custom<StringValue>(
  (value) => typeof value === "string" && value.trim().length > 0,
  {
    message: "JWT_ACCESS_EXPIRES_IN must be a valid ms-style duration string.",
  },
);
const databaseUrlSchema = z
  .url()
  .refine(
    (value) =>
      value.startsWith("postgresql://") || value.startsWith("postgres://"),
    {
      message:
        "DATABASE_URL must use a PostgreSQL URL (postgresql:// or postgres://).",
    },
  );

/** Empty or whitespace-only env values are treated as unset. */
const optionalNonEmptyStringSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).optional(),
);

const s3PublicBaseUrlSchema = z.url();

export const envSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).optional().default(3000),
    FRONTEND_URL: z.url(),
    POSTGRES_HOST: nonEmptyStringSchema,
    POSTGRES_PORT: z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .optional()
      .default(5432),
    POSTGRES_DB: nonEmptyStringSchema,
    POSTGRES_USER: nonEmptyStringSchema,
    POSTGRES_PASSWORD: nonEmptyStringSchema,
    DATABASE_URL: databaseUrlSchema,
    NODE_ENV: nodeEnvSchema.default("development"),
    GOOGLE_CLIENT_ID: nonEmptyStringSchema.default("google-client-id"),
    JWT_ACCESS_SECRET: nonEmptyStringSchema.min(32),
    JWT_REFRESH_SECRET: nonEmptyStringSchema.min(32),
    JWT_ACCESS_EXPIRES_IN: jwtExpiresInSchema.default("15m"),
    REFRESH_TOKEN_TTL_IN_MS: z.coerce.number().int().positive(),
    AWS_REGION: nonEmptyStringSchema,
    AWS_S3_BUCKET: nonEmptyStringSchema,
    AWS_S3_PUBLIC_BASE_URL: s3PublicBaseUrlSchema,
    AWS_ACCESS_KEY_ID: optionalNonEmptyStringSchema,
    AWS_SECRET_ACCESS_KEY: optionalNonEmptyStringSchema,
    AWS_S3_ENDPOINT: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
      z.url().optional(),
    ),
  })
  .superRefine(
    (
      {
        NODE_ENV,
        FRONTEND_URL,
        AWS_S3_PUBLIC_BASE_URL,
        AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY,
      },
      context,
    ) => {
      if (NODE_ENV === "production") {
        if (!FRONTEND_URL.startsWith("https://")) {
          context.addIssue({
            code: "custom",
            path: ["FRONTEND_URL"],
            message: "FRONTEND_URL must use https:// when NODE_ENV=production.",
          });
        }

        if (!AWS_S3_PUBLIC_BASE_URL.startsWith("https://")) {
          context.addIssue({
            code: "custom",
            path: ["AWS_S3_PUBLIC_BASE_URL"],
            message:
              "AWS_S3_PUBLIC_BASE_URL must use https:// when NODE_ENV=production.",
          });
        }
      }

      const hasAccessKey =
        AWS_ACCESS_KEY_ID !== undefined && AWS_ACCESS_KEY_ID.length > 0;
      const hasSecretKey =
        AWS_SECRET_ACCESS_KEY !== undefined && AWS_SECRET_ACCESS_KEY.length > 0;

      if (hasAccessKey !== hasSecretKey) {
        context.addIssue({
          code: "custom",
          path: hasAccessKey
            ? ["AWS_SECRET_ACCESS_KEY"]
            : ["AWS_ACCESS_KEY_ID"],
          message:
            "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must both be set or both omitted (use IAM role / default chain when omitted).",
        });
      }
    },
  );

export type NodeEnv = z.infer<typeof nodeEnvSchema>;
export type Env = z.infer<typeof envSchema>;
