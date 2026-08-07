# Engineering Team

## Mission

Build and operate KopiContext as a TypeScript modular monolith without weakening its source-backed and human-approved product promises. The team's first outcome is one complete vertical slice: the published civic Briefing **How Singapore's Government Works**.

This document governs engineering work. It complements the editorial approval rules in the PRDs: editorial approval is required to publish content; engineering review and merge gates are required to release software.

## Roles and ownership

### Engineering lead

Owns technical direction, module boundaries, dependency order, release readiness, and the implementation roadmap. The lead:

- converts approved PRDs into small linked implementation issues with observable acceptance criteria;
- assigns work by module rather than by incidental file location;
- resolves cross-module design questions and records durable trade-offs in an ADR;
- reviews cross-cutting changes, deployment changes, migrations, and changes to quality gates; and
- may merge an agent-authored pull request to `main` once every merge gate in this document is satisfied and the change is within an approved PRD.

The lead does not approve Editorial Approval, silently broaden product scope, or deploy unreviewed changes.

### Product-engineering agent

Owns reader and editor-facing vertical slices across the Web/API boundary. Its scope includes public Topic reading, search, Topic requests, editorial workspace journeys, and the shared design-system components those journeys need. It must consume application use cases rather than reach into persistence or worker internals.

### Content-systems agent

Owns the source-to-review path: Source Submissions, accepted Sources, Claims, Briefing revisions, processing provenance, agent-provider adapters, and background-job outcomes. It cannot introduce a path that accepts Sources, changes canonical taxonomy, or publishes a Briefing without the Editorial Workflow.

### Platform-and-reliability agent

Owns application composition, Postgres migrations and test database setup, private-server worker/runtime configuration, authenticated API boundary, health checks, structured privacy-safe logs, backup/recovery runbooks, and observability. It keeps Postgres, queues, backups, and worker controls private.

### Quality agent

Owns the test strategy and release evidence. It maintains the application-API test harness, fakes for source retrieval, AI, analytics delivery, clock, and scheduling, browser critical-path coverage, accessibility checks, and regression triage. The quality agent may block a merge when acceptance criteria or required checks are not demonstrated.

## Module ownership and boundaries

| Module | Primary owner | Public responsibility | Must not own |
| --- | --- | --- | --- |
| Web/API | Product-engineering | HTTP/UI transport and authentication at the application edge | business rules or direct database access from UI code |
| Editorial Workflow | Product-engineering | revision lifecycle, review state, audit records, Editorial Approval gate | AI provider calls or public rendering details |
| Topics and Entities | Product-engineering | canonical Topic, Subtopic, and Entity vocabulary | automatic taxonomy changes from agent output |
| Briefings and Current Updates | Content-systems | versioned Briefing content and strict evergreen/update separation | publishing without Editorial Approval |
| Sources and Claims | Content-systems | accepted-source records, Claim support, provenance | treating a Source Submission as accepted evidence |
| Ingestion | Content-systems | normalisation, retrieval, duplicate detection, job initiation | editorial acceptance or publishing |
| AI-assisted Processing | Content-systems | reviewable proposals, confidence, rationale, provider records | autonomous authoritative decisions |
| Ranking | Product-engineering | explainable Topic priority from approved signals | hidden behavioural profiles |
| Analytics | Product-engineering | validated first-party anonymous events and discovery signals | raw-IP storage or user profiles |
| Runtime and operations | Platform-and-reliability | composition, migrations, jobs, deployment, recovery | product-policy decisions |

An inter-module dependency must be expressed as an application use case or a narrow domain interface. Modules do not import another module's persistence implementation. A new adapter is justified only when a real external variation exists (currently source retrieval, AI, analytics delivery, clock, scheduler, and persistence).

## Agent workflow

1. Start at `README.md`, then read `CONTEXT.md`, the relevant PRD, applicable ADRs, and this document.
2. Select or create a GitHub implementation issue linked to the owning PRD and state user-visible acceptance criteria, module owner, and test seam.
3. Confirm the change is the smallest dependency-ready vertical slice. Raise an alignment question instead of guessing when it changes product scope, an editorial policy, a durable domain term, a security boundary, or an architectural trade-off.
4. Write a failing behaviour test at the application API seam. Use real test Postgres where persistence behaviour matters and fakes for external providers; never call live providers in automated tests.
5. Implement only within the owning module and its explicit interfaces. Keep source preparation, editorial approval, and publication as distinct steps.
6. Run the unit, integration, and browser/accessibility checks relevant to the changed journey. Record the commands and results in the pull request.
7. Open a focused pull request linked to its issue. Include the acceptance criteria, design/ADR consequences, migration and rollback notes when applicable, and screenshots for visual changes at mobile and desktop widths.
8. The engineering lead reviews and may merge when the merge gates pass. Agents do not self-merge or self-deploy.

## Merge gates

Every pull request must satisfy all applicable gates before the engineering lead merges it to `main`:

- The scope maps to an approved PRD and linked GitHub issue; out-of-scope work is removed or separately proposed.
- Tests prove external behaviour through the application API or browser journey, not internal calls or database side channels.
- Relevant automated checks pass, including migration checks and worker idempotency/retry tests when those areas change.
- Public and editorial UI changes are reviewed at narrow mobile and desktop widths; keyboard navigation, visible focus, semantic landmarks, and reduced motion remain intact.
- Published Claim paths retain accepted-Source support; Source Submissions cannot become Sources or published Briefings automatically.
- No secrets, raw IP addresses, private documents, or unlicensed content are committed, sent to hosted AI, or emitted in logs.
- Schema, API, worker, or infrastructure changes include compatibility, rollback, and operational-impact notes.
- Documentation changes accompany any durable vocabulary, architectural, workflow, or operational decision.
- The worktree is clean apart from the reviewed change, and the pull request has a human-readable release note where reader or editor behaviour changes.

## Release responsibility

The engineering lead declares a release candidate only after the relevant merged milestones have passing checks and an operator can complete the documented deployment and recovery checks. The project owner retains deployment authority. Editorial publication remains the sole editor's decision and is never coupled to an engineering deployment.
