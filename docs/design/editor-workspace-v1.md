# Editor workspace v1

**Delivery link:** [Editorial workspace and approval workflow](../prd/0003-editorial-workflow.md), [source submission and agent processing](../prd/0004-source-submission-and-agent-processing.md), and roadmap milestones 3–4.

## Purpose and boundary

The editor workspace is the private, single-editor surface that turns a
reviewable Briefing into a deliberately published one. Its job is not to be a
general CMS. It should help the editor answer, in order:

1. What needs my judgement now?
2. Is this revision complete and supported?
3. What will this specific action change?
4. Can I later show why it was published?

The first journey focuses on the civic Briefing. It must work with a keyboard,
on a narrow screen, and without direct browser access to the private API or
database. The existing public reader page remains anonymous and unchanged.

## Required authentication decision

An authentication provider has deliberately **not** been selected. Before
implementation, the product owner must choose one that can meet this contract:

- The editor reaches `/editor` only through a server-verified authenticated
  session. There is one configured editor identity in v1; multi-editor roles
  are out of scope.
- Next.js server code derives the editor's immutable actor ID from that session
  and calls the private API with its server-only service credential. A browser
  never receives the private credential or calls the private API directly.
- The browser must not choose the `actorId` that appears in an audit record.
  The current private transition request carries `actorId`; the BFF/API
  composition must replace or verify that field from the trusted session before
  the editor route is exposed.
- Expired, missing, or unauthorised sessions lead to a plain sign-in/denied
  state. They never render editorial data, even briefly.

This is an implementation dependency, not a reason to pick a provider now.
The workspace can be designed and its application read models can be built
behind provider-neutral `requireEditorSession()` and `EditorIdentity` ports.

## Smallest useful journey

```text
Sign in
  → Review queue
  → Briefing review
  → Confirm a workflow action
  → Updated state + audit record
  → Preview the published reader page
```

Source Submission is a companion entry point, not a hidden part of the
Briefing form:

```text
New Source Submission → preparation outcome → proposal review → Briefing review
```

A transcript, URL, or document stays a **Source Submission** until the editor
accepts supporting Sources and Claims. Agent output may suggest placement and
draft content, but never pre-selects approval or publication.

## Routes and page contracts

All `/editor/*` routes are server-rendered private routes. They use the same
ink, rain, kopi-foam, paper, and mist tokens as the reader experience, but
exchange the reader's conversation path for a compact **review path**:
`Queue → Evidence → Decision → Record`. It describes the work at hand; it is
not a progress score.

| Route | Primary job | Minimum information | Primary actions |
| --- | --- | --- | --- |
| `/editor` | orient the editor to current work | counts by Editorial Workflow state; a short ordered queue; stale published Briefings; preparation failures/escalations | Open a Briefing; submit material; filter to a state |
| `/editor/briefings/:briefingId` | decide whether one revision can move forward | state, title/Topic, revision ID and time, Template completeness, draft sections, Claims with support, accepted Sources, freshness/review age, audit timeline | Return, move to Needs verification, start review, approve, publish, archive, restore; open reader preview |
| `/editor/briefings/:briefingId/preview` | inspect exactly what readers would receive | the selected published revision using the public Briefing presentation; publication/review metadata | Return to review; open public URL in a new tab only after Published |
| `/editor/source-submissions/new` | record material for preparation | kind (URL/document/transcript), original identifier, rights note, editor identity and submitted time shown as generated metadata | Submit for preparation; cancel |
| `/editor/source-submissions/:submissionId` | review a prepared proposal without treating it as truth | processing outcome/history, provenance, duplicate signal, proposed Topic/Subtopic plus rationale/confidence, candidate Claims/excerpts, draft proposal, escalation | Open linked Briefing review; return/reject proposal; create or attach a draft only through a later explicit command |

The public site has no editor navigation. The editor shell has a clear
“KopiContext editor” label, a link back to the review queue, and an accessible
sign-out control supplied by the selected session adapter.

## Briefing review layout

The review page uses one primary reading column and a compact decision panel;
it must not turn evidence into a spreadsheet. On wide screens the decision
panel is sticky beside the reading column. On narrow screens it follows the
revision summary and precedes the detailed content, so the next action is not
lost below a long draft.

```text
Narrow
┌─────────────────────────────┐
│ Back to queue · Briefing     │
│ Topic / title / state        │
│ Revision summary             │
│ Decision panel               │
│ Template sections            │
│ Claims and supporting Sources│
│ Source details               │
│ Audit record                 │
└─────────────────────────────┘

Wide
┌──────────────────────────────────────────────────┐
│ Back to queue · Briefing                           │
│ Review path: Queue / Evidence / Decision / Record │
│                                                    │
│ reading column                     decision panel │
│ revision + required sections       state / action │
│ claims + support                   consequences   │
│ source provenance                  audit details  │
└──────────────────────────────────────────────────┘
```

### Review sections

1. **Revision summary** — Topic, Briefing title, current state, revision
   sequence/ID, authoring/preparation provenance, last changed time, and a
   plainly worded freshness signal. State is always text plus a restrained
   token; colour alone is never meaningful.
2. **Completeness** — every required Briefing Template section shown as
   complete, missing, or needing verification. A missing section links to the
   exact draft section. “Ready to publish” appears only when the authoritative
   workflow/evidence evaluation says it is ready.
3. **Draft and Claims** — the revision in its reader order. Each factual Claim
   has a support state and expands to its supporting accepted Sources. An
   unsupported Claim states what is missing rather than merely showing a red
   indicator.
4. **Sources** — title, publisher/owner, type, URL or identifier, publication
   and retrieval dates, rights note, relationship to Claims, and whether the
   editor has accepted it. A Source Submission's original provenance remains
   visible but is visually labelled as a submission, not a Source.
5. **Decision panel** — the current state, allowed next actions only, and a
   short consequence for each. It never offers a direct “publish” shortcut
   from Draft or Needs verification.
6. **Audit record** — reverse-chronological, immutable events: prior and next
   state, actor, time, revision, and reason where one was required. The audit
   record is evidence, not editable page copy.

## Actions and states

Workflow actions call server-side BFF handlers, which call the private
application API. The UI only offers transitions allowed for the loaded
revision; the API remains the authority and may still reject a stale request.

| Editor action | UI behaviour | Required input | Success result | Failure/result state |
| --- | --- | --- | --- | --- |
| Move to Needs verification | opens compact confirmation | reason | state badge and audit update | explain unsupported/missing evidence or stale revision; retain draft view |
| Start editorial review | immediate confirmation when allowed | none | state and audit update | show API rejection in context |
| Return to Draft | opens compact confirmation | reason | state and audit update | retain entered reason if the request fails |
| Approve | confirmation names revision and evidence readiness | optional review note if policy later needs it | approved state and audit update | explain why approval is unavailable; never imply it succeeded |
| Publish | strong confirmation: title, exact revision, public URL consequence | explicit “Publish” confirmation | Published state, audit record, and preview link | if conflict/rejection, reload authoritative state and announce the change |
| Archive / restore | confirmation describes public visibility effect | archive reason; restore reason if policy requires | state and audit update | retain reason and show a specific error |
| Submit material | validates client-friendly fields before server submit | kind, identifier, rights note | acknowledgement with submission ID and processing state | preserve fields; identify the invalid field or safe retry action |

Every command has pending, success, rejected, conflict, and unavailable
states. Disable only the submitted control while pending; keep navigation and
the evidence readable. Announce results in a named live region, move focus to
the inline error/confirmation heading as appropriate, and do not rely on a
toast alone. Destructive-looking actions such as Archive require confirmation;
no modal is needed for normal state changes if the confirmation can live
inline and preserve keyboard context.

## Read models and command gaps

The current private API already has authenticated command routes for a
Briefing transition and Source Submission preparation. It intentionally does
not yet expose the read/query contracts the workspace needs. Build these as
editor-only application query ports before rendering the routes:

| Needed query/command | Data returned or accepted | Current status |
| --- | --- | --- |
| `listEditorialWork` | Briefing ID/title/Topic, state, revision time, review age, completeness summary, escalation/staleness flags | needed |
| `getEditorialBriefing` | revision, Template section states, Claims/support, accepted Sources, Source Submission provenance, freshness, audit records, allowed actions | needed |
| `getEditorialPreview` | selected revision rendered through the same public presentation contract | needed |
| `transitionBriefing` | existing transition command; trusted actor identity, state/audit response | exists; must be session-composed before UI exposure |
| `createSourceSubmission` | existing idempotent preparation command; generated submission metadata and outcome | exists; needs server form/BFF composition |
| proposal decisions and content editing | explicit accept/reject/return semantics for proposed placement, Claims, Sources, and structured revision edits | needed; do not fake these as client-only switches |
| Topic creation/merge and Current Update management | explicit editorial command/read interfaces | later within the broader PRD, not required to prove the first civic review journey |

The API should return **allowed actions** or enough authoritative state for a
single shared server-side policy to derive them. The browser must never infer
publication eligibility solely from display fields. Commands should carry the
revision ID/expected version to make stale-review conflicts explicit.

## Acceptance criteria for the first build

1. An unauthenticated request to any `/editor/*` route cannot read workspace
   data and reaches the selected provider's sign-in/denied flow.
2. The configured sole editor can open the civic Briefing from a queue and see
   its exact revision, Template completeness, Claim-to-Source support, rights
   notes, freshness/review age, and audit history without database access.
3. The UI displays only valid next workflow actions. An attempted stale or
   invalid transition is clearly rejected and never represented as successful.
4. Publishing requires a separate, explicit confirmation and produces an
   audit record with the trusted session identity, revision, and time.
5. After publication, preview and the anonymous public route show the same
   published revision; archive/restore changes public visibility only through
   the approved workflow.
6. A transcript Source Submission records identifier, rights note, submitter,
   timestamp, and preparation outcome. Proposed taxonomy, Claims, and draft
   are clearly suggestions pending explicit editorial decisions.
7. Browser coverage exercises sign-in protection, review → approval →
   publication → public visibility, archive/restore, and transcript submission
   through an editor-visible outcome at narrow and wide viewports with
   keyboard-only interaction.

## Deliberate non-goals

No multi-editor assignments, role hierarchy, browser-to-private-API access,
automatic publishing, autonomous taxonomy changes, or generic WYSIWYG editor
belong in v1. A queue is a prioritised list with explanations, not a real-time
operations console.
