import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { PostgresConnectionConfig } from "./config";

/**
 * The private-runtime composition root for Postgres. It deliberately exposes
 * no domain repositories: each owning module will provide its own adapter.
 */
export type PostgresPersistence = Readonly<{
  db: NodePgDatabase;
  close(): Promise<void>;
}>;

export function createPostgresPersistence(
  config: PostgresConnectionConfig,
): PostgresPersistence {
  const pool = new Pool({
    connectionString: config.connectionString,
    max: config.maxConnections,
  });

  return {
    db: drizzle({ client: pool }),
    close: () => pool.end(),
  };
}
