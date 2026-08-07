# Product Foundation: verified conversation briefings

## Problem Statement

English-speaking Singaporeans often encounter subjects they want to discuss but lack enough trustworthy context to participate confidently. Existing news, search, and encyclopedic products either overwhelm a beginner or mix durable explanation with time-sensitive reporting. The project needs an end-to-end, maintainable foundation that turns reviewed source material into concise Briefings while retaining human editorial control.

## Solution

Deliver a TypeScript modular monolith that lets a sole editor receive Source Submissions, use agents to propose Topic and Subtopic placement, produce source-backed drafts, and explicitly approve publication. Readers can anonymously search, read, share, and request Topics. The first vertical slice is the neutral civic Briefing, **How Singapore's Government Works**, delivered through Vercel web surfaces and a private-server application API, Postgres, and workers.

## User Stories

1. As an anonymous reader, I want to search by Topic, Entity, Event, synonym, or beginner question, so that I can quickly find a relevant Briefing.
2. As an anonymous reader, I want a 30-second overview, so that I can decide whether a Topic is relevant.
3. As an anonymous reader, I want a five-minute Briefing, so that I can join a conversation without reading an encyclopedia.
4. As an anonymous reader, I want deeper background and Current Updates separated clearly, so that I can distinguish stable context from changing developments.
5. As an anonymous reader, I want key terms, relevant people and organisations, debates, and questions to ask, so that I can speak and listen more thoughtfully.
6. As an anonymous reader, I want Sources and freshness information shown with published content, so that I can assess trust and recency.
7. As an anonymous reader, I want to share a Briefing without creating an account, so that the product remains useful with minimal friction.
8. As an anonymous reader, I want to request an unavailable Topic after a failed search, so that my need informs editorial discovery.
9. As an editor, I want to create and edit Topics, Briefings, Current Updates, Entities, Events, Sources, and Claims, so that the catalogue remains accurate and coherent.
10. As an editor, I want to submit a URL, document, or transcript as a Source Submission, so that provided material enters a traceable workflow.
11. As an editor, I want agents to propose Topic and Subtopic placement with confidence and rationale, so that I can review efficiently without losing taxonomy control.
12. As an editor, I want agents to extract candidate Claims and draft structured Briefing sections, so that I can focus on judgement and approval.
13. As an editor, I want to accept or reject a proposed Source, Claim, classification, and draft, so that no generated material becomes authoritative by default.
14. As an editor, I want every accepted Source to retain publisher, URL or identifier, source type, publication date, retrieval date, relation, and rights note, so that Claims remain auditable.
15. As an editor, I want publication to require explicit Editorial Approval and retain approver and time, so that the product has an accountable record.
16. As an editor, I want revision history and archive/restore actions, so that mistakes and outdated content are recoverable.
17. As an editor, I want civic explainers to use primary official Sources where available and stronger corroboration for contested, interpretive, or current Claims, so that political content remains neutral and verifiable.
18. As an editor, I want the first civic Briefing to explain institutions and processes without candidate, party, or current-affairs analysis, so that the MVP has a clear risk boundary.
19. As an operator, I want ingestion and agent jobs to be idempotent, retryable, observable, and deduplicated, so that failures do not duplicate content or disappear silently.
20. As an operator, I want Postgres, queues, and worker controls to remain private, so that a Vercel-hosted web surface does not expose internal infrastructure.
21. As an operator, I want backups, monitoring, and offsite recovery for the private server, so that the launch environment can recover from failure.
22. As a product owner, I want rotating pseudonymous sessions and minimal anonymous analytics, so that I can understand usage without building behavioural profiles.
23. As a product owner, I want to measure searches, no-result searches, Topic reads, section expansion, shares, and Topic requests, so that I can improve usefulness and discovery.
24. As a product owner, I want a concise privacy notice and no raw-IP retention, so that readers understand the bounded analytics model.
25. As a developer, I want internal modules with explicit ownership boundaries, so that the monolith stays maintainable and can be split later only when justified.
26. As a developer, I want the application API to be the primary test seam, so that tests verify observable behaviour rather than implementation details.
27. As a developer, I want provider fakes for sources, AI, analytics delivery, clock, and scheduling, so that automated tests never depend on live third parties.
28. As a coding agent, I want a canonical entry point linking vocabulary, PRDs, ADRs, and quality gates, so that I can make consistent, bounded changes.
29. As the project owner, I want agents to submit changes for review without merging or deploying, so that agentic development retains human change control.

## Implementation Decisions

- Use a TypeScript modular monolith with modules for Web/API, editorial workflow, Topics and Entities, Briefings and Current Updates, Sources and Claims, ingestion, AI-assisted processing, ranking, and analytics.
- Host public web delivery on Vercel. Run the application API, Postgres, containerised workers, and any queues on the private server; use an authenticated HTTPS tunnel or reverse proxy for the API. Keep infrastructure controls private.
- Model Source Submission separately from Source. Agents may normalise a submission and propose classification, Claims, and drafts; an editor accepts a Source and grants Editorial Approval before anything is published.
- Make Briefing the evergreen structured explanation and Current Update the dated, separately displayed development. Use Topic and Subtopic as the editorial navigation hierarchy.
- Launch with anonymous reading, searching, sharing, and Topic requests. Defer accounts and saved Briefings.
- Use hosted AI only for public or rights-cleared material. Store provider, model, prompt version, input provenance, and generated output for editorial review; exclude secrets, private documents, and personal data unless explicitly approved.
- Begin with neutral civic explainers and exclude candidate/party comparisons, political analysis, and current political coverage. Require primary official Sources for civic Claims where available; require stronger corroboration for contested, interpretive, or current Claims.
- Apply SGDS accessibility and interaction patterns as a foundation while using independent KopiContext brand tokens and editorial components. The design system must be mobile-first, keyboard-accessible, readable, and reduced-motion aware.
- Record first-party anonymous analytics in the primary database using rotating pseudonymous sessions, no raw IP retention, and a concise privacy notice.
- Treat the application API as the highest primary test seam. Exercise reader and editorial journeys through it with real test Postgres and fake external providers; add browser end-to-end coverage for critical journeys.
- Require a linked issue or PRD section, acceptance criteria, a red behaviour test, the smallest green implementation, and verified checks for every agent-driven change. Human review is required for merging and deployment.

## Testing Decisions

- Tests assert externally visible behaviour through the application API, never private methods, internal collaborator calls, or database side channels.
- Every vertical slice starts red, turns green through the smallest implementation, and is refactored only with the relevant checks green.
- Unit coverage will protect ranking, freshness, source validation, duplicate detection, Claim-to-Source relationships, content-state transitions, query normalisation, and analytics-event validation.
- Integration coverage will protect Source Submission ingestion, agent draft creation with fake providers, Editorial Approval, search/retrieval, analytics persistence, and scheduled processing.
- Browser end-to-end coverage will protect search-to-Briefing, no-result-to-Topic-request, editor review-to-publication, source-ingestion-to-review, and share journeys.
- There is no existing automated-test prior art in this empty codebase. The application API seam and fake-provider approach are the initial testing standard.

## Out of Scope

- Autonomous publishing, merging, or deployment.
- Breaking-news publishing and live political analysis.
- Candidate or party comparisons, professional medical/legal/financial advice, and exhaustive live sports data.
- Accounts, cross-device saves, social networking, personal behavioural profiles, and broad personalisation.
- Scraping or republishing commercial content without rights.
- Premature microservices or service extraction.

## Further Notes

- The initial audience is English-speaking Singaporeans aged about 22–40 preparing for social or professional conversations.
- The controlled launch ultimately targets 25 curated Topics across local life, technology/AI, business, culture, sport, and neutral civic explanation, but starts by proving the first vertical slice.
- Design signature: a calm “conversation path” that connects the one-sentence answer, context, disagreements, and questions to ask.
- Analytics and privacy policies require refinement before controlled launch; category-specific freshness targets are displayed rather than promising a universal recency SLA.
