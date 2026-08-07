# Briefing Template and Reader Experience

Part of #1.

## Problem Statement

Readers need a consistent, mobile-first way to gain conversational confidence without confusing evergreen explanation with Current Updates.

## Solution

Publish Briefing Template v1 and a responsive public Topic experience. Each published Briefing uses the same evidence-aware structure, progressive disclosure, and a distinct “conversation path” that leads from a concise answer to useful questions.

## User Stories

1. As a reader, I want a one-sentence answer, so that I can orient myself immediately.
2. As a reader, I want a 30-second overview and five-minute Briefing, so that I can choose my depth.
3. As a reader, I want why people care, key terms, Entities, debates, and a Singapore/SEA angle, so that I understand the social context.
4. As a reader, I want questions to ask and mistakes to avoid, so that I can participate thoughtfully.
5. As a reader, I want Current Updates visibly separate from evergreen content, so that I can judge freshness correctly.
6. As a reader, I want Sources, Claim support, and freshness metadata, so that I can assess trust.
7. As a reader using a phone, keyboard, or screen reader, I want the same readable and operable experience, so that the product works in my context.
8. As an editor, I want required and optional Template sections validated before publication, so that every Briefing is complete without becoming formulaic.

## Implementation Decisions

- Briefing Template v1 requires: one-sentence explanation; 30-second overview; five-minute explanation; why people care; key terms; relevant Entities; debates; Singapore/SEA angle when relevant; questions to ask; mistakes to avoid; Sources; and freshness information.
- Deeper background, Related Topics, and Current Updates are optional sections, with Current Updates always rendered separately.
- The public Topic interface is the primary reader seam and presents a calm conversation path rather than a generic article page.
- Adopt SGDS accessibility and interaction patterns, with independent KopiContext editorial tokens and responsive components.

## Testing Decisions

- Test the public Topic interface with a published Briefing fixture and assert visible sections, depth navigation, source/freshness disclosure, and clear separation of Current Updates.
- Run browser coverage at narrow mobile and desktop widths, keyboard navigation, and reduced-motion preferences.
- Test Template validation through the application API, not through editor form internals.

## Out of Scope

- Accounts, cross-device saves, comments, and personalised reading paths.
- Current political analysis and live-news presentation.

## Further Notes

- The initial published Briefing is **How Singapore's Government Works**.
