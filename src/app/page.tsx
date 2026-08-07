import Link from "next/link";
import { connection } from "next/server";
import { homeEntryPaths } from "@/modules/discovery/home-entry-paths";
import { createPublicCatalogueFromEnvironment } from "@/platform/web/public-catalogue";

export default async function HomePage() {
  // Next 16's connection() keeps server-only runtime configuration and the
  // private API call out of build-time prerendering and the browser bundle.
  await connection();
  const briefings = await createPublicCatalogueFromEnvironment().listPublishedBriefings();
  const { featured, additional } = homeEntryPaths(briefings);
  return (
    <>
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="KopiContext home">
          Kopi<span>Context</span>
        </Link>
        <p className="header-note">A little context for the conversation.</p>
      </header>

      <main id="main-content">
        <article className="briefing-shell home-shell" aria-labelledby="home-heading">
          <header className="topic-proposition home-proposition">
            <p className="eyebrow">Conversation briefings</p>
            <h1 id="home-heading">Start with a shared map.</h1>
            <p className="proposition">
              Clear, source-backed context for the moments when a conversation gets
              interesting before you have had time to catch up.
            </p>

            <form action="/search" method="get" role="search">
              <label htmlFor="topic-search">What would you like to understand?</label>
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

          {featured ? (
            <section className="home-featured" aria-labelledby="featured-heading">
              <p className="section-kicker">Start here</p>
              <div className="home-featured-content">
                <div>
                  <p className="home-featured-prompt">A useful shared reference</p>
                  <h2 id="featured-heading">{featured.title}</h2>
                  <p>{featured.oneSentenceExplanation}</p>
                </div>
                <Link className="home-featured-link" href={`/topics/${featured.slug}`}>
                  Read the five-minute Briefing <span aria-hidden="true">→</span>
                </Link>
              </div>
            </section>
          ) : (
            <section className="home-empty" aria-labelledby="catalogue-heading">
              <p className="section-kicker">The collection is growing</p>
              <h2 id="catalogue-heading">No Briefings are published yet.</h2>
              <p>Tell us what would help you join a conversation. The editor uses requests to decide what to explain next.</p>
              <Link className="text-link" href="/search">Request a Topic</Link>
            </section>
          )}

          {additional.length > 0 ? (
            <section className="home-shelf" aria-labelledby="shelf-heading">
              <div className="home-shelf-heading">
                <p className="section-kicker">Choose another way in</p>
                <h2 id="shelf-heading">More Briefings on the shelf</h2>
                <p>Each one starts with the plain answer, then gives you the context and questions worth taking into the conversation.</p>
              </div>
              <ol>
                {additional.map((briefing) => (
                  <li key={briefing.slug}>
                    <Link href={`/topics/${briefing.slug}`}>
                      <span>{briefing.title}</span>
                      <small>{briefing.oneSentenceExplanation}</small>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="home-next-step" aria-labelledby="how-heading">
            <p className="section-kicker">How KopiContext works</p>
            <h2 id="how-heading">Enough context to join in thoughtfully.</h2>
            <p>Each Briefing starts with the simple answer, then shows how the pieces connect. You can check the Sources, see when it was reviewed, and take away a useful question to ask.</p>
            <Link className="text-link" href="/search">Browse or request a Topic</Link>
          </section>
        </article>
      </main>
    </>
  );
}
