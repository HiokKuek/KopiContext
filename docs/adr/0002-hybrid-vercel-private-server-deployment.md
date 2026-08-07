# Use Vercel for web delivery and a private server for data and workers

KopiContext will host its public web application on Vercel, with Postgres and containerised workers on a private server. The server will expose only an authenticated HTTPS application API through a tunnel or reverse proxy; databases, queues, and worker controls remain private and are never directly exposed to the public internet.

## Considered Options

- Host every component on Vercel-managed infrastructure
- Host every component on the private server
- Split web delivery from private data and worker operations

## Consequences

The deployment uses an explicit trust boundary and requires backups, monitoring, and offsite recovery for the private server.
