# OMV, Cloudflare Tunnel, and GitHub Actions deployment

This is the repeatable production path for the private runtime on an OMV 7
(Debian 12) host. It preserves the intended boundary: Vercel reaches the API
through Cloudflare, while Postgres and Fastify have no host-published ports.

```text
Vercel server code → api.<domain> → Cloudflare Tunnel connector container
                   → Docker private_api network → api:3001 → Postgres
```

The existing host-level Cloudflare connector remains unchanged. This project
uses a separate remotely-managed tunnel named `kopi-private-api`, with its own
token and route. The Docker connector can resolve the Compose service name
`api`; a host-level connector cannot safely rely on that internal DNS name.

## One-time host setup

On OMV, clone or pull the intended `main` revision, then run:

```sh
sudo bash scripts/setup-omv-private-runtime.sh
```

The guided script does the host-only portions in this order:

1. verifies Docker and the checkout;
2. creates the dedicated `kopi-deploy` account and its runner directory;
3. writes database, API, and role credentials to
   `/etc/kopicontext/private-runtime.env` (mode 640, readable only by the
   root user and the dedicated `kopi-deploy` runner group);
4. starts Postgres, migration, and API containers;
5. collects the separate Cloudflare tunnel token into
   `/etc/kopicontext/cloudflared.env` (mode 600), runs its connector, and
   directs you to add a route with HTTP service `api:3001`;
6. opens the GitHub and Vercel pages for the final protection and environment
   settings; and
7. only then walks you through registering the repository-level GitHub runner.

The wizard never writes a runtime secret to the repository, GitHub Actions,
or Vercel automatically. Use `openssl rand -hex 36` for database passwords and
`openssl rand -hex 48` for the API credential. The two database URLs are
generated from hex-only values so no URL encoding is required.

The initial Postgres volume runs `deploy/postgres/init-roles.sh` once. It
creates `kopi_migrator` (DDL) and `kopi_api` (DML), then grants the API role
access to tables and sequences created by the migration role. Changing these
credentials later requires a deliberate Postgres role-rotation procedure; do
not delete the production volume to rerun initialisation.

## Cloudflare route

In Cloudflare Zero Trust, create the `kopi-private-api` tunnel and use the
Docker installation choice only to obtain its token. Start the connector from
the wizard, then add a public hostname, such as `api.example.com`, with:

| Setting | Value |
| --- | --- |
| Service type | HTTP |
| URL | `api:3001` |
| Docker network | `kopicontext-private_private_api` |

Do not use `localhost:3001`, the OMV LAN address, or add `ports:` to either
Compose file. The hostname does expose intentionally public reader endpoints;
Fastify's bearer credential continues to protect every editorial/private
endpoint. Add Cloudflare Access service-token enforcement only in a later
reviewed change that also teaches the Vercel BFF to send those headers.

## GitHub Actions runner and approval gate

Register a **repository-level** Linux x64 runner as `kopi-deploy` at
`/opt/actions-runner`, and add the `kopi-private-deploy` label to its config.
Install it as a service after configuration:

```sh
sudo /opt/actions-runner/svc.sh install kopi-deploy
sudo /opt/actions-runner/svc.sh start
```

The runner has Docker access and should be treated as privileged host access.
Do not attach it to untrusted pull-request work. The checked-in workflow runs
verification on GitHub-hosted runners for pull requests and executes deployment
only after a `main` push has passed verification and the `home-production`
environment is approved.

Create that GitHub environment and require your approval. Also protect `main`
with required pull requests and the `Verify` status check. Keep workflow
editing limited to trusted maintainers: a workflow can control the deployment
host.

## Vercel values and verification

Set these values in Vercel's Production environment only; none uses a
`NEXT_PUBLIC_` prefix:

| Variable | Value |
| --- | --- |
| `PRIVATE_API_BASE_URL` | `https://api.<your-domain>` |
| `PRIVATE_API_SERVICE_CREDENTIAL` | exact value from the protected OMV runtime file |
| `EDITOR_ALLOWED_EMAIL` | `ernest.tanhk@gmail.com` |
| Google OAuth and Auth.js values | see [editor auth](editor-auth.md) |

After approving a deployment, verify the internal authenticated health check:

```sh
./scripts/deploy-private-runtime.sh
```

Then load a published Briefing from Vercel and sign in as the editor. If an
application deployment fails, return Vercel to the previous deployment before
considering an API image rollback; database migrations are forward-only.
