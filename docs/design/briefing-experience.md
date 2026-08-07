# Briefing experience

## Product frame

**Subject:** the public Topic page for *How Singapore's Government Works* and
later Briefings.

**Audience:** English-speaking Singaporeans who want enough trustworthy
context to join a social or professional conversation thoughtfully.

**Single job:** give a reader an answer, the context behind it, and a useful
next question in under five minutes, while making support and freshness easy
to inspect.

The page is a guided briefing, not an official portal, newspaper front page,
or encyclopedia. It uses SGDS interaction and accessibility conventions as a
baseline, while retaining KopiContext's independent identity.

## Voice and content style

KopiContext speaks like a well-prepared friend: friendly, plain, and concise.
It respects the reader's intelligence while making it easy to get oriented.
This applies equally to navigation, buttons, forms, loading and error states,
Source/support disclosures, Current Updates, and every published Briefing.

- Prefer familiar words, active voice, and short sentences. Say what a reader
  can do and what will happen next: “View sources”, not “Citation metadata”.
- Explain an unfamiliar term where it first matters, in a short definition or
  linked key term. Do not make a reader leave the main idea to understand the
  vocabulary used to explain it.
- Be specific about uncertainty, freshness, and failure. “Reviewed 7 August
  2026” and “Sources are unavailable right now. Try again.” are clearer than
  vague assurances or apologies.
- Avoid jargon, insider shorthand, hype, and promotional superlatives. Do not
  call a Briefing “essential”, “revolutionary”, or “effortless”; demonstrate
  value through useful context.
- Avoid patronising simplification. Explain complexity in layers without
  implying that the reader cannot handle it, and never replace a precise term
  with a misleadingly simple one.
- Name public content by the glossary: Topic, Briefing, Current Update,
  Source, Claim, and Editorial Approval. If an audience-facing label needs a
  plainer phrasing, retain the underlying meaning and explain it once.

Editorial Briefings use the same standard. They state what is known, separate
durable explanation from Current Updates, attribute Claims to Sources, and
describe reasonable disagreement without theatrical balance or false
certainty. A UI state and a Briefing section each have one job: orient, explain,
or direct the reader—never merely decorate the page.

## Design thesis

The page begins with a position in a conversation: a plain-language answer to
the question behind the Topic. The rest of the page is an evidence-aware route
outward from that answer. This avoids the generic article rhythm of hero image,
headline, and uninterrupted prose, and earns the distinctive visual move:
the **conversation path**.

The aesthetic risk is to make the route itself—rather than a decorative image
or a loud colour field—the hero. A slim, calm vertical rail groups the moments
where a reader changes conversational depth: orient, understand, weigh, and
participate. Its labels describe real reading tasks and never use arbitrary
numbering.

## Token system

Use semantic tokens in code rather than raw colour values. The initial values
are deliberately restrained so source support, freshness, and interactive
focus can be unmistakable.

| Token | Value | Use |
| --- | --- | --- |
| `color-ink` | `#14232D` | Primary text, icons, strong rules |
| `color-rain` | `#2A736D` | Primary actions, active path state, links where contrast passes |
| `color-coral` | `#E46D54` | Editorial attention only: review/freshness prompts, never body text on pale surfaces without contrast verification |
| `color-kopi-foam` | `#F1E7D3` | Quiet path panels and contextual surfaces |
| `color-paper` | `#F8F6F0` | Main reading canvas |
| `color-mist` | `#D7E1DF` | Subtle separators and inactive path treatment |

`color-ink` on `color-paper` is the default reading pair. All text and
control combinations require contrast verification; colour never carries an
error, freshness, or workflow state by itself. Borders are structural, not
ornamental: use them to group a source set, separate a Current Update, or mark
the continuation of the conversation path.

### Spacing, shape, and motion

- Use a 4px base spacing unit. Prefer generous vertical rhythm around changes
  in reading task, not arbitrary card gutters.
- Corners are modest (4–8px) and reserved for interactive controls and
  contained metadata. Long-form sections remain open on the paper canvas.
- Use one persistent top rule or narrow ink edge to establish the reading
  column; avoid repeated floating-card shadows.
- Motion may acknowledge a newly selected path step or opened disclosure, but
  it must be short, opacity/transform-only, and absent under reduced-motion.
  The path communicates its order without animation.

## Typography roles

Select licensed, performant web fonts only after implementation constraints
are known. The roles matter more than a particular family; each must have a
system fallback and support the required Latin punctuation and numerals.

| Role | Character | Primary use | Guidance |
| --- | --- | --- | --- |
| Display | Compact, slightly human, editorial serif or expressive sans | Topic title and rare pull-phrase | Use sparingly; no more than one display moment before the five-minute explanation |
| Reading | Humanist serif or humanist sans with a large x-height | Answer, overview, explanation, debates | Default long-form face; 16–18px on phone, 18–20px on wide screens; line-height 1.55–1.7 |
| Utility | Clear neutral sans | Navigation, path labels, metadata, buttons, source details | Smaller but never below 14px for essential text; use tabular figures for dates and reading time |

The Topic title may be expressive, but its wording remains direct: name the
Topic and answer the reader's question. Avoid all-caps paragraphs, justified
body copy, and narrow multi-column reading text. Body measure targets roughly
45–75 characters; sources and metadata may be narrower.

## Information architecture

The following order is the public contract for Briefing Template v1. Optional
sections disappear cleanly; no empty placeholders reach a reader.

1. **Global orientation** — wordmark, topic search, and an unobtrusive route
   to topic discovery. The header is compact once a reader begins the
   Briefing.
2. **Topic proposition** — Topic label, title, one-sentence explanation,
   reading-time/depth cue, last reviewed date, and a direct link to Sources.
   This is the thesis, not promotional copy.
3. **30-second overview** — a short, self-contained orientation. It answers
   what the thing is, who is involved, and why it matters.
4. **Mental-model orientation** — required before detailed explanation when a
   Topic is fundamentally a system, institution, or process. It converts the
   overview into a reusable map: the important parts, what each does, and how
   they relate. It is a semantic HTML/CSS diagram with a text introduction,
   not custom artwork or a canvas-only illustration. For topics without this
   kind of structure, it is omitted rather than simulated.
5. **Conversation path** — anchors the reader through the five-minute
   explanation, why people care, key terms, Entities, debates, Singapore/SEA
   angle where relevant, questions to ask, and mistakes to avoid.
6. **Five-minute explanation** — the durable core, divided by meaningful
   headings. Claims expose their support without interrupting every sentence.
7. **Context sections** — why people care; key terms; relevant Entities;
   debates; and the Singapore/SEA angle when relevant. These can use compact
   definitions or relationship lists, but do not become dashboard widgets.
8. **Participate** — questions to ask and mistakes to avoid. This closes the
   loop from learning to conversation.
9. **Optional depth** — deeper background and Related Topics.
10. **Current Updates** — visually and semantically separate, dated items below
   the evergreen Briefing. Each identifies its date and relationship to the
   Topic; it must never be interleaved into the core explanation.
11. **Trust footer** — Sources, Claim-support access, reviewed/published
    dates, and a discreet way to request a Topic or report a concern.

### Mental-model pattern

Use this pattern when a reader needs to understand relationships before they
can make sense of definitions. Its job is to answer “what is the map?” before
the page asks “what does this term mean?” A model consists of four parts, used
only where they clarify the Topic:

1. **Orientation statement and visual** — one plain-language sentence followed
   by a labelled relationship diagram. The diagram has a meaningful heading,
   represents each major part as real text, and gives every connector a
   written relationship. A screen reader must receive the same model without
   interpreting layout or arrows.
2. **Part cards** — three or more peer components can appear as cards when
   their responsibilities are genuinely distinct. Every card uses the same
   order: what it does, who/what belongs to it, one familiar example, then a
   descriptive link to the deeper section. Do not make cards merely a visual
   restatement of nearby paragraphs.
3. **Role comparison** — use a labelled table for roles readers commonly
   confuse. Keep rows parallel and answer the practical distinction first.
   Tables must remain tables on wide screens; on narrow screens they may become
   labelled comparison blocks rather than forcing horizontal page scrolling.
4. **Practical flow** — show one ordinary end-to-end scenario in ordered,
   numbered prose. A connected visual may reinforce the sequence, but the
   text itself must communicate the complete flow. Use it to demonstrate how
   the parts cooperate, not to claim that every real case follows one path.

The opening of a mental-model Briefing should let a first-time reader name the
main parts, place the central entities within them, distinguish the roles most
likely to be conflated, and retell one practical example. If it cannot do
this, simplify the model before adding more detail.

## Conversation path

The conversation path is a navigation aid and reading structure, not a
progress meter. It has four named stages:

| Stage | Reader question | Anchored content |
| --- | --- | --- |
| Orient | “What is this?” | One-sentence explanation and 30-second overview |
| Understand | “How does it work?” | Five-minute explanation, key terms, Entities |
| Weigh | “Why does it matter and where do views differ?” | Why people care, debates, Singapore/SEA angle |
| Participate | “What can I say or ask?” | Questions to ask and mistakes to avoid |

On a phone, the path is a horizontal, scrollable-in-place row directly after
the overview. Each stage is an anchor link with its full accessible name; the
active stage is indicated by text, position, and visual treatment. On wider
screens it becomes a sticky left rail aligned to the reading column. It may
highlight the current section as the reader scrolls, but this enhancement must
not change navigation or reading when JavaScript is unavailable.

The rail uses `color-rain` only for the active stage and `color-mist` for the
continuation. The reader never has to complete a stage, sign in, or accept
tracking for it to work.

## Responsive composition

Design from the narrowest viewport upward. Breakpoints respond to available
space, not device names.

```text
Narrow (default)
┌──────────────────────────────┐
│ Header / search               │
│ Topic proposition             │
│ 30-second overview            │
│ Mental-model diagram          │
│ Part cards (stacked)          │
│ [Orient][Understand][Weigh] → │
│ Reading column                │
│ Current Updates (separate)    │
│ Sources / freshness           │
└──────────────────────────────┘

Wide (room for a second column)
┌──────────────────────────────────────────────────────┐
│ Header / search                                       │
│                  Topic proposition                    │
│ path rail          30-second overview                 │
│                    mental-model diagram                │
│                    part cards / role comparison        │
│ Orient             reading column                     │
│ Understand         Current Updates (separate)         │
│ Weigh              Sources / freshness                │
│ Participate                                             │
└──────────────────────────────────────────────────────┘
```

- **Narrow:** one reading column with at least 16px inline padding; no
  horizontal page scroll; touch targets at least 44×44 CSS pixels. The path
  can scroll horizontally but retains a visible affordance and keyboard access.
- **Medium:** increase the reading measure and outer whitespace before adding
  columns. Metadata may form a short supporting row, never a dense toolbar.
- **Wide:** use a three-part grid only when it leaves the body within its
  readable measure: a quiet path rail, the reading column, and optional narrow
  trust metadata. The content order in the DOM remains the reading order.
- **Large text and zoom:** at 200% browser zoom, the page returns naturally to
  a one-column flow rather than clipping the rail or controls.
- **Mental-model components:** diagrams use grid/flex layout rather than
  absolute positioning; their components stack in the explanatory DOM order.
  Visual connectors are supplementary and have text alternatives. Comparison
  tables must not require horizontal page scrolling at narrow widths.

## Component and state guidance

- **Source support:** a claim-support control says “View sources” and exposes
  the supporting Sources, title, publisher/owner, and retrieval context. It
  does not use a citation icon without a text alternative.
- **Freshness:** pair the date with plain language such as “Reviewed 7 August
  2026.” When a review is overdue, say what needs review; do not rely on a
  coral dot.
- **Current Update:** use a labelled region with the date and item title.
  It has a distinct divider and heading, not a visually louder treatment than
  the Briefing itself.
- **Search:** always show a text label or accessible label, provide useful
  empty results, and preserve the query when a reader returns from a Topic.
- **Disclosures:** default to closed only for secondary depth. Required
  Briefing sections must remain discoverable through headings and path links.
- **Errors and empty states:** state what could not load and offer the next
  useful action, for example “Sources are unavailable right now. Try again.”
  Do not use apology copy or generic “Something went wrong.”

## Accessibility acceptance checklist

- One `main` landmark, a logical heading hierarchy, descriptive page title,
  skip link, and named navigation regions.
- Every interactive element has an accessible name and visible focus; focus
  order follows the displayed reading/control order.
- Pointer interactions have keyboard equivalents. Path links, disclosures,
  search, source controls, and share/request controls work without a mouse.
- Text, icons, and controls meet contrast requirements; information is never
  encoded by colour, animation, or position alone.
- Screen readers receive useful state changes for opened source support and
  search results without excessive announcements during ordinary scrolling.
- Reduced motion honours the operating-system preference; no essential content
  is conveyed only by animation.
- Public content is readable at 200% zoom and with increased text spacing.

## Design review artefacts

Every reader-facing change supplies narrow and wide rendered states with
representative Briefing content, plus keyboard and reduced-motion evidence.
Review against this document focuses on the reader-visible hierarchy and
behaviour, not internal CSS structure. When the implementation introduces a
new reusable component, add its states (default, hover, focus, disabled,
loading, empty, and error where applicable) to the implementation review.
