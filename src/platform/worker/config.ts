import { postgresConnectionConfigFromEnvironment, type PostgresConnectionConfig } from "@/platform/persistence/config";

/** Configuration owned only by the private source-preparation process. */
export type SourcePreparationWorkerRuntimeConfig = Readonly<{
  database: PostgresConnectionConfig;
  workerId: string;
  /** A reviewed, image-packaged module; never a network URL. */
  adapterModule: string;
  pollIntervalMs: number;
  leaseMs: number;
  maxAttempts: number;
}>;

const defaults = {
  pollIntervalMs: 1_000,
  leaseMs: 60_000,
  maxAttempts: 3,
} as const;

/**
 * Worker startup is deliberately fail-closed. In particular, it does not
 * select a placeholder model, a fixture, or a remote provider by default.
 */
export function sourcePreparationWorkerConfigFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): SourcePreparationWorkerRuntimeConfig {
  const workerId = environment.SOURCE_PREPARATION_WORKER_ID?.trim();
  const adapterModule = environment.SOURCE_PREPARATION_ADAPTER_MODULE?.trim();
  if (!workerId) {
    throw new Error("SOURCE_PREPARATION_WORKER_ID must be set before starting the private worker.");
  }
  if (!adapterModule) {
    throw new Error("SOURCE_PREPARATION_ADAPTER_MODULE must name a reviewed provider adapter before starting the private worker.");
  }
  if (!adapterModule.startsWith("file:")) {
    throw new Error("SOURCE_PREPARATION_ADAPTER_MODULE must be a file URL for a reviewed, image-packaged adapter.");
  }

  return {
    database: postgresConnectionConfigFromEnvironment(environment),
    workerId,
    adapterModule,
    pollIntervalMs: boundedInteger(environment.SOURCE_PREPARATION_WORKER_POLL_INTERVAL_MS, "SOURCE_PREPARATION_WORKER_POLL_INTERVAL_MS", defaults.pollIntervalMs, 10, 60_000),
    leaseMs: boundedInteger(environment.SOURCE_PREPARATION_WORKER_LEASE_MS, "SOURCE_PREPARATION_WORKER_LEASE_MS", defaults.leaseMs, 1_000, 30 * 60_000),
    maxAttempts: boundedInteger(environment.SOURCE_PREPARATION_WORKER_MAX_ATTEMPTS, "SOURCE_PREPARATION_WORKER_MAX_ATTEMPTS", defaults.maxAttempts, 1, 10),
  };
}

function boundedInteger(
  raw: string | undefined,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}
