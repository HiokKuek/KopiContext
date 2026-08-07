# Private application API baseline

The private API is a Fastify process that belongs on the private server, not
on Vercel. It is the HTTP adapter for application use cases: Vercel calls it
only from server-side code through the authenticated tunnel or reverse proxy;
browsers never receive its credential or database access.

The baseline currently exposes `GET /v1/healthz`. It proves the versioning,
authentication, lifecycle, and contract-testing boundary before feature
endpoints are connected to the editorial and evidence modules.

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

Every `/v1` endpoint requires a service credential. Errors use one stable JSON
shape so the Vercel BFF and operational callers can handle them consistently:

```json
{
  "error": {
    "code": "unauthorized",
    "message": "A valid service credential is required."
  }
}
```

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
