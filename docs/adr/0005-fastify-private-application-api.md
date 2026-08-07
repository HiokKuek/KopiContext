# Use a Fastify private JSON application API

KopiContext will run a versioned Fastify JSON API in the private Node runtime. Vercel calls it only through a server-side BFF client; browsers never receive the private service credential or database access. The API maps HTTP to application use cases, while workers call those same use cases directly.

## Considered Options

- Next.js Route Handlers as the application backend
- Hono or Express HTTP adapter
- Fastify private Node adapter

## Consequences

Fastify provides a container-native lifecycle, schema validation, privacy-safe hooks, and in-process contract tests through `app.inject()`. Modules stay HTTP-free, endpoints are versioned under `/v1`, and the private adapter verifies service authentication before acting on editor assertions. Public Next Route Handlers remain BFF surfaces only.
