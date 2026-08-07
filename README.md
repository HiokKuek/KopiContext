# KopiContext

KopiContext helps English-speaking Singaporeans gain enough accurate, source-backed context to join a conversation thoughtfully. It is a conversation-briefing product: clear, friendly, source-backed context—not a news site or encyclopedia.

## Start here

- [Product foundation PRD](docs/prd/0001-product-foundation.md)
- [Domain glossary](CONTEXT.md)
- [Architecture decisions](docs/adr/)
- [Agent development workflow](docs/agents/development-workflow.md)
- [Agent instructions](AGENTS.md)
- [Team charters](docs/teams/)
- [Implementation roadmap](docs/architecture/implementation-roadmap.md)
- [Design and voice standard](docs/design/briefing-experience.md)
- [Editor workspace v1 design](docs/design/editor-workspace-v1.md)
- [Postgres persistence baseline](docs/runtime/persistence.md)
- [Private application API baseline](docs/runtime/private-api.md)
- [Browser analytics boundary](docs/runtime/analytics.md)
- [Anonymous Topic-request handoff](docs/runtime/topic-requests.md)

The first vertical slice is the civic Briefing, **How Singapore's Government Works**. It proves source submission, agent preparation, Editorial Approval, public reading, search, and anonymous analytics before the product expands its Topic catalogue.

## Current application

The application is a Next.js App Router project. Its first public route is:

- `/topics/how-singapores-government-works` — a responsive civic Briefing rendered from the framework-independent published-content interface.

The reader page separates evergreen Briefing material from Current Updates, shows Sources and review date, supports keyboard navigation, and follows the project voice: friendly, plain, and concise.

## Architecture

KopiContext is a TypeScript modular monolith. The public web layer runs on Vercel; the private runtime owns the application API, Postgres, workers, and queues. The application API is the primary integration and test seam. Its Fastify boundary has a health check plus authenticated command contracts for source submission and editorial transitions; see [the private API runbook](docs/runtime/private-api.md), [architecture roadmap](docs/architecture/implementation-roadmap.md), and [ADRs](docs/adr/).

Current code is deliberately small:

- `src/modules/content/` owns the typed published Briefing fixture and public retrieval interface.
- `src/modules/editorial/` owns state-transition rules, audit records, repositories, and the transport-neutral editorial command.
- `src/modules/preparation/` owns the idempotent, provenance-preserving source-preparation interface. It can propose placement, candidate claims, and a draft, but cannot accept evidence or publish.
- `src/app/` owns Next.js routes and presentation only; it consumes the content interface rather than embedding Briefing data.
- `src/platform/api/` owns Fastify authentication, HTTP contracts, and explicit runtime composition. Production requires Postgres and composes the real public-catalogue and Editorial Workflow repositories; local-development mode is an opt-in reader-fixture mode with no durable editor, preparation, or analytics adapter.

## Run locally

Requires Node 22 or newer and pnpm 10.

```sh
pnpm install
pnpm dev
```

Open `http://localhost:3000/topics/how-singapores-government-works`.

To run the private API locally, follow [its runbook](docs/runtime/private-api.md).

## Verify changes

```sh
pnpm test
pnpm typecheck
pnpm build
```

Tests verify behaviour through public module/application interfaces. External provider adapters will be faked in automated tests; no live AI, news, or analytics provider is used by the test suite.

An opt-in real-Postgres repository check is available only after a dedicated
test database has been provisioned. It requires `TEST_DATABASE_URL` (never
falls back to `DATABASE_URL`), applies checked-in migrations, and leaves its
test records intact. See the [Postgres persistence runbook](docs/runtime/persistence.md#opt-in-postgres-integration-verification).

## How work moves through the project

1. Start with a PRD and linked GitHub issue.
2. Read `CONTEXT.md`, relevant ADRs, and the owning team charter.
3. Write a failing behaviour test, then implement the smallest vertical slice.
4. Run the required checks and document user-visible changes.
5. The engineering lead may merge reviewed work to `main`; the project owner controls deployment and the editor controls publication.

For Next.js-specific work, agents consult `node_modules/next/dist/docs/` first.
