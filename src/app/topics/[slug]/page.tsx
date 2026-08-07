import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedBriefingBySlug } from "@/modules/content/published-briefings";

type TopicPageProps = {
  params: Promise<{ slug: string }>;
};

const pathStages = [
  { id: "orient", label: "Orient", description: "What is this?" },
  { id: "understand", label: "Understand", description: "How does it work?" },
  { id: "weigh", label: "Weigh", description: "Why does it matter?" },
  { id: "participate", label: "Participate", description: "What can I say or ask?" },
] as const;

function formatReviewedDate(date: string) {
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const briefing = getPublishedBriefingBySlug(slug);

  if (!briefing) {
    return { title: "Topic not found" };
  }

  return {
    title: briefing.title,
    description: briefing.oneSentenceExplanation,
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { slug } = await params;
  const briefing = getPublishedBriefingBySlug(slug);

  if (!briefing) {
    notFound();
  }

  const reviewedDate = formatReviewedDate(briefing.lastReviewedAt);

  return (
    <>
      <header className="site-header">
        <Link className="wordmark" href="/topics/how-singapores-government-works">
          Kopi<span>Context</span>
        </Link>
        <p className="header-note">A little context for the conversation.</p>
      </header>

      <main id="main-content">
        <article className="briefing-shell" aria-labelledby="briefing-title">
          <header className="topic-proposition" id="orient">
            <p className="eyebrow">Civic life · Briefing</p>
            <h1 id="briefing-title">{briefing.title}</h1>
            <p className="proposition">{briefing.oneSentenceExplanation}</p>
            <div className="briefing-meta">
              <span>About 5 minutes</span>
              <span aria-hidden="true">·</span>
              <span>Reviewed {reviewedDate}</span>
              <span aria-hidden="true">·</span>
              <a href="#sources">View sources</a>
            </div>
          </header>

          <section className="overview" aria-labelledby="overview-heading">
            <p className="section-kicker">Start here</p>
            <h2 id="overview-heading">The 30-second overview</h2>
            <p>{briefing.thirtySecondOverview}</p>
          </section>

          <div className="reading-grid">
            <nav aria-label="Conversation path" className="conversation-path">
              <p className="path-title">Conversation path</p>
              <ol>
                {pathStages.map((stage) => (
                  <li key={stage.id}>
                    <a href={`#${stage.id}`}>
                      <span>{stage.label}</span>
                      <small>{stage.description}</small>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="reading-column">
              <section id="understand" aria-labelledby="understand-heading">
                <p className="section-kicker">Understand</p>
                <h2 id="understand-heading">How it works</h2>
                <p>{briefing.fiveMinuteExplanation}</p>
              </section>

              <section aria-labelledby="terms-heading">
                <h2 id="terms-heading">A few useful terms</h2>
                <dl className="terms-list">
                  {briefing.keyTerms.map((item) => (
                    <div key={item.term}>
                      <dt>{item.term}</dt>
                      <dd>{item.definition}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section aria-labelledby="entities-heading">
                <h2 id="entities-heading">Who is involved</h2>
                <ul className="entity-list">
                  {briefing.entities.map((entity) => (
                    <li key={entity}>{entity}</li>
                  ))}
                </ul>
              </section>

              <section id="weigh" aria-labelledby="weigh-heading">
                <p className="section-kicker">Weigh</p>
                <h2 id="weigh-heading">Why people care</h2>
                <p>{briefing.whyPeopleCare}</p>
                <div className="context-pair">
                  <section aria-labelledby="debates-heading">
                    <h3 id="debates-heading">Questions people discuss</h3>
                    <ul>
                      {briefing.debates.map((debate) => (
                        <li key={debate}>{debate}</li>
                      ))}
                    </ul>
                  </section>
                  <section aria-labelledby="regional-heading">
                    <h3 id="regional-heading">Singapore and the region</h3>
                    <p>{briefing.singaporeSeaAngle}</p>
                  </section>
                </div>
              </section>

              <section id="participate" aria-labelledby="participate-heading">
                <p className="section-kicker">Participate</p>
                <h2 id="participate-heading">Take the conversation further</h2>
                <div className="participate-grid">
                  <section aria-labelledby="questions-heading">
                    <h3 id="questions-heading">Questions to ask</h3>
                    <ul>
                      {briefing.questionsToAsk.map((question) => (
                        <li key={question}>{question}</li>
                      ))}
                    </ul>
                  </section>
                  <section aria-labelledby="mistakes-heading">
                    <h3 id="mistakes-heading">Easy mistakes to avoid</h3>
                    <ul>
                      {briefing.mistakesToAvoid.map((mistake) => (
                        <li key={mistake}>{mistake}</li>
                      ))}
                    </ul>
                  </section>
                </div>
              </section>

              <footer className="trust-footer" id="sources" aria-labelledby="sources-heading">
                <p className="section-kicker">Check the support</p>
                <h2 id="sources-heading">Sources</h2>
                <p className="source-intro">
                  This Briefing was reviewed on {reviewedDate}. These Sources support
                  its explanation.
                </p>
                <ul className="source-list">
                  {briefing.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} rel="noreferrer" target="_blank">
                        {source.title}
                      </a>
                      <span>{source.publisher}</span>
                    </li>
                  ))}
                </ul>
                <p className="footer-note">
                  See something that needs attention? This Briefing is reviewed by an
                  editor before publication.
                </p>
              </footer>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
