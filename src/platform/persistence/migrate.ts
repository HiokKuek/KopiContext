import { migrate } from "drizzle-orm/node-postgres/migrator";

import { postgresConnectionConfigFromEnvironment } from "./config";
import { createPostgresPersistence } from "./postgres";

const persistence = createPostgresPersistence(postgresConnectionConfigFromEnvironment());

try {
  await migrate(persistence.db, { migrationsFolder: "drizzle" });
} finally {
  await persistence.close();
}
