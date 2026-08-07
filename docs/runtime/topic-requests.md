# Anonymous Topic-request handoff

The no-result search experience lets a reader request one Topic without an
account. The public request contains only `requestedTopic`; there is no name,
email, phone number, device identifier, raw IP address, free-form message, or
search-history field. The web client validates the request before sending it
and prompts readers not to include personal details.

## Public web endpoint dependency

The interactive form calls the same-origin Vercel web endpoint:

```text
POST /api/topic-requests
Content-Type: application/json

{ "requestedTopic": "How does CPF work?" }
```

That endpoint is intentionally a **web BFF**, not a browser route to the
private API. Its server-side composition:

1. run `validateTopicRequest` from `src/modules/discovery/topic-request.ts`;
2. send the validated `TopicRequest` through the `TopicRequestTransport` port;
3. use a server-only authenticated private-API client (never a `NEXT_PUBLIC_`
   credential); and
4. return `202` with `{ "status": "received" }` only once the private
   discovery command has accepted the request.

The private application API accepts the handoff at:

```text
POST /v1/discovery/topic-requests
Authorization: Bearer PRIVATE_API_SERVICE_CREDENTIAL
Content-Type: application/json

{ "requestedTopic": "How does CPF work?" }
```

This is BFF-only: a browser must not possess the private credential or call
this endpoint directly. The endpoint accepts exactly one field, runs the same
validation again, and returns `202 { "status": "received" }` only after the
discovery command has accepted it. Extra fields (including headers mirrored
into a body, raw IP data, sessions, and browser metadata) are rejected rather
than silently ignored.

The command folds each accepted request into `topic_request_demands`, a durable
editor discovery aggregate with only `requested_topic`, `request_count`, and
first/last acceptance timestamps. It does not create one record per reader or
store an idempotency key, identity, header, IP address, device value, or
free-form message. The editor can use the aggregate as demand evidence, but it
does not create a Topic or publish a Briefing automatically.

The private API production composition supplies this command and repository.
The public BFF is implemented at `src/app/api/topic-requests/route.ts`; it uses
the server-only client composition in `src/platform/web/topic-request-bff.ts`.
It resolves `PRIVATE_API_BASE_URL` and `PRIVATE_API_SERVICE_CREDENTIAL` only on
the server, and returns a generic `503` response for configuration or private
API failures rather than exposing credential or infrastructure details.

## Domain contract

`TopicRequestTransport` is framework-independent so the eventual BFF route,
private API adapter, and tests can share one request contract without coupling
the discovery module to Next.js or Fastify. It retains a compact Topic phrase
only. It accepts 2–120 normalised characters and rejects obvious email,
Singapore phone, and IP-address input as a privacy guardrail; it is not a
general personal-data detector.
