# Private-server deployment package

This package implements the approved Vercel-web/private-runtime split without
creating infrastructure or credentials. The private server runs Postgres,
migrations, Fastify, and—only after an approved provider adapter is packaged—a
separate source-preparation worker. The worker is a private process, never an
HTTP route and never part of the Vercel deployment.

## Package and boundary

- `Dockerfile.private-api` is a Node 22 production image, runs as non-root
  `node`, installs lockfile-pinned production dependencies, and includes only
  runtime source plus checked-in migrations.
- `compose.private-runtime.yaml` has Postgres, a one-off migration job, and
  Fastify. It contains **no host `ports:`**. Postgres is internal-only; Fastify
  is available only on the private Docker network to an explicitly attached
  authenticated tunnel/reverse proxy. Its `worker` service is behind the
  `source-preparation` profile, has no port, and only joins the private data
  network.
- `deploy/private-runtime.env.example` documents names only. Put a populated
  file outside Git and never paste secrets into chat, issues, or source.

The Docker base uses `node:22-alpine` for developer convenience. Before a
production rollout, resolve it to a reviewed immutable image digest and record
that digest with the deployment change.

## Prerequisites and secrets

Use a patched Linux host with encrypted disks, firewall default-deny, NTP,
off-host encrypted backups, and a tested restore procedure. Install Docker
Engine and the Compose plugin. Create separate Postgres roles before traffic:

- `MIGRATION_DATABASE_URL`: DDL-only role, able to apply reviewed migrations.
- `DATABASE_URL`: DML-only API role, unable to create/drop schema or own it.
- `TEST_DATABASE_URL`: separate clearly named test database/role; never use
  production credentials for integration tests.

Generate a high-entropy `PRIVATE_API_SERVICE_CREDENTIAL`. It is shared only by
Fastify and Vercel server-side code, not the browser or editor session. Never
put any database URL, SSH credential, or Postgres bootstrap variable in Vercel.

### Source-preparation worker

The generic worker deliberately has no default retrieval or AI provider. It
will exit before opening Postgres or claiming work unless all of the following
are set in the private-server environment:

- `SOURCE_PREPARATION_WORKER_ID`: a stable, unique identifier for this worker
  instance;
- `SOURCE_PREPARATION_ADAPTER_MODULE`: a `file:` URL to a reviewed adapter
  packaged in the private image; and
- `DATABASE_URL`: the private DML connection already used by the API.

The adapter module must export `createSourcePreparationAdapters()`, returning
the retrieval and AI ports defined by the application. It may read its own
server-only provider credentials, but it must never add them to a web
environment, logs, prepared output, or a browser response. A provider change
is a reviewed code-and-image change: do not mount an ad-hoc script or point at
a remote module URL. The runtime rejects non-`file:` URLs and malformed
adapter modules before a queue lease is claimed.

While no approved adapter exists, leave the worker profile disabled. Queued
Submissions remain durable and are not marked failed merely because the worker
is not configured. This is intentional: a human can still inspect or manage
the intake without a model silently producing placeholder proposals.

## Controlled startup

```sh
install -m 600 deploy/private-runtime.env.example /etc/kopicontext/private-runtime.env
# Edit that external file locally or through a secret manager.
docker compose --env-file /etc/kopicontext/private-runtime.env -f compose.private-runtime.yaml config
docker compose --env-file /etc/kopicontext/private-runtime.env -f compose.private-runtime.yaml up -d --build
```

Compose waits for Postgres health, runs checked-in migrations, then starts the
API only after migrations succeed. If the migration job fails, inspect it and
do not bypass startup sequencing or run unreviewed SQL:

```sh
docker compose --env-file /etc/kopicontext/private-runtime.env -f compose.private-runtime.yaml logs migrate api
```

The API health check is authenticated. Confirm it from the private API
container/network after rollout; never add a public health port:

```sh
docker compose --env-file /etc/kopicontext/private-runtime.env -f compose.private-runtime.yaml exec api \
  node -e "fetch('http://127.0.0.1:3001/v1/healthz',{headers:{Authorization:'Bearer '+process.env.PRIVATE_API_SERVICE_CREDENTIAL}}).then(r=>{console.log(r.status);process.exit(r.ok?0:1)})"
```

After a reviewed adapter has been included in the image and its environment
values have been configured, opt in to the worker separately:

```sh
docker compose --env-file /etc/kopicontext/private-runtime.env \
  -f compose.private-runtime.yaml --profile source-preparation up -d --build
docker compose --env-file /etc/kopicontext/private-runtime.env \
  -f compose.private-runtime.yaml logs worker
```

The worker claims at most one Submission at a time with a lease, persists its
terminal result through the same Postgres aggregate, retries unexpected
adapter failures with the bounded policy, and escalates after the attempt
limit. It cannot call Fastify, accept a Source or Claim, create taxonomy, or
publish content. Retrieval/model work therefore remains off the request path.

## Private ingress and Vercel handoff

Do not add `ports:` to `postgres` or `api`. To connect Vercel, attach an
authenticated HTTPS tunnel/reverse proxy to `private_api`. It alone may accept
controlled ingress, must terminate TLS, restrict access to intended Vercel
server-side traffic, forward only to `api:3001`, and preserve Fastify's bearer
credential check as defence in depth.

Set only these server-only Vercel environment values:

| Variable | Value |
| --- | --- |
| `PRIVATE_API_BASE_URL` | authenticated private HTTPS endpoint |
| `PRIVATE_API_SERVICE_CREDENTIAL` | exact shared Fastify credential |
| `EDITOR_ALLOWED_EMAIL` | single configured editor address |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Auth.js/Google OAuth values; see [editor auth](editor-auth.md) |

None may use `NEXT_PUBLIC_`. If the access proxy needs additional service-token
headers, add/test explicit server-only BFF configuration before enabling it;
do not put those credentials in browser-visible configuration.

## Rollout and recovery

1. Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm db:check`, and
   `pnpm build` for the intended commit.
2. Take and verify an encrypted off-host Postgres backup. Review migration
   impact and a roll-forward plan; checked-in migrations are forward-only.
3. Validate `docker compose ... config`, start the stack, confirm migration
   completion and authenticated health, then deploy Vercel configuration.
4. Exercise an editor read-only queue query before any editorial command.
5. If the app rollout fails, return Vercel to its prior deployment. Roll API
   images back only after schema compatibility review; never restore/downgrade
   a database solely to undo an application image.

If enabling source preparation, additionally confirm the worker starts with a
reviewed adapter, submits no browser-visible provider data, and processes a
rights-cleared staging transcript into a reviewable suggestion only. Verify
the editor must still perform Source, Claim, and publication decisions.

The API currently accepts one service credential. Schedule a brief maintenance
window for credential rotation until an explicitly reviewed overlap mechanism
exists.
