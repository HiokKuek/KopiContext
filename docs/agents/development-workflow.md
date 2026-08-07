# Agent Development Workflow

## Read order

For product, design, or code work, read `README.md`, `CONTEXT.md`, the relevant PRD in `docs/prd/`, and ADRs in `docs/adr/` before proposing a change. Use the glossary's terms exactly.

## Delivery loop

1. Link the work to a GitHub issue or a PRD section and state its acceptance criteria.
2. Work one vertical slice at a time through the application API seam.
3. Write a failing behaviour test before the smallest implementation that can satisfy it.
4. Use fakes for source, AI, analytics-delivery, clock, and scheduler providers; never call live third-party providers in automated tests.
5. Run the relevant unit, integration, and end-to-end checks; refactor only while they remain green.
6. Update the PRD, glossary, or ADR only when the change resolves a durable product term or architectural trade-off.
7. Submit changes for human review. Publishing content, merging code, and deployment require human approval.

## Quality gates

- Preserve the separation between a Briefing and a Current Update.
- Make every published Claim traceable to accepted Sources.
- Keep a Source Submission distinct from an accepted Source.
- Design and test mobile-first, keyboard-accessible interfaces with readable typography and reduced-motion support.
- Keep modules independent behind the application API; avoid speculative service extraction.
