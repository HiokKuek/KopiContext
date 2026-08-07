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

## Verify the boundary

`src/platform/api/app.test.ts` calls the Fastify adapter with `app.inject()`.
It verifies the success contract, `/v1` credential gate, and stable errors
without binding a port or requiring Postgres.
