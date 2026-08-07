import Link from "next/link";
import { connection } from "next/server";
import { createPublicCatalogueFromEnvironment } from "@/platform/web/public-catalogue";

export default async function HomePage() {
  // Next 16's connection() keeps server-only runtime configuration and the
  // private API call out of build-time prerendering and the browser bundle.
  await connection();
  const featuredBriefing = await createPublicCatalogueFromEnvironment().findPublishedBriefingBySlug(
    "how-singapores-government-works",
  );
  return (
    <>
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="KopiContext home">
          Kopi<span>Context</span>
        </Link>
        <p className="header-note">A little context for the conversation.</p>
      </header>

      <main id="main-content">
        <article className="briefing-shell" aria-labelledby="home-heading">
          <header className="topic-proposition">
            <p className="eyebrow">Conversation briefings</p>
            <h1 id="home-heading">A useful place to begin.</h1>
            <p className="proposition">
              Get clear, source-backed context before a conversation moves on without
              you.
            </p>

            <form action="/search" method="get" role="search">
              <label htmlFor="topic-search">Find a Topic</label>
              <div>
                <input
                  id="topic-search"
                  name="q"
                  type="search"
                  placeholder="Try “how government works”"
                />
                <button type="submit">Search</button>
              </div>
            </form>
          </header>

          <section className="overview" aria-labelledby="featured-heading">
            <p className="section-kicker">Start with civic life</p>
            <h2 id="featured-heading">How Singapore&apos;s Government Works</h2>
            <p>
              A five-minute guide to Parliament, the Cabinet, the President, and the
              courts—plus questions that help you follow a policy conversation.
            </p>
            {featuredBriefing ? (
              <Link className="text-link" href={`/topics/${featuredBriefing.slug}`}>
                Read the Briefing
              </Link>
            ) : null}
          </section>

          <section className="reading-column" aria-labelledby="how-heading">
            <p className="section-kicker">How KopiContext works</p>
            <h2 id="how-heading">Enough context to join in thoughtfully.</h2>
            <p>
              Each Briefing starts with the simple answer, then explains how the
              pieces connect. You can check the Sources, see when it was reviewed,
              and take away a useful question to ask.
            </p>
          </section>
        </article>
      </main>
    </>
  );
}
