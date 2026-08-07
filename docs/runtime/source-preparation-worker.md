# Source-preparation worker and scheduled proposals

The private worker prepares reviewable proposals. It is not an editor, a
publisher, or a public web service.

## Two separate jobs

KopiContext intentionally separates these responsibilities:

| Process | What it does | When it runs | What it must never do |
| --- | --- | --- | --- |
| Source-preparation worker | Claims already-submitted material, retrieves approved public/right-cleared content, and produces a proposal | Continuously while its private Docker profile is enabled | Accept a Source, alter taxonomy, approve, publish, or expose an HTTP port |
| Scheduled proposal runner | Periodically selects a small, editor-visible set of justified work (for example stale material, a missing launch baseline, or Topic demand) and creates Source Submissions for later preparation | Daily or weekly, after the editorial lead chooses the cadence and budget | Browse indiscriminately, create hidden scope, accept evidence, change editorial state, or publish |

The runner only **enqueues** work. The worker only **prepares** it. The editor
reviews every result through the existing Source Submission and Editorial
Workflow screens.

## What exists today

- `pnpm worker:start` is an opt-in private process. The Docker Compose
  `source-preparation` profile is disabled by default.
- The worker has a durable Postgres queue, row leases, bounded retry, and
  escalation after the configured retry limit.
- It fails closed until a reviewed, image-packaged retrieval/AI adapter is
  configured with `SOURCE_PREPARATION_ADAPTER_MODULE`.
- The scheduled proposal runner is intentionally **not yet enabled**. This is
  because its provider, cadence, cost budget, source families, and selection
  rules are editorial-policy decisions—not a deployment default.

## Before enabling a reviewed provider adapter

The editorial and engineering leads should record all of the following:

1. The provider and model, credential storage location, and per-run cost cap.
2. Which source families are permitted and how rights-cleared transcripts,
   documents, and URLs are handled.
3. A data-minimisation review: no secrets, private documents, or reader data
   may be sent to the provider.
4. A daily or weekly cadence, maximum work items per run, timeout, concurrent
   worker count, and retry policy.
5. The editor-visible selection reason for each queued item: new submission,
   missing launch baseline, stale published material, or demonstrated Topic
   demand.
6. Monitoring and an operator runbook for provider failures, retry exhaustion,
   model-output quality issues, and credential rotation.

Do not place a provider key in Vercel, browser variables, GitHub repository
variables, a committed `.env` file, or an adapter URL. Keep it in the private
server's protected runtime environment, with the same permissions and backup
discipline as database credentials.

## Enabling the worker after approval

1. Build a reviewed adapter into the private worker image. Its module must be
   a local `file:` URL; network-loaded modules are rejected.
2. Add the worker's database URL, a distinct worker ID, adapter module URL,
   and selected lease/poll/retry settings to the protected private runtime
   environment file.
3. Start only the opt-in profile on the private server:

   ```sh
   docker compose --env-file /etc/kopicontext/private-runtime.env \
     -f compose.private-runtime.yaml --profile source-preparation up -d worker
   ```

4. Submit one rights-cleared test item and inspect the editor-visible proposal,
   provenance, retry history, and escalation behaviour before enabling any
   scheduled runner.
5. Keep the worker private. It does not need a Cloudflare route or a host port.

## Future cron integration

The scheduler should use the host's system scheduler or a private, dedicated
container—not a Vercel cron endpoint. It will run a bounded command, record a
run receipt and selection reasons, enqueue idempotent Source Submissions, and
exit. A suitable daily schedule will be documented only alongside the actual
runner and its accepted provider policy.

Until then, use the editor's Source Submission form for deliberate material
intake. This keeps the agentic boundary real rather than simulating autonomy.
