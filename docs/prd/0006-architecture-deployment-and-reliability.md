# Modular-Monolith Architecture, Deployment, and Reliability

Part of #1.

## Problem Statement

The product needs a deployable MVP that remains secure, observable, and maintainable while Vercel serves the web layer and a private server owns data and workers.

## Solution

Build a TypeScript modular monolith with one primary Postgres database and one application API. Vercel hosts the public web layer; a private server hosts the application API, workers, queues, and data behind an authenticated HTTPS tunnel or reverse proxy.

## User Stories

1. As a reader, I want Topic pages to load quickly, so that a five-minute briefing starts without friction.
2. As an editor, I want reliable access to the editorial workspace, so that review is not blocked by background work.
3. As an operator, I want all database and worker controls private, so that public traffic cannot reach infrastructure directly.
4. As an operator, I want retryable, idempotent jobs, so that ingestion failures recover safely.
5. As an operator, I want logs, health checks, backups, and offsite recovery, so that failures are diagnosable and recoverable.
6. As a developer, I want explicit module Interfaces, so that future extraction follows evidence rather than convenience.
7. As a developer, I want the application API to be the primary seam, so that tests and callers share a stable interface.

## Implementation Decisions

- Modules are Web/API, Editorial Workflow, Topics and Entities, Briefings and Current Updates, Sources and Claims, Ingestion, AI-assisted Processing, Ranking, and Analytics.
- The application API is the primary external Interface. Modules may have internal seams only where an actual adapter varies, such as AI, source retrieval, clock, scheduler, and persistence.
- Postgres, queues, worker controls, and backups stay on the private server; only an authenticated HTTPS application endpoint is exposed through a tunnel or reverse proxy.
- Delivery requires health checks, structured privacy-safe logs, retry policies, backup verification, and offsite recovery testing.

## Testing Decisions

- Test application behaviour through the application API with real test Postgres and fake external adapters.
- Test worker idempotency, retry, and failure visibility through job outcomes rather than queue internals.
- Exercise deployment configuration and recovery procedures in an isolated staging environment before controlled launch.

## Out of Scope

- Public database access, microservices, Kubernetes, and service extraction without operational evidence.

## Further Notes

- This PRD implements ADRs 0001–0003.
