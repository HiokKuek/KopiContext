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
- [Postgres persistence baseline](docs/runtime/persistence.md)
- [Private application API baseline](docs/runtime/private-api.md)

The first vertical slice is the civic Briefing, **How Singapore's Government Works**. It proves source submission, agent preparation, Editorial Approval, public reading, search, and anonymous analytics before the product expands its Topic catalogue.

## Current application

The application is a Next.js App Router project. Its first public route is:

- `/topics/how-singapores-government-works` — a responsive civic Briefing rendered from the framework-independent published-content interface.

The reader page separates evergreen Briefing material from Current Updates, shows Sources and review date, supports keyboard navigation, and follows the project voice: friendly, plain, and concise.

## Architecture

KopiContext is a TypeScript modular monolith. The public web layer runs on Vercel; the private runtime owns the application API, Postgres, workers, and queues. The application API is the primary integration and test seam. Its Fastify baseline exposes an authenticated `GET /v1/healthz`; see [the private API runbook](docs/runtime/private-api.md), [architecture roadmap](docs/architecture/implementation-roadmap.md), and [ADRs](docs/adr/).

Current code is deliberately small:

- `src/modules/content/` owns the typed published Briefing fixture and public retrieval interface.
- `src/app/` owns Next.js routes and presentation only; it consumes the content interface rather than embedding Briefing data.

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

## How work moves through the project

1. Start with a PRD and linked GitHub issue.
2. Read `CONTEXT.md`, relevant ADRs, and the owning team charter.
3. Write a failing behaviour test, then implement the smallest vertical slice.
4. Run the required checks and document user-visible changes.
5. The engineering lead may merge reviewed work to `main`; the project owner controls deployment and the editor controls publication.

For Next.js-specific work, agents consult `node_modules/next/dist/docs/` first.
