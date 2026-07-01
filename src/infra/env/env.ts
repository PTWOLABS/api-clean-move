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

export const nodeEnvSchema = z.enum([
  "development",
  "test",
  "production",
  "staging",
]);
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
    PORT: z.coerce.number().int().min(1).max(65535).optional().default(8080),
    FRONTEND_URL: z.url(),
    CORS_ALLOWED_ORIGINS: optionalNonEmptyStringSchema,
    POSTGRES_HOST: optionalNonEmptyStringSchema,
    POSTGRES_PORT: z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .optional()
      .default(5432),
    POSTGRES_DB: optionalNonEmptyStringSchema,
    POSTGRES_USER: optionalNonEmptyStringSchema,
    POSTGRES_PASSWORD: optionalNonEmptyStringSchema,
    DATABASE_URL: databaseUrlSchema,
    NODE_ENV: nodeEnvSchema.default("development"),
    GOOGLE_CLIENT_ID: nonEmptyStringSchema.default("google-client-id"),
    JWT_ACCESS_SECRET: nonEmptyStringSchema.min(32),
    JWT_REFRESH_SECRET: nonEmptyStringSchema.min(32),
    JWT_ACCESS_EXPIRES_IN: jwtExpiresInSchema.default("15m"),
    REFRESH_TOKEN_TTL_IN_MS: z.coerce.number().int().positive(),
    PASSWORD_CHANGE_CONFIRMATION_CODE_TTL_IN_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(900_000),
    PASSWORD_RESET_TOKEN_TTL_IN_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(900_000),
    PASSWORD_CONFIRMATION_CODE_MAX_FAILED_ATTEMPTS: z.coerce
      .number()
      .int()
      .positive()
      .default(5),
    AUTH_PASSWORD_FLOW_REQUEST_LIMIT: z.coerce
      .number()
      .int()
      .positive()
      .default(5),
    AUTH_PASSWORD_FLOW_REQUEST_TTL_IN_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(3_600_000),
    AUTH_PASSWORD_FLOW_CONFIRM_LIMIT: z.coerce
      .number()
      .int()
      .positive()
      .default(10),
    AUTH_PASSWORD_FLOW_CONFIRM_TTL_IN_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(900_000),
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
    RESEND_API_KEY: optionalNonEmptyStringSchema,
    RESEND_FROM_EMAIL: optionalNonEmptyStringSchema,
    EMAIL_LOGO_URL: z.url(),
    PASSWORD_RESET_PATH: z.url(),
  })
  .superRefine(
    (
      {
        NODE_ENV,
        FRONTEND_URL,
        AWS_S3_PUBLIC_BASE_URL,
        AWS_S3_ENDPOINT,
        AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY,
        RESEND_API_KEY,
        RESEND_FROM_EMAIL,
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

      const isDeployedEnv = NODE_ENV === "production" || NODE_ENV === "staging";

      if (isDeployedEnv) {
        if (AWS_S3_ENDPOINT === undefined) {
          context.addIssue({
            code: "custom",
            path: ["AWS_S3_ENDPOINT"],
            message:
              "AWS_S3_ENDPOINT is required when NODE_ENV is production or staging.",
          });
        }

        if (!hasAccessKey || !hasSecretKey) {
          context.addIssue({
            code: "custom",
            path: ["AWS_ACCESS_KEY_ID"],
            message:
              "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required when NODE_ENV is production or staging.",
          });
        }

        if (RESEND_API_KEY === undefined) {
          context.addIssue({
            code: "custom",
            path: ["RESEND_API_KEY"],
            message:
              "RESEND_API_KEY is required when NODE_ENV is production or staging.",
          });
        }

        if (RESEND_FROM_EMAIL === undefined) {
          context.addIssue({
            code: "custom",
            path: ["RESEND_FROM_EMAIL"],
            message:
              "RESEND_FROM_EMAIL is required when NODE_ENV is production or staging.",
          });
        }
      }

      if (RESEND_API_KEY !== undefined && RESEND_FROM_EMAIL === undefined) {
        context.addIssue({
          code: "custom",
          path: ["RESEND_FROM_EMAIL"],
          message: "RESEND_FROM_EMAIL is required when RESEND_API_KEY is set.",
        });
      }
    },
  )
  .transform((env) => ({
    ...env,
    CORS_ALLOWED_ORIGINS: env.CORS_ALLOWED_ORIGINS ?? env.FRONTEND_URL,
  }));

export type NodeEnv = z.infer<typeof nodeEnvSchema>;
export type Env = z.infer<typeof envSchema>;
