import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedBriefingBySlug } from "@/modules/content/published-briefings";
import { TopicRequestForm } from "./topic-request-form";

export const metadata: Metadata = {
  title: "Search Topics",
  description: "Find a source-backed KopiContext Briefing.",
};

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

const civicBriefing = getPublishedBriefingBySlug("how-singapores-government-works");

function getQuery(value: string | string[] | undefined) {
  const query = Array.isArray(value) ? value[0] : value;
  return query?.trim().slice(0, 120) ?? "";
}

function matchesCivicBriefing(query: string) {
  if (!civicBriefing || !query) {
    return false;
  }

  const haystack = [
    civicBriefing.title,
    civicBriefing.oneSentenceExplanation,
    civicBriefing.thirtySecondOverview,
    ...civicBriefing.keyTerms.map(({ term, definition }) => `${term} ${definition}`),
    ...civicBriefing.entities,
  ]
    .join(" ")
    .toLocaleLowerCase("en-SG");

  return query
    .toLocaleLowerCase("en-SG")
    .split(/\s+/)
    .some((term) => haystack.includes(term));
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = getQuery((await searchParams).q);
  const hasResult = matchesCivicBriefing(query);

  return (
    <>
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="KopiContext home">
          Kopi<span>Context</span>
        </Link>
        <p className="header-note">A little context for the conversation.</p>
      </header>

      <main className="briefing-shell" id="main-content" aria-labelledby="search-heading">
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

        {hasResult && civicBriefing ? (
          <section className="overview" aria-labelledby="results-heading">
            <p className="section-kicker">One result</p>
            <h2 id="results-heading">{civicBriefing.title}</h2>
            <p>{civicBriefing.oneSentenceExplanation}</p>
            <Link className="text-link" href={`/topics/${civicBriefing.slug}`}>
              Read the Briefing
            </Link>
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
            <Link className="text-link" href="/topics/how-singapores-government-works">
              Explore how Singapore&apos;s Government Works
            </Link>
          </section>
        ) : null}
      </main>
    </>
  );
}
