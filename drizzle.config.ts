import { defineConfig } from "drizzle-kit";

/**
 * This config generates checked-in SQL from persistence schema definitions.
 * `db:generate` does not connect to the URL; `db:migrate` obtains its required
 * connection string from DATABASE_URL at runtime.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/platform/persistence/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://unused:unused@localhost:5432/unused",
  },
});
