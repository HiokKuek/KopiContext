# Editorial Workspace and Approval Workflow

Part of #1.

## Problem Statement

A sole editor needs to safely turn agent-prepared material into credible published Briefings without losing provenance, review control, or revision history.

## Solution

Provide an editorial workspace that manages Topics, Briefings, Current Updates, Sources, Claims, and revisions through an explicit Editorial Workflow. The editor can begin from reviewed material directly or from an agent-prepared proposal; automation is not a prerequisite for editorial work.

## User Stories

1. As an editor, I want to create and edit a Topic and its Briefing, so that the catalogue has an accountable owner.
2. As an editor, I want to review a draft against its Sources and Claims, so that I can identify unsupported statements.
3. As an editor, I want to move work to Needs verification, so that uncertain content cannot appear ready to publish.
4. As an editor, I want to approve and publish deliberately, so that publication records who acted and when.
5. As an editor, I want to reject or return a proposal with a reason, so that agents can prepare a better revision.
6. As an editor, I want to archive and restore content, so that outdated material is recoverable.
7. As an editor, I want to merge duplicate Topics, so that readers and agents share one vocabulary.
8. As an editor, I want freshness and review age shown in the workspace, so that I can prioritise maintenance.

## Implementation Decisions

- The Editorial Workflow for content is Draft → Needs verification → In editorial review → Approved → Published → Archived; a reviewer may return any pre-published item to Draft or Needs verification with a reason.
- Editorial Approval is the only transition to Published and records editor identity, time, and the approved revision.
- Civic Claims use a primary official Source where available; contested, interpretive, and current Claims require stronger corroboration.
- The editorial application interface owns state-transition invariants, revision history, and audit records.
- A Source Submission is durable provenance for supplied material, not a gate that forces an AI-preparation result before a sole editor can accept a Source or author supported Claims.
- Current Updates are separate dated records with their own evidence and approval history. They use the same state vocabulary but cannot be inserted into, or silently revise, the evergreen Briefing; see [ADR 0007](../adr/0007-current-updates-as-dated-evidence.md).

## Testing Decisions

- Test workflow transitions through the editorial application interface, including invalid transitions and audit records.
- Test publication refusal when required Template sections, accepted Sources, or Claim support are missing.
- Use browser end-to-end coverage for review, approval, publication, archive, and restore.

## Out of Scope

- Multi-editor assignment, permissions hierarchy, and automated publishing.

## Further Notes

- The sole editor is the human approval gate for all publishing.
