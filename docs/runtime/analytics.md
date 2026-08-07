# Browser analytics

KopiContext uses first-party, privacy-safe analytics to understand whether a
published Briefing helps readers get oriented. It does not create accounts,
profiles, advertising audiences, or behavioural histories.

## Browser boundary

`src/modules/analytics/browser-analytics-client.ts` is the only browser
transport. It emits four approved reader events in this first slice:

- `page-view` with a path (never query parameters);
- `search` with the normalised search query already displayed to the reader;
- `no-result-search` with that same normalised query; and
- `topic-view` with a published Topic slug.

The client stores one opaque, randomly generated session ID in local storage
and rotates it after 24 hours. It sends each event to the same-origin public
endpoint, `/v1/public/analytics/events`, with `credentials: "omit"` and a
`no-referrer` policy. It does not read cookies, user-agent data, screen/device
properties, geolocation, accounts, or browser headers. It never contains an
application credential.

If local storage, secure randomness, or delivery is unavailable, analytics
silently does nothing; reader access must remain unaffected.

## Public ingress and retention

The public ingress exposes only the analytics collection path and forwards it
to the public Fastify analytics route. The remaining private application API
is not browser-accessible. The route validates and reconstructs each event
before an injected delivery adapter receives it, so raw request metadata,
unknown fields, and raw IP data are never retained.

Apply rate limiting at the ingress. Address-derived rate-limit information can
be transiently evaluated by that layer, but must never enter the analytics
event store, delivery port, application logs, or reader-facing response.

See [the private API runbook](private-api.md#anonymous-analytics-collection)
for the endpoint contract and idempotency requirements.
