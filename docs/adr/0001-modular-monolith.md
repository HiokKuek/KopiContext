# Use a TypeScript modular monolith

KopiContext will use one TypeScript repository, deployable application, and primary Postgres database. The application will keep Web/API, editorial workflow, Topics and Entities, Briefings and Current Updates, Sources and Claims, ingestion, AI-assisted processing, ranking, and analytics behind explicit internal module boundaries so they can be extracted later only when operational evidence justifies it.

## Considered Options

- Independent services from launch
- A modular monolith

## Consequences

The MVP keeps operational complexity low while preserving boundaries that make future extraction possible.
