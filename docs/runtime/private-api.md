# Private application API baseline

The private API is a Fastify process that belongs on the private server, not
on Vercel. It is the HTTP adapter for application use cases: Vercel calls it
only from server-side code through the authenticated tunnel or reverse proxy;
browsers never receive its credential or database access.

The API exposes `GET /v1/healthz`, an anonymous published-Briefing query, and
private feature command ports. It is the composition root for runtime adapters:
production uses the real Postgres catalogue and Editorial Workflow adapters;
the local reader fixture is available only through a separately selected local
development mode.

For container topology, migration startup ordering, private ingress, and the
Vercel environment handoff, see the [private-server deployment package](private-server-deployment.md).

## Start locally

`PRIVATE_API_SERVICE_CREDENTIAL` is always required. The runtime defaults to
`production`, which requires `DATABASE_URL` and composes:

- `DrizzlePublishedCatalogueRepository` for public Published Briefings;
- `DrizzleEditorialRepository` and the Editorial Workflow command for
  authenticated editorial transitions; and
- `DrizzleEditorialReadRepository` for authenticated editor queue and Briefing
  review queries; and
- `DrizzleTopicRequestDemandRepository` and the aggregate-only Topic-request
  command for authenticated BFF handoffs; and
- `DrizzleSourceSubmissionIntakeRepository` and the source-intake command,
  which durably queues Source Submissions for a later private worker; and
- a Postgres pool that is closed alongside Fastify during shutdown.

Run that production-shaped composition only with an isolated local, staging,
or production database that has already received the checked-in migrations:

```sh
DATABASE_URL='postgres://API_ROLE:PASSWORD@HOST:5432/DATABASE' \
PRIVATE_API_SERVICE_CREDENTIAL='private-service-secret' \
pnpm api:start
```

There is no fixture fallback when `DATABASE_URL` is absent. This protects a
deployment from accidentally exposing manually checked-in reader content or a
non-durable Editorial Workflow.

For interface work without a database, select the restricted fixture mode
explicitly:

```sh
PRIVATE_API_RUNTIME_MODE='local-development' \
PRIVATE_API_SERVICE_CREDENTIAL='local-development-secret' \
pnpm api:start
```

Local-development mode rejects `DATABASE_URL`, serves the checked-in published
Briefing fixture for reader/API work, and intentionally does **not** compose an
editorial repository, Source Submission preparation, or analytics delivery.
It therefore cannot be mistaken for a persistent editorial environment. To
exercise source preparation locally, call
`createLocalSourcePreparationCommand` from an explicit development/test
composition with registered transcript fixtures; do not add it as a silent
`api:start` default.

The service binds to `127.0.0.1:3001` by default. `PRIVATE_API_HOST` and
`PRIVATE_API_PORT` can override those values. In a deployed environment, the
process stays behind the private HTTPS boundary described in ADR 0002.

Call the health endpoint with the same credential:

```sh
curl \
  -H 'Authorization: Bearer private-service-secret' \
  http://127.0.0.1:3001/v1/healthz
```

Every non-public `/v1` endpoint requires a service credential. Errors use one
stable JSON shape so the Vercel BFF and operational callers can handle them
consistently:

```json
{
  "error": {
    "code": "unauthorized",
    "message": "A valid service credential is required."
  }
}
```

## Editor read queries

Production composition exposes two private, read-only contracts for the
future server-rendered editor BFF. They are not browser endpoints and are
absent in restricted local-development fixture mode:

- `GET /v1/editorial/work` returns workflow-state counts and a prioritised,
  summary-only queue. It intentionally contains no revision content, source
  material, or agent output.
- `GET /v1/editorial/briefings/:briefingId` returns the current immutable
  revision, required Template-section states, Claim-to-Accepted-Source support,
  safe Source Submission provenance, freshness, audit records, and
  policy-derived allowed actions.

Both require `Authorization: Bearer <PRIVATE_API_SERVICE_CREDENTIAL>`. A
missing Briefing returns the ordinary `404 not_found` envelope; an invalid ID
returns `400 invalid_request`. The HTTP adapter projects the review model
explicitly: raw submitted text, retrieval fingerprints, processing history,
AI prompts, and processor output never appear in either response. The future
editor BFF must use the authenticated server-side session to decide whether to
call these routes; it must never forward this credential to a browser.

## Source-submission command

In production, `POST /v1/source-submissions` accepts a private, idempotent
submission and durably queues it. Its body is deliberately explicit so the original identifier,
submitter, timestamp, and rights note become retained provenance:

```json
{
  "idempotencyKey": "submission:government-video:v1",
  "submission": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "kind": "transcript",
    "originalIdentifier": "https://example.com/video-transcript",
    "submittedBy": "editor-ernest",
    "submittedAt": "2026-08-07T09:30:00.000Z",
    "rightsNote": "Submitted for editorial assessment."
  }
}
```

The command responds `202 Accepted` with only a safe queue acknowledgement:

```json
{
  "submission": {
    "state": "queued",
    "idempotencyKey": "submission:government-video:v1",
    "submissionId": "...",
    "queuedAt": "2026-08-07T09:30:01.000Z"
  }
}
```

Queueing does not retrieve a URL or document, call an AI provider, propose a
Topic, create a draft, accept a Source, create a Claim, or publish content. A
retry with the same idempotency key returns the original acknowledgement and
does not create another queue record. Unknown or incomplete fields receive a
`400` response using the stable `invalid_request` error envelope.

The later private worker must atomically claim `submitted` records by moving
them to `processing`, then use the source-preparation application seam and its
durable result store to finalise the same record. Its retrieval and provider
ports remain intentionally uncomposed until rights-cleared provider adapters,
queue scheduling, retry policy, and operational monitoring have been reviewed.
Do not add retrieval or AI calls to this HTTP command.

## Local development source preparation

`src/modules/preparation/local-development-adapters.ts` provides an explicit
development/test composition for this command boundary. It is useful when
exercising a supplied transcript without Postgres, a worker, network retrieval,
or an external AI provider.

- Register each transcript fixture explicitly by its original identifier.
- It retrieves only those `transcript` fixtures and produces a deterministic
  SHA-256 content fingerprint. URL and document submissions deliberately fail
  retrieval in this mode; nothing is fetched from the network.
- Its in-memory store handles idempotency and exact duplicate material during a
  single process lifetime only.
- Its `local-development-placeholder` returns a zero-confidence, review-only
  proposal and records that no external AI was called. It cannot generate a
  production draft, accept Sources, alter taxonomy, or publish.

This adapter is not automatically composed by `api:start`, and must never be
used as production provider wiring. The production runtime now provides durable
Source Submission intake only. It still needs reviewed retrieval, provider,
worker claim/scheduling, retry, and operational adapters before it can prepare
material. Until those are composed, the queued submission remains pending
rather than being processed by a placeholder workflow.

Feature endpoints must call application use cases. Do not put HTTP request,
Fastify, header, or credential logic into `src/modules/`.

## Anonymous Topic-request handoff

Production composition also exposes `POST /v1/discovery/topic-requests` to a
trusted Vercel BFF using the service credential. It accepts exactly this body:

```json
{ "requestedTopic": "How does CPF work?" }
```

The API normalises and validates the Topic again, rejects additional fields,
and folds accepted requests into the durable `topic_request_demands` aggregate.
That table has only the requested Topic, demand count, and first/last accepted
timestamps—no per-reader rows, headers, IP addresses, sessions, identities,
user agents, or free-form messages. Demand can inform editorial discovery but
cannot create a Topic or publish a Briefing. The public same-origin BFF route
remains a separate web-composition step; never expose this private endpoint or
its credential to a browser.

## Anonymous analytics collection

When the composition root supplies an anonymous analytics command, the public
collection route is `POST /v1/public/analytics/events`. It is deliberately
separate from private commands: browsers may send an approved event but never
receive a private service credential, database access, or editorial capability.
In production, expose this one path through the public web/BFF ingress; do not
make the rest of the private API reachable from browsers.

The route validates the existing first-party event allowlist before calling its
injected delivery or persistence port. The port receives a newly constructed
event with only the approved fields and opaque rotating session ID. It never
receives a Fastify request, headers, user-agent, referrer, cookies, or client
IP. Payloads containing raw IP addresses or IP-like field names are rejected
before the port is called. The response is only `202 {"accepted":true}` and
does not echo analytics data.

Clients may supply an optional `Idempotency-Key` header. It must be an opaque
8–200 character token using letters, digits, `.`, `_`, `:`, or `-`; do not use
an account, email, IP address, or other identifier. The durable delivery
adapter must treat a repeated key as one event. At the public ingress, apply a
short, infrastructure-level rate limit to this path only. Any address-derived
rate-limit state must be transient and must not be written to the analytics
store or event payload.

This route is not composed by `pnpm api:start` yet because the production
analytics persistence/delivery adapter is still pending. The local-development
runtime also leaves it absent: collecting local events without an explicit,
inspectable development adapter would give a misleading impression of durable
analytics. Tests compose an in-memory command port and prove that invalid
payloads, including raw IP data, cannot reach it.

## Vercel web client

Server-rendered Vercel code uses `src/platform/web/private-api-client.ts`; do
not call the private API from a browser or expose its credential in a public
environment variable. Configure the client explicitly at the web composition
root with these server-only variables:

- `PRIVATE_API_BASE_URL` — the HTTPS URL of the authenticated tunnel or
  reverse proxy, such as `https://private-api.example.com`.
- `PRIVATE_API_SERVICE_CREDENTIAL` — the service credential shared with the
  private API. Never prefix it with `NEXT_PUBLIC_`.

The client applies a short timeout and at most one retry to idempotent queries.
It never retries commands because a failed response can still mean a write was
accepted. It maps HTTP and API error envelopes to `PrivateApiClientError` so
web routes can handle failures without depending on Fastify.

## Public reader catalogue composition

The anonymous reader still renders through Next.js Server Components; it does
not call the private API from a browser. In deployed mode,
`src/platform/web/public-catalogue.ts` requires all of these server-only
variables:

- `PUBLIC_CATALOGUE_SLUGS` — comma-separated published Briefing slugs. This is
  the small bootstrap catalogue used for featured content and search until a
  dedicated public catalogue query is added deliberately.
- `PRIVATE_API_BASE_URL`
- `PRIVATE_API_SERVICE_CREDENTIAL`

`PUBLIC_CATALOGUE_RUNTIME_MODE` defaults to `production`, and a missing
manifest or credential is a startup/render error rather than a fixture
fallback. Set it to `local-development` only for local reader work: that
explicitly selects the checked-in Published Briefing fixtures and must not be
used in a deployed environment. None of these values use the `NEXT_PUBLIC_`
prefix.

## Verify the boundary

`src/platform/api/app.test.ts` calls the Fastify adapter with `app.inject()`.
It verifies the success contract, `/v1` credential gate, and stable errors
without binding a port or requiring Postgres.
