# Private application API baseline

The private API is a Fastify process that belongs on the private server, not
on Vercel. It is the HTTP adapter for application use cases: Vercel calls it
only from server-side code through the authenticated tunnel or reverse proxy;
browsers never receive its credential or database access.

The baseline exposes `GET /v1/healthz` and can compose feature command ports.
It proves the versioning, authentication, lifecycle, and contract-testing
boundary before production persistence and workers are connected.

## Start locally

Choose a non-empty credential and run:

```sh
PRIVATE_API_SERVICE_CREDENTIAL='local-development-secret' pnpm api:start
```

The service binds to `127.0.0.1:3001` by default. `PRIVATE_API_HOST` and
`PRIVATE_API_PORT` can override those values. In a deployed environment, the
process stays behind the private HTTPS boundary described in ADR 0002.

Call the health endpoint with the same credential:

```sh
curl \
  -H 'Authorization: Bearer local-development-secret' \
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

## Source-submission command

When the API composition root supplies the source-submission command port,
`POST /v1/source-submissions` accepts a private, idempotent submission for
preparation. Its body is deliberately explicit so the original identifier,
submitter, timestamp, and rights note become retained provenance:

```json
{
  "idempotencyKey": "submission:government-video:v1",
  "submission": {
    "id": "submission-government-video",
    "kind": "transcript",
    "originalIdentifier": "https://example.com/video-transcript",
    "submittedBy": "editor-ernest",
    "submittedAt": "2026-08-07T09:30:00.000Z",
    "rightsNote": "Submitted for editorial assessment."
  }
}
```

The command responds `202 Accepted` with the preparation outcome. The outcome
is a proposal for editorial review; it does not accept a Source, alter the
Topic taxonomy, or publish content. Unknown or incomplete fields receive a
`400` response using the stable `invalid_request` error envelope. A caller can
retry the same idempotency key without triggering a second preparation.

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
used as production provider wiring. The production private runtime still needs
reviewed retrieval, provider, persistence, queue, and operational adapters.

Feature endpoints must call application use cases. Do not put HTTP request,
Fastify, header, or credential logic into `src/modules/`.

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

## Verify the boundary

`src/platform/api/app.test.ts` calls the Fastify adapter with `app.inject()`.
It verifies the success contract, `/v1` credential gate, and stable errors
without binding a port or requiring Postgres.
