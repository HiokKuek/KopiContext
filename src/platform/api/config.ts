import type { PostgresConnectionConfig } from "@/platform/persistence/config";

/** Settings owned exclusively by the private Node runtime. */
export type PrivateApiConfig = Readonly<{
  host: string;
  port: number;
  serviceCredential: string;
}>;

type PrivateApiRuntimeConfigBase = PrivateApiConfig;

/**
 * The private runtime has two deliberately different compositions. Production
 * is database-backed; local development is an explicitly selected fixture
 * mode that cannot accidentally connect to a real database.
 */
export type PrivateApiRuntimeConfig =
  | (PrivateApiRuntimeConfigBase &
      Readonly<{
        mode: "production";
        database: PostgresConnectionConfig;
      }>)
  | (PrivateApiRuntimeConfigBase &
      Readonly<{
        mode: "local-development";
      }>);

export function privateApiConfigFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): PrivateApiConfig {
  const rawPort = environment.PRIVATE_API_PORT?.trim() ?? "3001";
  const port = Number(rawPort);
  const serviceCredential = environment.PRIVATE_API_SERVICE_CREDENTIAL?.trim();

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PRIVATE_API_PORT must be an integer between 1 and 65535.");
  }

  if (!serviceCredential) {
    throw new Error("PRIVATE_API_SERVICE_CREDENTIAL must be set before starting the private API.");
  }

  return {
    host: environment.PRIVATE_API_HOST?.trim() || "127.0.0.1",
    port,
    serviceCredential,
  };
}

/**
 * Reads the complete composition contract for `pnpm api:start`.
 *
 * Production is intentionally the default so a deployed process cannot start
 * on reader fixtures because an operator forgot an environment switch. Local
 * work must opt in and is prevented from receiving `DATABASE_URL`.
 */
export function privateApiRuntimeConfigFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): PrivateApiRuntimeConfig {
  const privateApi = privateApiConfigFromEnvironment(environment);
  const mode = environment.PRIVATE_API_RUNTIME_MODE?.trim() || "production";
  const databaseUrl = environment.DATABASE_URL?.trim();

  if (mode === "production") {
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL must be set before starting the private API in production mode.",
      );
    }

    return {
      ...privateApi,
      mode,
      database: { connectionString: databaseUrl },
    };
  }

  if (mode === "local-development") {
    if (databaseUrl) {
      throw new Error(
        "DATABASE_URL must not be set in local-development mode; use the explicit production composition instead.",
      );
    }

    return { ...privateApi, mode };
  }

  throw new Error(
    "PRIVATE_API_RUNTIME_MODE must be either production or local-development.",
  );
}
