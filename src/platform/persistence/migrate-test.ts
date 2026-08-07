import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createPostgresPersistence } from "./postgres";
import { testPostgresConnectionConfigFromEnvironment } from "./test-database";

const persistence = createPostgresPersistence(testPostgresConnectionConfigFromEnvironment());

try {
  await migrate(persistence.db, { migrationsFolder: "drizzle" });
} finally {
  await persistence.close();
}
