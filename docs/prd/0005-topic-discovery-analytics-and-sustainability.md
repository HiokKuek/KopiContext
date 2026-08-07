# Topic Discovery, Analytics, and Operational Sustainability

Part of #1.

## Problem Statement

KopiContext needs a disciplined way to decide what to explain next and maintain published material without assuming a large editorial team or collecting unnecessary personal data.

## Solution

Use first-party anonymous analytics, Topic requests, failed searches, source opportunities, freshness signals, and editorial judgement to maintain a transparent discovery queue and an initial 25-Topic catalogue.

## User Stories

1. As a reader, I want relevant search results for names, questions, and spelling variations, so that I can find a Topic quickly.
2. As a reader, I want to request an unavailable Topic, so that my need is visible to the editor.
3. As an editor, I want failed searches and requests grouped into candidate Topics, so that demand is actionable.
4. As an editor, I want popularity and conversation-value explanations, so that recommendations are not opaque.
5. As an editor, I want freshness and review-age signals, so that published Briefings are maintained deliberately.
6. As a product owner, I want pseudonymous event data for reading and discovery behaviour, so that I can improve usefulness without profiling people.
7. As a product owner, I want no raw-IP retention and a privacy notice, so that anonymous analytics has a clear limit.
8. As an operator, I want Topic priorities to feed the editorial queue rather than automatically publish content, so that demand remains subject to judgement.

## Implementation Decisions

- Record rotating pseudonymous sessions and the approved first-party events: page view, search, result click, no-result search, Topic view, section expansion, Current Update open, related Topic click, share, Topic request, and feedback.
- Topic priority combines popularity, conversation value, freshness, and editorial judgement; its explanation is visible in the editorial workspace.
- The launch catalogue is editable and seeds discovery rather than freezing the taxonomy.

## Testing Decisions

- Test discovery and analytics through the application API with a fake clock and analytics-delivery adapter.
- Assert query normalisation, event validation, no-result capture, priority explanation, and the absence of raw-IP persistence.
- Use browser coverage for search, no-result Topic request, and share flows.

## Out of Scope

- Advertising targeting, behavioural profiles, accounts, personalisation, and monetisation decisions.

## Further Notes

- Initial catalogue: How Singapore's Government Works; Parliament and Elections; HDB and public housing; CPF; public transport; COE and road pricing; generative AI; semiconductors; cybersecurity; data centres; digital government; Singapore's economy; trade and the port; startups and venture capital; ASEAN; the Green Plan and climate adaptation; hawker culture; Singapore's multicultural festivals; local arts; Formula 1 Singapore; football in Singapore; regional geopolitics as durable background; global supply chains; energy transition; and ageing in Singapore.
