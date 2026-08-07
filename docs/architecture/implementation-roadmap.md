# First Vertical-Slice Implementation Roadmap

## Purpose and release outcome

The first release proves one end-to-end loop for **How Singapore's Government Works**:

`rights-cleared Source Submission → agent preparation → editor verification and Editorial Approval → published Briefing → anonymous reader search/read/share → privacy-safe discovery signals`

The loop is deliberately narrower than the 25-Topic launch catalogue. Expansion starts only after this path is usable, auditable, and operable.

## Architecture at implementation time

KopiContext is one TypeScript modular monolith with an application API as its highest test and integration seam. The public web application runs on Vercel. A private server runs the application API, Postgres, background workers, and a queue; only the authenticated HTTPS application endpoint may cross the trust boundary. Postgres, queues, worker controls, backups, and operational endpoints remain private.

```text
Reader browser ──> Vercel web ──server-side authenticated HTTPS──> Application API
                                                                      │
Editor browser ──> Vercel web ──server-side authenticated HTTPS──>  │
                                                                      ├── Postgres (private)
                                                                      ├── worker / queue (private)
                                                                      └── provider adapters
                                                                            ├── source retrieval
                                                                            ├── hosted AI (public or rights-cleared inputs only)
                                                                            └── analytics delivery
```

## Module interfaces

The initial interfaces are use-case boundaries, not network services. Their names may evolve, but their responsibilities must remain stable.

| Interface | Owned by | Consumers | Observable outcome |
| --- | --- | --- | --- |
| Public catalogue | Topics, Briefings, Ranking | public web | find, retrieve, and render only Published Briefings and separately rendered Current Updates |
| Editorial workflow | Editorial Workflow | editorial web, Content-systems | create revisions; validate and transition state; record audit history; require Editorial Approval before publication |
| Source preparation | Ingestion, AI-assisted Processing | editorial web, worker | create idempotent Source Submission processing result with provenance, duplicate signal, proposed placement, candidate Claims, draft, confidence, and escalation |
| Evidence management | Sources and Claims | Editorial Workflow, Content-systems | accept/reject Source and Claim support explicitly; answer whether a revision is publishable |
| Discovery signals | Analytics, Ranking | public web, editorial web | validate anonymous events, Topic requests, and no-result searches; produce explainable priority inputs |
| Job execution | Runtime and operations | Ingestion, AI-assisted Processing | enqueue, retry, deduplicate, expose outcome and failure without exposing queue internals |

All interfaces receive a clock and provider ports where time or external calls influence behaviour. Test callers use fakes for source retrieval, AI, analytics delivery, scheduler, and clock; persistence integration tests use real test Postgres.

## Dependency order

### Milestone 0 — Delivery skeleton

**Goal:** establish a runnable, testable TypeScript monolith before feature work.

1. Create the application composition root, configuration contract, and module directory conventions.
2. Establish Postgres migrations, a disposable test database, and transactional integration-test setup.
3. Define the application API transport and error contract, including internal/editor access boundary.
4. Add provider ports and deterministic fakes for retrieval, AI, analytics delivery, clock, and scheduler.
5. Add baseline linting, type checking, unit/integration test commands, browser test harness, formatting, and CI.

**Exit evidence:** a CI run executes an application-API behaviour test against test Postgres and never needs a live external provider.

### Milestone 1 — Canonical content and editorial invariants

**Goal:** make an approved Briefing a real, auditable domain object before building public pages or agents.

1. Model Topic, Subtopic, Entity, Briefing, Briefing revision, Current Update, Source Submission, accepted Source, Claim, Claim support, and audit record.
2. Implement Briefing Template v1 validation, including required sections and Source/freshness data.
3. Implement the Editorial Workflow: Draft → Needs verification → In editorial review → Approved → Published → Archived, including valid returns and reasons.
4. Make the publication transition refuse missing Template requirements, accepted Sources, or Claim support; record editor, time, and approved revision.
5. Seed only the first Topic and a manually reviewable Briefing fixture; do not hard-code article content into the web layer.

**Exit evidence:** application-API tests prove invalid transitions and unsupported publication are rejected, while an explicitly approved revision becomes retrievable as Published.

### Milestone 2 — Public reader journey and visual foundation

**Goal:** let an anonymous reader find and consume the approved civic Briefing on mobile and desktop.

1. Build design tokens and a small accessible component layer, guided by the PRD's KopiContext identity and SGDS interaction conventions.
2. Implement the public catalogue interface: search normalisation, Topic result retrieval, and a no-result state.
3. Render the Topic page from published domain content: one-sentence answer, depth navigation, conversation path, required Briefing Template sections, Sources, and freshness.
4. Render Current Updates separately and only when published; add share and related-Topic affordances as applicable.
5. Add a no-result Topic-request flow with no account requirement.

**Exit evidence:** browser tests cover search → Briefing, no-result → Topic request, and share at narrow mobile and desktop widths, including keyboard and reduced-motion checks.

### Milestone 3 — Editor workspace and evidence review

**Goal:** make the human approval gate usable rather than merely enforceable in an API.

1. Implement editor authentication and server-side access to the private application API; no editorial endpoint is exposed directly to public clients.
2. Build Topic, revision, Source, Claim, and audit views around the Editorial Workflow interface.
3. Show required-section completeness, Claim-to-Source support, source rights notes, retrieval/publication dates, freshness, and review age.
4. Build explicit actions to return, reject, approve, publish, archive, restore, and merge duplicate Topics, each with audit reason where required.
5. Add editor browser coverage for review → approval → public visibility and archive/restore.

**Exit evidence:** the sole editor can publish a reviewed civic Briefing without database access, and every published revision shows its approved evidence trail.

### Milestone 4 — Source Submission preparation and agent jobs

**Goal:** safely reduce editorial drafting work while preserving review control.

1. Build Source Submission creation for URL, document, and transcript inputs, preserving original identifier, submitter, retrieval time, rights note, and processing history.
2. Implement idempotency keys, duplicate/near-duplicate handling, durable job outcomes, bounded retries, and editor-visible escalation.
3. Implement source retrieval and AI provider adapters. Restrict hosted AI input to public or rights-cleared material and retain provider, model, prompt version, input provenance, output, confidence, and rationale.
4. Produce reviewable proposals: Topic/Subtopic placement, candidate Claims linked to excerpts, and a Briefing Template draft. None may accept a Source, change canonical taxonomy, or publish.
5. Connect preparation outcomes to the editor workspace for accept/reject/return decisions.

**Exit evidence:** a transcript Source Submission can be processed with fake providers into reviewable, auditable proposals; duplicate retries do not create duplicate content; no path auto-accepts or publishes.

### Milestone 5 — Analytics, operations, and controlled-launch readiness

**Goal:** close the sustainable operating loop and prove the hybrid deployment can be recovered.

1. Record validated first-party events using rotating pseudonymous sessions: page view, search, result click, no-result search, Topic view, section expansion, Current Update open, related Topic click, share, Topic request, and feedback.
2. Enforce no raw-IP persistence and publish the concise privacy notice.
3. Build the editor's discovery queue and explainable Topic priority from demand, freshness, conversation value, and editorial judgement.
4. Add health checks, structured privacy-safe logs, metrics/alerts for API and job failures, verified backups, and an offsite recovery runbook.
5. Configure private-server runtime, authenticated tunnel/reverse proxy, staging deployment, migration rollout/rollback procedure, and recovery exercise.

**Exit evidence:** an operator can observe a failed job, recover from a tested backup in staging, and confirm private infrastructure is inaccessible from public traffic; the editor can use analytics and requests to choose the next Topic.

## Release milestones

| Release | Includes | Decision gate |
| --- | --- | --- |
| R0: Engineering baseline | Milestone 0 | team can ship a tested migration-backed use case |
| R1: Auditable content core | Milestone 1 | publication invariant is proven before public exposure |
| R2: Reader preview | Milestone 2 | first civic Briefing is usable, responsive, and accessible |
| R3: Editorial beta | Milestones 3–4 | editor can review agent-prepared evidence without bypasses |
| R4: Controlled launch | Milestone 5 | operational recovery, privacy, and monitoring gates are evidenced |
| R5: Catalogue expansion | additional Topics from PRD 0005 | editorial loop, freshness signals, and support capacity justify expansion |

## Expansion rules

Do not split a module into a service because of future possibility. Consider extraction only after measured operational evidence such as independently scaling worker load, independent deploy cadence with recurring coordination cost, or a reliability boundary that cannot be maintained inside the monolith. Record that decision in a new ADR.

New Topic work follows the same loop. It cannot bypass the accepted Source/Claim and Editorial Approval invariants, even when the agent's confidence is high. Current political coverage, candidate or party comparison, accounts, personalisation, monetisation, and autonomous publication remain outside this roadmap unless a new approved PRD changes that scope.
