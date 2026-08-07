# KopiContext — Project Requirements

## 1. Product summary

KopiContext is a Singapore-focused website that helps digitally literate users quickly understand topics people are discussing so they can participate in thoughtful conversations.

The product is not intended to replace a news site, encyclopedia, or search engine. Its core output is a structured conversation brief: enough accurate context to understand a topic, ask sensible questions, and decide whether to explore further.

## 2. Product principles

- Optimise for conversational confidence, not encyclopedic completeness.
- Separate stable background knowledge from changing current updates.
- Prefer accurate, source-backed synthesis over maximum publishing speed.
- Make Singapore and Southeast Asian relevance visible where appropriate.
- Clearly distinguish fact, analysis, opinion, and public reaction.
- Use AI to assist research and drafting, with editorial controls before publication.
- Design for genuine curiosity, not pretending to be an expert.

## 3. Target users

### Primary user

Digitally literate Singaporean adults who encounter unfamiliar topics in social, professional, or networking conversations and want a fast briefing.

Typical situations:

- Preparing for a coffee chat
- Meeting someone with a specialised interest
- Understanding a topic appearing repeatedly in the news or social media
- Following a major event without reading many long articles
- Learning enough to ask better questions

### Secondary users

- Curious general readers
- Students and early-career professionals
- Editors and researchers who maintain topic content

## 4. Goals

### MVP goals

- Help a new user understand a topic in under five minutes.
- Provide trustworthy, cited, and recently reviewed context.
- Cover an initial set of evergreen and currently popular topics.
- Detect demand for topics relevant to Singapore users.
- Give users useful conversation prompts, not just factual summaries.
- Measure whether users find, read, save, and share useful briefs.

### Non-goals for MVP

- Becoming a breaking-news publisher
- Fully automated publishing of current events
- Covering every topic or language market
- Replacing professional financial, medical, legal, or political advice
- Building a social network or user discussion forum
- Producing exhaustive live sports statistics

## 5. Core product experience

### Homepage

The homepage should provide:

- Search input: “What do you want to understand?”
- Popular now topics
- Singapore-relevant topics
- Upcoming events
- Recently updated briefs
- Topic request form

### Topic page

Every published topic should use a consistent structure:

1. One-sentence explanation
2. 60-second briefing
3. Why people care
4. Key terms
5. Important people, teams, or organisations
6. Main debates or points of disagreement
7. Current developments
8. Singapore or Southeast Asia angle
9. Three to five questions to ask
10. Beginner mistakes or assumptions to avoid
11. Related topics
12. Sources and freshness information

### Depth levels

The same topic should support progressive disclosure:

- 30-second overview
- Five-minute conversation brief
- Deeper background
- Current updates
- Related topics

### Search behaviour

Search should support:

- Topic names
- People and organisations
- Events
- Common beginner questions
- Synonyms and spelling variations

If no result exists, the user should be able to request the topic. Failed searches must be captured for topic discovery.

## 6. Content model

The system must separate evergreen context from current information.

### Core entities

- Topic: a broad subject such as football, artificial intelligence, or Singapore housing.
- Entity: a person, team, company, organisation, place, or product.
- Event: a time-bound tournament, election, launch, festival, or major occurrence.
- Briefing: the structured evergreen explanation of a topic.
- Update: a dated development associated with a topic, entity, or event.
- Source: an external reference used to support content.
- Claim: a factual statement linked to one or more sources.
- Category: a high-level grouping such as sport, culture, technology, money, or local life.

### Content status

Content must support the following states:

- Draft
- In editorial review
- Needs verification
- Approved
- Published
- Archived

### Source metadata

Each source should retain:

- Publisher
- URL or source identifier
- Source type
- Publication date
- Retrieval date
- Related topic or entity
- Licensing or usage notes

## 7. Information gathering and editorial workflow

The system should collect information from approved sources, such as:

- Official organisations and governing bodies
- Government and institutional websites
- Licensed news feeds or APIs
- RSS feeds
- Public datasets
- Event calendars
- Manually submitted editorial sources
- Search and public-interest signals

The ingestion pipeline should:

1. Fetch new source items.
2. Normalise them into a common format.
3. Detect duplicates and near-duplicates.
4. Identify related topics, entities, and events.
5. Extract candidate claims.
6. Estimate relevance and importance.
7. Generate an AI-assisted draft summary.
8. Attach sources and dates.
9. Route the item to editorial review.
10. Publish only after approval, subject to configurable risk rules.

AI-generated content must not be treated as authoritative by default. Sensitive topics such as politics, finance, health, legal issues, allegations, and breaking news require stronger verification rules and multiple reputable sources.

## 8. Topic discovery and popularity

Popularity must be calculated from multiple signals:

- Singapore-specific search momentum
- News coverage frequency
- Social and public discussion signals
- Upcoming event relevance
- User searches
- Failed searches
- Saves, shares, and repeat visits
- Direct user topic requests

The system should calculate at least two scores:

### Popularity score

How much attention a topic appears to be receiving.

### Conversation value score

How useful it is to explain the topic to beginners. This should consider popularity, complexity, social relevance, and the likelihood that users need context.

The editorial dashboard should show why a topic has been recommended rather than exposing only one opaque score.

## 9. Monolithic architecture requirement

The MVP must use a modular monolith:

- One code repository
- One deployable application
- One primary relational database
- Internal modules with clear boundaries
- Background jobs running from the same codebase

Recommended internal modules:

- Web and API
- Authentication and user preferences
- Topics and entities
- Briefings and updates
- Sources and claims
- Ingestion
- AI-assisted processing
- Topic ranking
- Editorial workflow
- Analytics

The architecture should allow ingestion, search, and AI processing to be extracted into separate services later if scale requires it, but this is not an MVP requirement.

## 10. Admin and editorial requirements

Editors must be able to:

- Create and edit topics
- Edit structured briefing sections
- Add and manage sources
- Review AI-generated updates
- Approve, reject, or request verification
- Merge duplicate topics
- Link entities and events
- View content freshness
- Archive outdated content
- See the revision history
- Manually promote or demote topics

Every published current update must display a source and publication or update date. The system should retain who approved it and when.

## 11. Web analytics requirements

Analytics must measure both acquisition and usefulness.

### Required events

- `page_viewed`
- `search_submitted`
- `search_result_clicked`
- `search_no_result`
- `topic_viewed`
- `topic_section_expanded`
- `current_update_opened`
- `related_topic_clicked`
- `briefing_saved`
- `briefing_shared`
- `topic_requested`
- `feedback_submitted`

### Required event properties

- Anonymous or authenticated user identifier
- Session identifier
- Topic identifier
- Search query, subject to privacy rules
- Referrer
- Device type
- Country or region at an appropriate aggregate level
- Content version
- Timestamp

### Core product metrics

- Search-to-topic success rate
- No-result search rate
- Median time to first useful interaction
- Briefing completion rate
- Average meaningful reading time
- Save rate
- Share rate
- Return-user rate
- Topic request volume
- Percentage of pages with stale content
- Source-to-publication review time

Analytics must avoid collecting unnecessary sensitive personal data. Consent, retention, deletion, and privacy controls must be defined before launch.

## 12. Test-driven development requirements

Development must follow TDD for business logic and critical user flows.

### Unit tests

Cover:

- Topic ranking calculations
- Freshness calculations
- Source validation
- Duplicate detection
- Claim-to-source relationships
- Content status transitions
- Search query normalisation
- Analytics event validation

### Integration tests

Cover:

- Source ingestion into the database
- AI draft creation with mocked external providers
- Editorial approval workflow
- Topic search and retrieval
- Analytics event persistence or delivery
- Scheduled update processing

### End-to-end tests

Cover the critical journeys:

1. User searches for a topic and reads its briefing.
2. User searches for an unknown topic and submits a request.
3. Editor reviews and publishes an update.
4. A source item is ingested, classified, and routed to review.
5. User saves or shares a topic.

External AI, news, and trend providers must be mocked in automated tests. Tests must not depend on live third-party APIs.

Each feature should be implemented in this order:

1. Write acceptance criteria.
2. Write failing tests.
3. Implement the smallest working change.
4. Run unit, integration, and relevant end-to-end tests.
5. Refactor while keeping tests green.

## 13. Non-functional requirements

- Responsive and mobile-first interface
- Fast initial topic-page loading
- Accessible navigation and readable typography
- Search results should be deterministic and explainable
- All published facts must be traceable to sources
- Background failures must be visible to administrators
- Jobs must be retryable and idempotent
- Secrets must be stored outside source control
- Personal data collection must be minimised
- Content revisions must be recoverable
- Application logs must support debugging without exposing private user data

## 14. Suggested delivery phases

### Phase 1: Foundation

- Monolithic application scaffold
- Database schema
- Topic and briefing CRUD
- Public topic pages
- Basic search
- Editorial authentication
- Core analytics events
- Test infrastructure

### Phase 2: Content operations

- Source management
- Editorial review workflow
- Updates and freshness indicators
- Topic requests
- Basic ingestion connector
- AI-assisted drafting with mocked tests

### Phase 3: Discovery and personalisation

- Popularity scoring
- Singapore-specific trending topics
- Related topics
- Saved briefings
- Personalised preparation prompt
- Enhanced analytics dashboards

### Phase 4: Scale and refinement

- Additional source connectors
- Search improvements
- Content quality scoring
- Performance optimisation
- Service extraction only where justified by evidence

## 15. MVP acceptance criteria

The MVP is ready for a controlled launch when:

- At least 25–50 topics can be created and maintained through the editorial dashboard.
- A user can search, open, read, and share a structured briefing.
- Every published topic has sources and a freshness date.
- Editors can approve, revise, archive, and restore content.
- Current updates are visibly separated from evergreen context.
- Unknown searches produce a useful topic-request flow.
- Required analytics events are captured and queryable.
- Critical user and editorial workflows have automated tests.
- External providers are mocked in the test suite.
- The application can recover from failed ingestion jobs without duplicating content.
- Privacy, consent, and data-retention decisions are documented.

## 16. Open product decisions for PRD refinement

- Which initial age range and user segment should be prioritised?
- Should the first release be English-only?
- Which 25–50 launch topics should be included?
- Which source providers and licensing models are acceptable?
- How much editorial review capacity is available?
- Should users create accounts before saving topics?
- Which analytics platform and privacy model should be used?
- What is the definition of “fresh enough” for each topic category?
- Which sensitive categories are excluded from the first release?
- What is the initial hosting and deployment environment?

## 17. Handoff instruction for Codex

Use this document as the source of truth for producing the detailed PRDs and implementation plan. Before writing production code:

1. Break the requirements into PRDs for the public experience, editorial system, ingestion pipeline, topic discovery, analytics, and testing.
2. Identify contradictions, missing decisions, and risky assumptions.
3. Propose the database schema and module boundaries for a modular monolith.
4. Define user stories and acceptance criteria for every MVP feature.
5. Produce a test plan following TDD.
6. Produce an analytics event taxonomy and measurement plan.
7. Produce a phased implementation plan with dependencies.
8. Ask clarifying questions only where the answer changes architecture, scope, privacy, or launch feasibility.
9. Do not begin implementation until the PRDs and acceptance criteria are internally consistent.
