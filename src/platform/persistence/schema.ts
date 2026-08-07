/**
 * Drizzle schema entry point.
 *
 * The baseline intentionally owns no domain tables. A module adds its table
 * definitions here only when its accepted persistence adapter is introduced,
 * then generates a reviewed SQL migration with `pnpm db:generate`.
 */
export {};
