/**
 * Connection settings owned by the private runtime. Web routes and domain
 * modules receive application use cases instead of reading this configuration.
 */
export type PostgresConnectionConfig = Readonly<{
  connectionString: string;
  maxConnections?: number;
}>;

export function postgresConnectionConfigFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): PostgresConnectionConfig {
  const connectionString = environment.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error("DATABASE_URL must be set before starting the private runtime.");
  }

  return { connectionString };
}
