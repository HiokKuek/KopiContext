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
private API. Its server-side composition must:

1. run `validateTopicRequest` from `src/modules/discovery/topic-request.ts`;
2. send the validated `TopicRequest` through the `TopicRequestTransport` port;
3. use a server-only authenticated private-API client (never a `NEXT_PUBLIC_`
   credential); and
4. return `202` with `{ "status": "received" }` only once the private
   discovery command has accepted the request.

The corresponding private application API command and durable discovery queue
are not composed yet. Until that dependency exists, the form clearly reports
that requests are temporarily unavailable rather than implying the editor has
received one. The endpoint must not retain request headers, raw IP addresses,
or arbitrary browser metadata.

## Domain contract

`TopicRequestTransport` is framework-independent so the eventual BFF route,
private API adapter, and tests can share one request contract without coupling
the discovery module to Next.js or Fastify. It retains a compact Topic phrase
only. It accepts 2–120 normalised characters and rejects obvious email,
Singapore phone, and IP-address input as a privacy guardrail; it is not a
general personal-data detector.
