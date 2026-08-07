# Postgres persistence baseline

KopiContext uses Postgres with Drizzle and checked-in SQL migrations. The
database belongs to the private runtime. The public Next.js application does
not receive `DATABASE_URL` and does not import persistence adapters.

## Content and editorial records

The initial content schema is deliberately normalised around the editorial
boundaries in `CONTEXT.md`:

- `topics` is the canonical discoverable vocabulary; a merged Topic must point
  to its surviving Topic.
- `briefings` owns the current Editorial Workflow state for one Topic, while
  `briefing_revisions` keeps immutable, ordered template content and records
  whether a human or agent created it.
- `source_submissions` preserves supplied material and processing provenance.
  It is never evidence by itself. `accepted_sources` records the editor's
  distinct acceptance decision and durable source metadata.
- `claims` belong to a specific Briefing revision. `claim_supports` is the only
  Claim-to-Accepted-Source relationship and records where and how a Source
  supports the Claim.
- `editorial_audit_records` is append-only transition history. The editorial
  application writes it atomically with the Briefing status it evaluates.
- `topic_request_demands` is an aggregate-only editor discovery queue. It
  stores a normalised requested Topic, count, and first/last acceptance times;
  it must never become a per-reader request log or retain network, session,
  identity, device, or free-form fields.

The schema protects vocabulary, identifiers, relationships, merge boundaries,
confidence ranges, and complete agent-generation provenance. It intentionally
does not duplicate application rules such as “only the editor may publish”:
those rules require authenticated actor policy and stay in the editorial
application seam. Never bypass that seam by writing a publication status
directly through a table adapter.

## Run a migration

Set a URL for an isolated local, staging, or production database, then run the
migrator explicitly:

```sh
DATABASE_URL='postgres://USER:PASSWORD@HOST:5432/DATABASE' pnpm db:migrate
```

The command applies the checked-in files in `drizzle/` and records them in
Drizzle's migration ledger. Use a DDL-only database role for this command; API
and worker processes must use separate DML-only roles. Never run it from the
Vercel web runtime.

## Add a module-owned schema change

1. Add only that module's table definitions to `src/platform/persistence/schema.ts`.
2. Generate reviewed SQL: `pnpm db:generate --name meaningful-change-name`.
3. Inspect the resulting files in `drizzle/`, including rollback/roll-forward
   implications, and commit them with the adapter change.
4. Validate migration history: `pnpm db:check`.
5. Apply it to an isolated test database with `pnpm db:migrate` before a
   private-runtime deployment.

Unit tests must continue to use in-memory fakes and never require
`DATABASE_URL`. Persistence integration tests will use a disposable Postgres
database after the owning module introduces a repository adapter.

## Opt-in Postgres integration verification

The normal `pnpm test` suite deliberately excludes Postgres integration tests
and does not read either database URL. To verify a Drizzle repository against a
real database, provision a separate database whose name ends in `_test`,
`-test`, `_tests`, or `-tests`, and give it a dedicated, least-privileged test
role. Do not point this at a development, staging, or production database.

```sh
TEST_DATABASE_URL='postgres://TEST_ROLE:PASSWORD@HOST:5432/kopi_context_test' pnpm test:postgres
```

The test command applies the checked-in `drizzle/` migrations through Drizzle's
migration ledger, then publishes a uniquely named, source-backed test Briefing
through the real Drizzle editorial repository and reads it through the public
catalogue repository. It never falls back to `DATABASE_URL`, rejects a target
whose database name is not clearly a test database, and rejects a
`TEST_DATABASE_URL` that identifies the same host/port/database as
`DATABASE_URL` when both are present.

The harness never creates, drops, truncates, or resets a database. Its fixture
records remain in the dedicated test database, which makes the command safe to
run against a shared test environment but means a database administrator must
provision and retire that isolated database outside this repository. To only
apply checked-in migrations after that provisioning step, run:

```sh
TEST_DATABASE_URL='postgres://TEST_ROLE:PASSWORD@HOST:5432/kopi_context_test' pnpm db:test:migrate
```
