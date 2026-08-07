# Editorial proposal-decision workflow

**Delivery link:** [Editorial workflow](../prd/0003-editorial-workflow.md),
[Source Submission and agent processing](../prd/0004-source-submission-and-agent-processing.md),
and [editor workspace v1](../design/editor-workspace-v1.md).

## Decision

Agent preparation creates a **proposal** attached to a Source Submission. It
does not create accepted evidence, canonical taxonomy, Claims, or a Briefing
revision by implication. The editor makes a small set of explicit, auditable
decisions that turn selected proposal parts into those durable editorial
objects.

A proposal is always anchored to the exact Source Submission, preparation
output, and provenance from which it came. It remains visible after a decision
so an editor can distinguish what the agent suggested from what the editor
accepted or changed.

## Editor decisions

| Proposal part | Explicit editor action | Durable outcome | Required input |
| --- | --- | --- | --- |
| Topic/Subtopic placement | **Accept placement** | Associates the proposal with one existing canonical Topic and an optional Subtopic; it does not create either | existing Topic ID; optional Subtopic; optional note |
| Topic/Subtopic placement | **Return or reject placement** | Records that the suggestion is not to be used; the original suggestion remains intact | reason |
| Submitted material as evidence | **Accept as Source** | Creates an Accepted Source linked to the Source Submission | title, publisher, type, canonical URL, retrieval date, relation, rights note |
| Submitted material as evidence | **Reject as Source** | Records why the material is unsuitable as evidence; it remains a Source Submission | reason |
| Candidate Claim | **Accept Claim** | Creates a Claim in one selected immutable Briefing revision and connects it to one or more Accepted Sources with locators/excerpts/rationale | target revision; statement; at least one Accepted Source support; support details |
| Candidate Claim | **Reject or return Claim** | Records why the candidate is not used or needs a better proposal; it creates no Claim | reason |
| Draft proposal | **Create revision from proposal** | Creates one immutable, agent-origin Briefing revision attached to the Source Submission and its AI provenance | existing Briefing; exact proposal version/fingerprint; optional editor note |
| Draft proposal | **Create human revision** | Creates one immutable, human-origin Briefing revision, optionally based on the proposal but containing the editor's structured content | existing Briefing; complete structured content; editor note |
| Any proposal part | **Request re-preparation** | Keeps the existing proposal and queues a new attempt with a reason and a new idempotency key | reason; bounded retry policy handles execution |

An action may be offered only when the required record exists. In particular,
a candidate Claim cannot be accepted until its target revision exists and each
chosen supporting Source is already accepted. A Source Submission never
supports a Claim directly.

### Taxonomy boundary

The first slice accepts placement only into an existing Topic. It may retain an
agent-proposed Subtopic as a pending label, but the editor explicitly confirms
it before it becomes part of a Briefing's navigable structure. Creating a
Topic, changing the canonical taxonomy, or merging Topics remains a separate
editorial command, not a side effect of accepting a proposal.

## Sequence and invariants

The normal path is deliberately ordered so evidence is established before
publication eligibility is evaluated:

```text
Source Submission
  → preparation outcome + immutable proposal/provenance
  → editor accepts or rejects placement and evidence
  → editor creates a revision from the proposal or writes a human revision
  → editor accepts/rejects candidate Claims into that revision and adds supports
  → Editorial Workflow review → Editorial Approval → Published
```

The following rules are non-negotiable:

1. **Proposal is advisory.** Neither worker completion nor a high confidence
   score may create an Accepted Source, Claim, Topic, Briefing revision, or
   publication.
2. **Evidence precedes support.** Every accepted Claim has at least one
   Accepted Source support. A Source Submission, its excerpt, or agent output
   cannot substitute for that Source.
3. **Revisions are immutable.** Editing a draft creates a new revision; it
   does not update the proposal or a prior revision in place.
4. **Every command is optimistic.** Each decision supplies the Source
   Submission's preparation/output version, and revision-targeted commands
   supply the expected revision. A stale command is rejected without a partial
   decision.
5. **Every decision is attributable.** The server derives the actor from the
   authenticated editor session. Browser input cannot select the actor or
   decision time.
6. **Every decision is append-only.** A decision records the proposal part,
   prior value where relevant, chosen outcome, reason/note, actor, time, and
   references to the Submission, Source, Claim, or revision created. Rejection
   and return need a reason.
7. **Publication remains separate.** Proposal decisions make a revision
   reviewable; only the existing Editorial Workflow can approve and publish it.

### Published revision safety

The current schema stores one workflow status on `briefings` and identifies a
reader-visible revision through the latest publication audit. That is adequate
for the first unpublished Briefing, but not for routine edits to a published
Briefing: setting the aggregate back to Draft would make the existing public
revision disappear.

Before enabling proposal-to-revision work on a published Briefing, introduce a
separate working-revision lifecycle. At minimum, persist both:

- the currently published revision (which remains reader-visible), and
- the current working revision and its Editorial Workflow state.

A new working revision starts in Draft while the previously published revision
stays visible. Publication atomically promotes the approved working revision;
archive changes public visibility only when deliberately requested. This is an
additive persistence migration and application-model change, not a UI
workaround.

## Audit model required

`editorial_audit_records` correctly records Briefing state transitions, but it
cannot record a decision that concerns only a Source Submission, classification,
Source, or candidate Claim. Add an append-only proposal-decision record before
exposing these commands. Its minimum shape is:

```text
id
source_submission_id
proposal_output_fingerprint
proposal_part: classification | source | candidate-claim | draft
proposal_item_key                 # stable claim key/index plus content fingerprint
decision: accepted | rejected | returned | reprepare-requested | revision-created
actor_id
occurred_at
reason_or_note
result_type/result_id             # Topic placement, Accepted Source, Claim, or revision
metadata                          # selected supports, original suggested values, policy version
```

The creation of an Accepted Source, Claim/support, or revision and its
proposal-decision record happens in one transaction. A retry with the same
command idempotency key returns the original result rather than creating a
second Source, Claim, or revision.

## First vertical slice

Prove one prepared transcript can become a reviewable update to an **existing,
unpublished** civic Briefing. The editor can:

1. open a prepared Source Submission and inspect its provenance, risks,
   classification, candidate Claims, and draft;
2. accept its placement into the existing civic Topic or return it with a
   reason;
3. accept one Source with complete metadata and rights note;
4. create one agent-origin revision from the exact prepared draft;
5. accept at least one candidate Claim into that revision and link it to the
   Accepted Source with its excerpt/locator;
6. use the existing transition commands to move that revision through review,
   approval, and publication; and
7. see the proposal decisions and workflow audit together in the editor.

This slice deliberately excludes Topic creation/merge, batch approval,
multi-submission synthesis, editor-authored rich editing, and revising a
currently published Briefing. It exercises all trust boundaries without
pretending that a proposal is editorial truth.

## Application contracts

Keep these transport-neutral commands behind the private application API. The
Next.js BFF supplies trusted editor identity and never exposes service
credentials to the browser.

| Command | Essential request | Result |
| --- | --- | --- |
| `decideProposalClassification` | submission ID, expected output fingerprint, existing Topic ID, optional Subtopic, decision/note | recorded placement decision |
| `acceptSourceFromSubmission` | submission ID, expected output fingerprint, complete source metadata, command key | Accepted Source and decision record |
| `decideCandidateClaim` | submission ID, proposal-item key/fingerprint, expected revision, accept/reject/return, source supports or reason | Claim/supports or decision record |
| `createRevisionFromProposal` | submission ID, expected output fingerprint, existing Briefing ID, command key | immutable agent revision and decision record |
| `createHumanRevision` | optional submission ID, existing Briefing ID, structured content, command key | immutable human revision and decision record |
| `requestRepreparation` | submission ID, expected output fingerprint, reason, command key | queued retry request and decision record |

Each command returns the authoritative object summary, relevant decision
record, and a conflict/not-found/validation result that the BFF can render
without guessing success. Workflow transition remains
`transitionBriefing`; it must target the current working revision once the
published-revision safety change is delivered.

## Read models and UI dependencies

Add one editor-only `getSourceSubmissionProposal(submissionId)` read model
before building its page. It returns the submission, preparation history,
provenance, duplicate/failure state, proposal output fingerprint, risks,
classification, candidate Claims, draft, prior decisions, and links to any
created Sources or revisions. It intentionally does not expose private raw
material, provider credentials, or prompts.

The source-proposal page needs only four focused areas:

1. **Provenance and status** — what entered, rights note, retrieval and
   preparation history, duplicate/failure/escalation state.
2. **Suggestions** — placement, candidate Claims with excerpts/confidence, and
   draft, each visibly labelled as agent-prepared.
3. **Evidence and revision decisions** — explicit controls with required
   metadata/reasons and an authoritative availability state.
4. **Decision record** — reverse-chronological proposal decisions alongside
   linked Editorial Workflow audit events.

The existing Briefing review read model must gain a distinction between the
published and working revision before editors can revise published content.
The public reader contract remains unchanged: it reads only the published
revision.

## Verification

Application tests must prove that preparation alone creates no accepted
objects; a rejected proposal leaves its output intact; a stale proposal or
revision command changes nothing; and command retries do not duplicate durable
objects. Persistence integration tests must verify transactionality of each
accepted decision and that the published revision remains visible while a new
working revision is Draft. Browser coverage then proves a transcript journey
from prepared proposal to deliberate publication, including an explicit reject
path and keyboard use on narrow and wide layouts.
