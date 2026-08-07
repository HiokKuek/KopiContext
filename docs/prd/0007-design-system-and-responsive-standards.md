# Design System and Responsive Standards

Part of #1.

## Problem Statement

KopiContext needs a consistent, distinctive interface that feels credible on a phone and laptop without resembling a generic newsroom or an official government site.

## Solution

Create a small KopiContext design system that adopts SGDS accessibility and interaction patterns while using independent visual tokens and editorial components built around the conversation path.

## User Stories

1. As a reader, I want familiar, readable navigation and forms, so that I can focus on the Topic.
2. As a reader, I want a coherent experience on phone and laptop, so that layout adapts without losing meaning.
3. As a reader, I want visible keyboard focus and reduced motion, so that the site remains operable and calm.
4. As an editor, I want consistent controls and content states, so that review work is efficient and errors are clear.
5. As a developer, I want reusable tokens and components, so that new screens stay visually coherent.
6. As a product owner, I want a recognisable editorial identity, so that the product is trusted without imitating a government service.

## Implementation Decisions

- Use SGDS as an accessibility and interaction reference, not as KopiContext's visual identity.
- Initial tokens: ink blue-black `#14232D`, tropical rain `#2A736D`, signal coral `#E46D54`, kopi foam `#F1E7D3`, and pale paper `#F8F6F0`.
- Use a characterful display face sparingly, a humanist reading face for long-form Briefings, and a utility sans for metadata and controls.
- The signature component is the conversation path: a restrained vertical progression from the answer through context, disagreement, and questions to ask.
- Mobile-first layout, readable line lengths, semantic headings, keyboard focus, and reduced-motion support are non-negotiable quality gates.

## Testing Decisions

- Test the public and editorial interfaces at mobile and desktop viewports, keyboard-only navigation, and reduced-motion settings.
- Use visual review against the token and component contract; assertions test accessible names, landmarks, focus order, and reader-visible content rather than CSS internals.

## Out of Scope

- A comprehensive public component library, decorative animation systems, and a government-branded visual identity.

## Further Notes

- The Topic page has one job: give a Singaporean enough trustworthy context to join a conversation thoughtfully.
