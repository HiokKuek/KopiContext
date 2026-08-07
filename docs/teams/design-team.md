# Design team

## Mission

The design team makes KopiContext feel calm, credible, and useful on a phone
or laptop. It owns the reader's ability to understand a Topic, judge the
freshness and support of a Briefing, and act on the conversation path without
mistaking KopiContext for an official government service or a news feed.

The team works from [Briefing Template and Reader Experience](../prd/0002-briefing-template-and-reader-experience.md),
[Design System and Responsive Standards](../prd/0007-design-system-and-responsive-standards.md),
and [Briefing experience](../design/briefing-experience.md). Product terms
retain their meanings in [CONTEXT.md](../../CONTEXT.md).

## Ownership

The design lead owns:

- the visual language: tokens, typography roles, iconography, spacing, and
  motion principles;
- the public reader information architecture, responsive composition, and
  component states;
- the editorial workspace interaction patterns, once its product flow is
  specified;
- accessibility design requirements, including keyboard, focus, contrast,
  semantic structure, touch targets, and reduced motion;
- visual and interaction review of changes that affect a reader or editor.

Engineering owns implementation details and automated accessibility checks.
The editor owns the correctness, tone, and publication of Briefing content.
Neither agents nor the design team can grant Editorial Approval.

## Working agreement

1. Start with the reader's job, a real Topic, and the relevant PRD. Do not
   begin from a generic page pattern.
2. Treat the Briefing Template as information architecture, not merely page
   decoration. Preserve the visible separation between a Briefing and a
   Current Update.
3. Extend an existing token or component before introducing a new one. A new
   token, type role, breakpoint, or interaction pattern needs a documented
   reason in the design specification or an ADR when it changes a durable
   system boundary.
4. Design mobile first. Desktop may add orientation and room for comparison;
   it must not conceal, duplicate, or reorder meaning in a way that makes the
   mobile experience second-class.
5. Make one intentional signature move and keep the rest disciplined. For
   KopiContext, that move is the conversation path; decorative local motifs,
   gradients, or motion do not substitute for useful structure.
6. Use real or representative long-form content in review. Placeholder copy
   cannot prove readable line lengths, hierarchy, wrapping, or source density.

## Review gates

### Before implementation

- The owner identifies the reader or editor job, target route/state, and PRD
  acceptance criteria.
- The proposal names the components and tokens it uses, its narrow and wide
  layout behaviour, empty/loading/error states where relevant, and the
  accessible name and keyboard behaviour of each new control.
- A design lead review is required for new visual tokens, type roles,
  navigation patterns, major responsive composition changes, or changes to the
  conversation path.

### Before merge

- The implementation matches the documented information hierarchy at a narrow
  phone viewport and a wide laptop viewport.
- Keyboard-only use reaches every control in a logical order, has a visible
  focus indicator, and does not trap focus.
- Colour is not the only way to communicate state; contrast and readable type
  meet the applicable accessibility standard.
- `prefers-reduced-motion: reduce` removes nonessential movement without
  removing information or control.
- Briefing, Current Update, Sources, and freshness information remain
  distinguishable in both layout modes.
- The visual reviewer checks a rendered screen with representative content;
  automated tests cover reader-visible behaviour and accessibility semantics.

### Before release

- A final content-density review confirms the first public Briefing is calm at
  five-minute reading depth, not a wall of text or an oversized marketing
  landing page.
- The privacy notice and analytics consent behaviour, if any, use plain
  language and do not obstruct reading.
- The design lead records any accepted deviations from this specification as a
  follow-up rather than leaving silent inconsistencies.

## Decision authority and escalation

The design lead may approve implementation choices that follow this document.
Escalate to the product owner when a choice changes the Briefing Template,
changes what content is shown to readers, weakens an accessibility quality
gate, introduces a third-party design system dependency, or materially changes
the editorial workflow. Escalate to the editor when presentation could imply a
Claim is better supported or fresher than it is.
