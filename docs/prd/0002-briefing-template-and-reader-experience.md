# Briefing Template and Reader Experience

Part of #1.

## Problem Statement

Readers need a consistent, mobile-first way to gain conversational confidence without confusing evergreen explanation with Current Updates.

## Solution

Publish Briefing Template v1 and a responsive public Topic experience. Each published Briefing uses the same evidence-aware structure, progressive disclosure, and a distinct “conversation path” that leads from a concise answer to useful questions.

## User Stories

1. As a reader, I want a one-sentence answer, so that I can orient myself immediately.
2. As a reader, I want a 30-second overview and five-minute Briefing, so that I can choose my depth.
3. As a first-time reader of a system or institution, I want a simple map before detailed terms, so that I understand how the important parts fit together.
4. As a reader, I want a visual orientation model that works on my phone and with assistive technology, so that I can remember the structure without needing a separate tutorial.
5. As a reader, I want comparable roles presented side by side when their differences matter, so that I do not confuse responsibilities that have similar names or public visibility.
6. As a reader, I want a practical example of a process moving through a system, so that I can connect the explanation to ordinary life.
7. As a reader, I want why people care, key terms, Entities, debates, and a Singapore/SEA angle, so that I understand the social context.
8. As a reader, I want questions to ask and mistakes to avoid, so that I can participate thoughtfully.
9. As a reader, I want Current Updates visibly separate from evergreen content, so that I can judge freshness correctly.
10. As a reader, I want Sources, Claim support, and freshness metadata, so that I can assess trust.
11. As a reader using a phone, keyboard, or screen reader, I want the same readable and operable experience, so that the product works in my context.
12. As an editor, I want required and optional Template sections validated before publication, so that every Briefing is complete without becoming formulaic.

## Implementation Decisions

- Briefing Template v1 requires: one-sentence explanation; 30-second overview; five-minute explanation; why people care; key terms; relevant Entities; debates; Singapore/SEA angle when relevant; questions to ask; mistakes to avoid; Sources; and freshness information.
- Deeper background, Related Topics, and Current Updates are optional sections, with Current Updates always rendered separately.
- A Briefing about a system, institution, or process must introduce its reusable mental model before detailed terminology. The model pairs a plain-language overview with a concise, semantic orientation visual that shows the principal parts, each part's job, and their relationship.
- When a mental model contains distinct branches or components, render them as visually distinct, equally legible cards. Each card states what that part does, who or what belongs to it, a familiar example, and a route to its fuller explanation.
- Role comparison and practical flow-example sections are required when readers need to distinguish adjacent roles or understand how a decision, policy, service, or other real-world outcome moves through the model. They are omitted when they would add artificial structure rather than clarity.
- The orientation visual, cards, comparison, and flow are content components—not decorative graphics. They use text equivalents, preserve their meaning in DOM order, stack without loss on narrow screens, and remain understandable without JavaScript.
- First-reader success is the acceptance bar for a mental-model Briefing: after its opening section, a reader can name the model's main parts, assign the central entities to the right part, distinguish easily confused roles, and describe one end-to-end example in plain language.
- The public Topic interface is the primary reader seam and presents a calm conversation path rather than a generic article page.
- Adopt SGDS accessibility and interaction patterns, with independent KopiContext editorial tokens and responsive components.

## Testing Decisions

- Test the public Topic interface with a published Briefing fixture and assert visible sections, depth navigation, source/freshness disclosure, and clear separation of Current Updates.
- For a mental-model Briefing fixture, assert that the orientation model precedes detailed explanation; cards retain their labels and destinations in narrow and wide layouts; comparisons expose matching role labels and responsibilities; and the practical flow retains its ordered meaning without CSS or JavaScript enhancements.
- Run browser coverage at narrow mobile and desktop widths, keyboard navigation, and reduced-motion preferences.
- Test Template validation through the application API, not through editor form internals.

## Out of Scope

- Accounts, cross-device saves, comments, and personalised reading paths.
- Current political analysis and live-news presentation.

## Further Notes

- The initial published Briefing is **How Singapore's Government Works**.
