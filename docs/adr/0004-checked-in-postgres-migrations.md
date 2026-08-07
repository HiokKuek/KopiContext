# Use checked-in SQL migrations with Drizzle and Postgres

KopiContext will use Drizzle ORM with the `pg` driver and checked-in SQL migrations for its primary Postgres database. Persistence remains an adapter behind application use cases; the Next.js web layer never accesses tables or database credentials directly.

## Considered Options

- Generated-client ORM with migrations
- Hand-written database access without migration tooling
- Thin typed SQL and checked-in migrations with Drizzle and `pg`

## Consequences

The private runtime runs migrations explicitly as a deployment step, with a DDL migrator role separate from API and worker DML roles. Integration tests run migrations against an isolated Postgres database; unit tests continue to use in-memory fakes. This keeps SQL evolution reviewable without coupling domain modules to database tables.
