# Product Team

The KopiContext product team owns the problem framing, editorial product quality, and priority decisions that turn reader need into an accountable queue of work. It uses the domain terms in [CONTEXT.md](../../CONTEXT.md) and works from the PRDs in [docs/prd](../prd/README.md).

## Roles

### Product lead

Owns product direction, the launch catalogue, prioritisation, reader outcomes, and the scope of PRDs 0001, 0002, 0005, and 0007. The product lead converts demand signals into a prioritised proposal, defines measurable outcomes, and keeps the product within its conversation-briefing purpose.

### Editorial lead

The sole editor and owner of factual, civic, and publishing quality. Owns the Editorial Workflow in PRD 0003 and works with the agent-processing workflow in PRD 0004. The editorial lead accepts Sources, verifies Claims, approves a Briefing for publication, and decides whether a Topic or Subtopic is appropriate. This role cannot be delegated to an agent.

### Content-operations agent

Prepares Source Submissions for review under PRD 0004: it normalises rights-cleared material, detects duplicates, proposes Topic and Subtopic placement, identifies candidate Claims, and produces a Briefing Template draft with provenance, confidence, and rationale. It may not accept Sources, change the canonical taxonomy, grant Editorial Approval, or publish.

### Product-research agent

Summarises first-party analytics, Topic requests, failed searches, freshness signals, and source opportunities under PRD 0005. It proposes a ranked editorial queue and explains each recommendation; it never automatically changes the catalogue or creates published content.

### Design lead

Owns the reader experience and design-system coherence in PRDs 0002 and 0007. The design lead verifies that interface proposals serve the Briefing Template, are mobile-first and accessible, and retain KopiContext's independent editorial identity while using SGDS patterns as an accessibility baseline.

## Decision rights

| Decision | Recommends | Decides | Must be recorded in |
| --- | --- | --- | --- |
| Reader problem, outcome, and PRD priority | Product lead, research agent | Product lead | PRD or GitHub issue |
| New Topic or Subtopic | Content-operations agent, research agent | Editorial lead | Editorial workspace and launch catalogue when applicable |
| Source acceptance and Claim support | Content-operations agent | Editorial lead | Editorial Workflow audit record |
| Briefing Template changes | Product lead, editorial lead, design lead | Product lead with editorial-lead agreement | PRD 0002 |
| Editorial Approval, publication, archive, restore | Content-operations agent may prepare | Editorial lead | Editorial Workflow audit record |
| Design tokens and public interaction patterns | Design lead | Product lead, subject to accessibility requirements | PRD 0007 |
| Analytics events and privacy limits | Product lead | Product lead | PRD 0005 and relevant ADR/PRD update |
| Architecture or deployment trade-off | Engineering lead | Product lead for product trade-offs; engineering lead for implementation | ADR and PRD 0006 |

When a decision changes durable vocabulary, an architecture boundary, or an approved requirement, the owner updates the glossary, ADR, or PRD before implementation begins.

## Weekly operating loop

1. **Observe.** The product-research agent prepares a privacy-safe briefing of Topic requests, no-result searches, Topic reads, section expansion, shares, feedback, freshness/review age, and relevant Source opportunities.
2. **Triage.** The product lead and editorial lead review that briefing with the launch catalogue. They select the next small set of Source Submissions or Briefing maintenance work, explaining why each item matters now.
3. **Prepare.** The content-operations agent processes approved material into reviewable proposals. Low-confidence, risky, duplicate, or failed work is escalated rather than silently retried into publication.
4. **Review.** The editorial lead verifies proposed Sources and Claims, edits the Briefing Template draft, and moves work through the Editorial Workflow. Civic content follows the primary-official-Source and corroboration rules.
5. **Publish and learn.** Only the editorial lead grants Editorial Approval. The product team then reviews reader outcome and freshness signals, records follow-up work, and archives or revises outdated material deliberately.
6. **Improve the system.** The product lead records validated product changes in PRDs; the design lead and engineering lead receive only scoped, issue-backed work that supports the next vertical slice.

## PRD ownership

| PRD | Accountable owner | Required collaborators |
| --- | --- | --- |
| [0001 Product foundation](../prd/0001-product-foundation.md) | Product lead | Editorial lead, engineering lead, design lead |
| [0002 Briefing template and reader experience](../prd/0002-briefing-template-and-reader-experience.md) | Product lead | Editorial lead, design lead |
| [0003 Editorial workflow](../prd/0003-editorial-workflow.md) | Editorial lead | Product lead, engineering lead |
| [0004 Source Submission and agent processing](../prd/0004-source-submission-and-agent-processing.md) | Editorial lead | Content-operations agent, engineering lead |
| [0005 Topic discovery, analytics, and sustainability](../prd/0005-topic-discovery-analytics-and-sustainability.md) | Product lead | Product-research agent, editorial lead, engineering lead |
| [0006 Architecture, deployment, and reliability](../prd/0006-architecture-deployment-and-reliability.md) | Engineering lead | Product lead, editorial lead |
| [0007 Design system and responsive standards](../prd/0007-design-system-and-responsive-standards.md) | Design lead | Product lead, engineering lead |

## Working agreements

- A Briefing is evergreen; a Current Update is dated and displayed separately.
- A Source Submission is not a Source until the editorial lead accepts it for Claim support.
- Agents make proposals with provenance and rationale. They do not publish, merge code, or deploy.
- Product work starts with a linked issue or PRD section, observable acceptance criteria, and the smallest useful vertical slice.
- The launch catalogue is an editable prioritisation tool, not an automatic publication schedule.
