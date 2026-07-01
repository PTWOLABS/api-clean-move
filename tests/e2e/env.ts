import { existsSync } from "node:fs";

const DEFAULT_ENV_FILE = ".env";
const TEST_DATABASE_SUFFIX = "_test";

type E2EEnvironment = {
  databaseUrl: string;
};

let cachedEnvironment: E2EEnvironment | null = null;

function buildTestDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const databaseName = url.pathname.slice(1);

  if (!databaseName) {
    throw new Error("DATABASE_URL must include a database name.");
  }

  if (!databaseName.endsWith(TEST_DATABASE_SUFFIX)) {
    url.pathname = `/${databaseName}${TEST_DATABASE_SUFFIX}`;
  }

  return url.toString();
}

export function configureE2EEnv(): E2EEnvironment {
  if (cachedEnvironment) {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = cachedEnvironment.databaseUrl;

    return cachedEnvironment;
  }

  if (existsSync(DEFAULT_ENV_FILE)) {
    process.loadEnvFile(DEFAULT_ENV_FILE);
  }

  const baseDatabaseUrl = process.env.DATABASE_URL;

  if (!baseDatabaseUrl) {
    throw new Error("Missing DATABASE_URL for e2e tests.");
  }

  const databaseUrl =
    process.env.DATABASE_URL_TEST ?? buildTestDatabaseUrl(baseDatabaseUrl);

  process.env.AWS_REGION ??= "us-east-1";
  process.env.AWS_S3_BUCKET ??= "clean-move-test-bucket";
  process.env.AWS_S3_PUBLIC_BASE_URL ??= "http://localhost:4566/clean-move";
  process.env.CORS_ALLOWED_ORIGINS ??= "http://localhost:3000";
  process.env.FRONTEND_URL ??= "http://localhost:3000";
  process.env.EMAIL_LOGO_URL ??= "http://localhost:3000/logo.png";
  process.env.PASSWORD_RESET_PATH ??= "http://localhost:3000/reset-password";
  process.env.JWT_ACCESS_SECRET ??=
    "test-access-secret-with-at-least-32-characters";
  process.env.JWT_REFRESH_SECRET ??=
    "test-refresh-secret-with-at-least-32-characters";
  process.env.JWT_ACCESS_EXPIRES_IN ??= "15m";
  process.env.REFRESH_TOKEN_TTL_IN_MS ??= "1296000000";
  process.env.GOOGLE_CLIENT_ID ??= "google-client-id-test";

  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = databaseUrl;

  cachedEnvironment = {
    databaseUrl,
  };

  return cachedEnvironment;
}
