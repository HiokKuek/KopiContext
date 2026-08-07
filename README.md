# KopiContext

KopiContext gives English-speaking Singaporeans concise, source-backed context
so they can join a conversation thoughtfully. It turns a complicated subject
into a friendly Briefing: enough of the map to understand what matters, where
the information came from, and what questions are worth asking next.

It is not a news feed or an encyclopedia. It is a calm, readable starting
point for understanding Singapore.

The first Briefing is **[How Singapore's Government Works](/topics/how-singapores-government-works)**.

## How it works

```text
Reader finds a Topic
  → reads a published, source-backed Briefing
  → can search or request a missing Topic

Editor signs in
  → submits a source, URL, document, or transcript
  → reviews agent-prepared suggestions and evidence
  → explicitly approves and publishes a Briefing
```

Agents can organise material, suggest a Topic or Subtopic, extract candidate
Claims, and draft a Briefing. They cannot accept Sources, change the canonical
taxonomy, or publish. A human editor is always the approval gate.

### What readers get

- Mobile-friendly, plain-English Briefings with a useful mental model before
  the detail.
- Clear Sources and a review date, so readers can judge where an explanation
  came from.
- Anonymous search, Topic requests, and minimal first-party analytics. The
  product does not require reader accounts or retain raw IP addresses.

### What the editor gets

- A Google-authenticated, single-editor workspace.
- A review queue and detailed Briefing view with completeness, Claims,
  accepted Sources, provenance, freshness, and audit history.
- Deliberate workflow actions: Draft → Needs verification → In editorial
  review → Approved → Published → Archived.
- A protected Source Submission form. New material is queued durably; workers
  may prepare proposals, but no worker can publish automatically. The editor
  can inspect provenance and proposed placement, Claims, and draft as clearly
  unaccepted suggestions.

## Architecture at a glance

KopiContext is a TypeScript modular monolith with a deliberate public/private
boundary:

```text
Reader or editor browser
  → Vercel Next.js web app
  → server-side authenticated request
  → private Fastify application API
  → private Postgres + workers
```

The browser never receives database access or the private service credential.
In production, reader pages retrieve published content server-side through the
private API. The private runtime owns editorial workflow, source intake,
worker jobs, and Postgres persistence.

The deployment package is designed for Vercel plus a private server: the
private API and Postgres are not published through a public container port.

## Current scope

The project already includes:

- The public civic Briefing, search, no-result Topic requests, and privacy-safe
  analytics instrumentation.
- A durable editorial workflow, audit trail, private editorial queries, and
  protected review screens.
- Source Submission intake, durable preparation outcomes, and a retrying
  private worker runtime that remains disabled until a reviewed provider
  adapter is configured.
- Production/private-runtime composition, checked-in Postgres migrations, and
  a private-server container package.

The next operational step is configuring the private Postgres instance, Google
OAuth credentials, and an approved retrieval/AI provider for workers. Until an
AI provider is configured, workers remain provider-neutral and cannot invent a
production proposal source.

## Run locally

Requires Node 22+ and pnpm 10.

```sh
pnpm install
PUBLIC_CATALOGUE_RUNTIME_MODE=local-development pnpm dev
```

Open `http://localhost:3000/topics/how-singapores-government-works`.

Local-development mode intentionally uses the checked-in civic fixture. In
production, the web app requires `PUBLIC_CATALOGUE_SLUGS`,
`PRIVATE_API_BASE_URL`, and `PRIVATE_API_SERVICE_CREDENTIAL`; these are
server-only values and must never use a `NEXT_PUBLIC_` prefix. See
[`.env.example`](.env.example) for the full environment contract.

## Verify changes

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm db:check
pnpm build
```

An opt-in real-Postgres repository check is also available after provisioning
a dedicated test database. It uses `TEST_DATABASE_URL` only and never falls
back to `DATABASE_URL`; see the [persistence runbook](docs/runtime/persistence.md#opt-in-postgres-integration-verification).

## Where to learn more

| Need | Start here |
| --- | --- |
| Product purpose, scope, and success criteria | [Product foundation PRD](docs/prd/0001-product-foundation.md) |
| The 25-Topic controlled-launch completion gate and editorial source plan | [Launch catalogue](docs/product/launch-catalogue.md) and [launch content inventory](docs/product/launch-content-inventory.md) |
| All approved product decisions | [PRD index](docs/prd/README.md) and [ADRs](docs/adr/) |
| Voice, reader experience, and editor design | [Briefing experience](docs/design/briefing-experience.md) and [editor workspace v1](docs/design/editor-workspace-v1.md) |
| Editorial states and approval rules | [Editorial workflow PRD](docs/prd/0003-editorial-workflow.md) |
| How source material becomes a reviewable proposal | [Source-processing PRD](docs/prd/0004-source-submission-and-agent-processing.md) |
| Private API, persistence, authentication, and deployment | [Runtime documentation](docs/runtime/) |
| Domain language | [CONTEXT.md](CONTEXT.md) |
| Agent workflow, team ownership, and project conventions | [AGENTS.md](AGENTS.md), [team charters](docs/teams/), and [development workflow](docs/agents/development-workflow.md) |

## How work moves through the project

1. Start with the relevant PRD, issue, domain language, and team charter.
2. Add a behaviour test before changing product behaviour.
3. Keep framework, HTTP, persistence, and domain responsibilities separate.
4. Run the verification commands above and update the relevant documentation.
5. The engineering lead may merge reviewed code; the project owner controls
   deployment and the editor controls publication.

For Next.js work, agents must consult `node_modules/next/dist/docs/` first.
