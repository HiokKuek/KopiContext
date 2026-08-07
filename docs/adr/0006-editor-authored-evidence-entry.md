# Permit editor-authored evidence entry without agent preparation

The Editorial Workflow must permit the sole editor to create a Draft Topic and
Briefing, accept a reviewed Source, and record an editor-authored Claim with
support from one or more Accepted Sources. This path does not require a
Source Submission to have been processed by an AI worker.

## Context

The worker is intentionally fail-closed until a reviewed, rights-aware
retrieval/AI adapter is deployed. Requiring a prepared worker proposal before
the editor can begin a Briefing would make the controlled launch depend on an
optional automation provider and prevents the editor from using primary
official material directly.

## Decision

Introduce one editor-authored evidence path alongside—not in place of—the
existing agent-prepared proposal path.

- A Source Submission remains the durable provenance record for material the
  editor supplied, but the editor may explicitly accept it as a Source without
  waiting for a worker result.
- An editor may create a Draft Topic and a human-origin Briefing revision.
- An editor-authored Claim is bound to the current human revision and has one
  or more direct or contextual Supports to Accepted Sources.
- The same publication invariant applies to every Claim: it must have accepted
  Source support before a Briefing can be Published.
- Agent-generated Candidate Claims retain their proposal fingerprint and
  acceptance records. They do not gain authority from the manual path.

## Consequences

The first Briefing can be reviewed and published while the worker remains
disabled. The product still has one evidence vocabulary—Source, Claim, and
Support—rather than a special “manual article” format. The UI must make the
origin of a Claim clear to the editor, while readers see only the published
Briefing and its Sources.
