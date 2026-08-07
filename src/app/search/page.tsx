import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { PublishedBriefing } from "@/modules/content/published-briefings";
import { createPublicCatalogueFromEnvironment } from "@/platform/web/public-catalogue";
import { AnalyticsSearch } from "../analytics/analytics-search";
import { TopicRequestForm } from "./topic-request-form";

export const metadata: Metadata = {
  title: "Search Topics",
  description: "Find a source-backed KopiContext Briefing.",
};

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

function getQuery(value: string | string[] | undefined) {
  const query = Array.isArray(value) ? value[0] : value;
  return query?.trim().slice(0, 120) ?? "";
}

function matchesBriefing(briefing: PublishedBriefing, query: string) {
  if (!query) {
    return false;
  }

  const haystack = [
    briefing.title,
    briefing.oneSentenceExplanation,
    briefing.thirtySecondOverview,
    ...briefing.keyTerms.map(({ term, definition }) => `${term} ${definition}`),
    ...briefing.entities,
  ]
    .join(" ")
    .toLocaleLowerCase("en-SG");

  return query
    .toLocaleLowerCase("en-SG")
    .split(/\s+/)
    .some((term) => haystack.includes(term));
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  await connection();
  const query = getQuery((await searchParams).q);
  const publishedBriefings = await createPublicCatalogueFromEnvironment().listPublishedBriefings();
  const results = query ? publishedBriefings.filter((briefing) => matchesBriefing(briefing, query)) : [];
  const hasResult = results.length > 0;

  return (
    <>
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="KopiContext home">
          Kopi<span>Context</span>
        </Link>
        <p className="header-note">A little context for the conversation.</p>
      </header>

      <main className="briefing-shell" id="main-content" aria-labelledby="search-heading">
        <AnalyticsSearch hasResult={hasResult} query={query} />
        <header className="topic-proposition">
          <p className="eyebrow">Topic search</p>
          <h1 id="search-heading">Find a Briefing</h1>
          <form action="/search" method="get" role="search">
            <label htmlFor="topic-search">Search Topics</label>
            <div>
              <input
                defaultValue={query}
                id="topic-search"
                name="q"
                placeholder="Try “Parliament”"
                type="search"
              />
              <button type="submit">Search</button>
            </div>
          </form>
        </header>

        {!query ? (
          <section className="overview" aria-labelledby="search-prompt-heading">
            <h2 id="search-prompt-heading">What would you like to understand?</h2>
            <p>
              Start with a few words. We will show published Briefings that can help
              you get oriented.
            </p>
          </section>
        ) : null}

        {hasResult ? (
          <section className="overview" aria-labelledby="results-heading">
            <p className="section-kicker">{results.length === 1 ? "One result" : `${results.length} results`}</p>
            <h2 id="results-heading">Published Briefings</h2>
            <ul className="search-results">
              {results.map((briefing) => (
                <li key={briefing.slug}>
                  <h3>{briefing.title}</h3>
                  <p>{briefing.oneSentenceExplanation}</p>
                  <Link className="text-link" href={`/topics/${briefing.slug}`}>
                    Read the Briefing
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {query && !hasResult ? (
          <section className="overview" aria-labelledby="empty-results-heading">
            <p className="section-kicker">No published Briefing yet</p>
            <h2 id="empty-results-heading">We do not have a Topic on “{query}” yet.</h2>
            <p>
              We are still building the collection. Request it below, or try a related
              word while the editor considers what to explain next.
            </p>
            <TopicRequestForm initialTopic={query} />
            {publishedBriefings[0] ? (
              <Link className="text-link" href={`/topics/${publishedBriefings[0].slug}`}>
                Explore {publishedBriefings[0].title}
              </Link>
            ) : null}
          </section>
        ) : null}
      </main>
    </>
  );
}
