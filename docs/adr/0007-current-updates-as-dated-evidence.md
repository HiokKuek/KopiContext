# Keep Current Updates separate, dated, and independently approved

## Context

KopiContext needs to explain durable subjects without making a reader mistake
an old fact for a current development. A Briefing revision is the evergreen
map. A Current Update is a time-bound supplement to that map. Treating an
update as another paragraph in a Briefing would make both freshness and
editorial accountability unclear.

## Decision

Model a Current Update as its own editorial record associated with one Topic
and, where applicable, its Briefing. It has a concise title and body, an
effective date, one or more Accepted Sources, and its own status, approval,
and publication timestamps.

- A Current Update uses the same human approval boundary as a Briefing: Draft
  → Needs verification → In editorial review → Approved → Published →
  Archived. An agent may propose an update but cannot accept evidence or move
  it through a state transition.
- Publishing requires at least one Accepted Source and a stated effective date
  (the date of the development, publication, or update). The reader sees both
  date and Sources alongside the update.
- Published updates are immutable. Corrections, supersessions, and removals
  create an auditable successor or archive record rather than silently
  rewriting reader-visible history.
- The public Topic page renders Published Current Updates after the evergreen
  Briefing, in reverse effective-date order. They do not alter the Briefing's
  review date or appear inside its five-minute explanation.
- Initial scope is concise explanatory context around a published Topic, not
  a breaking-news feed, live political coverage, or a replacement for official
  alerts. A scheduler may create review proposals from freshness signals later;
  it does not publish updates autonomously.

## Consequences

Readers can tell what is durable from what has changed, and can inspect the
support and date for each changing item. The editor has a small, repeatable
review flow rather than a special case that weakens publication invariants.
The separate record gives future agent jobs a bounded, reviewable target while
keeping recurring or time-sensitive work out of the evergreen template.
