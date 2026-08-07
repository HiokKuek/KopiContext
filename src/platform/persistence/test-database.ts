import type { PostgresConnectionConfig } from "./config";

/**
 * Returns the intentionally separate connection used by opt-in Postgres tests.
 * This boundary must never read DATABASE_URL as a fallback: test commands are
 * allowed to apply migrations and therefore need an unmistakable target.
 */
export function testPostgresConnectionConfigFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): PostgresConnectionConfig {
  const connectionString = environment.TEST_DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL must be set for Postgres integration tests; DATABASE_URL is never used.",
    );
  }

  const testDatabase = parsePostgresUrl(connectionString, "TEST_DATABASE_URL");
  assertDedicatedTestDatabase(testDatabase, "TEST_DATABASE_URL");

  const applicationConnectionString = environment.DATABASE_URL?.trim();
  if (applicationConnectionString) {
    const applicationDatabase = parsePostgresUrl(applicationConnectionString, "DATABASE_URL");
    if (databaseIdentity(applicationDatabase) === databaseIdentity(testDatabase)) {
      throw new Error(
        "TEST_DATABASE_URL must not connect to the same database as DATABASE_URL.",
      );
    }
  }

  return { connectionString, maxConnections: 1 };
}

function parsePostgresUrl(value: string, variableName: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid postgres connection URL.`);
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`${variableName} must use the postgres or postgresql protocol.`);
  }
  if (!url.hostname || !url.pathname || url.pathname === "/") {
    throw new Error(`${variableName} must name a database.`);
  }
  return url;
}

function assertDedicatedTestDatabase(url: URL, variableName: string): void {
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (!/(?:^|[_-])tests?$/i.test(databaseName)) {
    throw new Error(
      `${variableName} must name a dedicated test database ending in _test, -test, _tests, or -tests.`,
    );
  }
}

function databaseIdentity(url: URL): string {
  return `${url.protocol}//${url.hostname.toLowerCase()}:${url.port || "5432"}${url.pathname}`;
}
