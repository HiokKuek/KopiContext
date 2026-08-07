# Source Submission and Agent Processing

Part of #1.

## Problem Statement

The editor needs agents to turn rights-cleared source material into reviewable proposals without allowing generated content to become authoritative or untraceable.

## Solution

Expose one deep application interface: prepare a Source Submission for editorial review. It owns normalisation, duplicate detection, Topic/Subtopic proposals, candidate Claims, structured draft creation, provenance, retries, and escalation.

## User Stories

1. As an editor, I want to submit a URL, document, or transcript, so that material enters a recorded workflow.
2. As an editor, I want original provenance and rights notes retained, so that I can assess whether material may be used.
3. As an editor, I want duplicate and near-duplicate detection, so that the queue stays manageable.
4. As an editor, I want proposed Topic and Subtopic placement with confidence and rationale, so that I retain taxonomy judgement.
5. As an editor, I want candidate Claims linked to excerpts and proposed Sources, so that verification is efficient.
6. As an editor, I want an agent-generated Template draft, so that I can focus on review rather than first drafting.
7. As an editor, I want low-confidence, risky, or failed processing escalated, so that I know when intervention is required.
8. As an operator, I want idempotent retries and visible job failures, so that work neither disappears nor duplicates.

## Implementation Decisions

- Source Submission is distinct from an accepted Source and preserves submitter, original identifier, retrieval time, rights note, processing history, and outcome.
- Agents may propose classification, Claims, and drafts but may not accept a Source, change the canonical taxonomy, publish, merge, or deploy.
- Hosted AI receives only public or rights-cleared material. Store provider, model, prompt version, input provenance, output, confidence, and rationale for review.
- The preparation interface uses adapters for source retrieval, AI, clock, scheduling, and persistence; external variation stays behind those seams.

## Testing Decisions

- Test preparation through its application interface using fake retrieval and AI adapters.
- Assert idempotency, deduplication, provenance retention, confidence-based escalation, and no automatic Source acceptance or publication.
- Test a transcript submission through browser/editor coverage only at the editor-visible outcome.

## Out of Scope

- Processing secrets, private documents, personal data, or unlicensed commercial material without explicit approval.
- Autonomous taxonomy changes and automatic publishing.

## Further Notes

- A supplied YouTube transcript is a Source Submission until the editor accepts supporting Sources and Claims.
