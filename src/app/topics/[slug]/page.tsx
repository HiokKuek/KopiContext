import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import {
  type BriefingVisualExplainer,
  type ConceptMapExplainer,
} from "@/modules/content/published-briefings";
import { createPublicCatalogueFromEnvironment } from "@/platform/web/public-catalogue";
import { AnalyticsTopicView } from "../../analytics/analytics-topic-view";

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

function getConceptMap(
  explainers: readonly BriefingVisualExplainer[],
): ConceptMapExplainer | undefined {
  return explainers.find(
    (explainer): explainer is ConceptMapExplainer => explainer.kind === "concept-map",
  );
}

function ConceptMapDiagram({ explainer }: { explainer: ConceptMapExplainer }) {
  return (
    <section className="government-map" aria-labelledby={`${explainer.id}-map-heading`}>
      <div className="government-map-intro">
        <p className="section-kicker">The big picture</p>
        <h2 id={`${explainer.id}-map-heading`}>{explainer.title}</h2>
        <p>{explainer.introduction}</p>
      </div>
      <div className="branch-diagram" aria-label={`${explainer.centralLabel}: ${explainer.nodes.map((node) => node.label).join(", ")}`}>
        <div className="diagram-root">{explainer.centralLabel}</div>
        <ol>
          {explainer.nodes.map((node) => (
            <li key={node.id}>
              <strong>{node.label}</strong>
              <span>{node.summary}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ConceptMapCards({ explainer }: { explainer: ConceptMapExplainer }) {
  return (
    <section className="branch-section" aria-labelledby={`${explainer.id}-cards-heading`}>
      <p className="section-kicker">The parts of the picture</p>
      <h2 id={`${explainer.id}-cards-heading`}>Look at each part</h2>
      <div className="branch-cards">
        {explainer.nodes.map((node) => (
          <section className="branch-card" key={node.id} aria-labelledby={`${explainer.id}-${node.id}-heading`}>
            <p className="branch-label">{node.label}</p>
            <h3 id={`${explainer.id}-${node.id}-heading`}>{node.summary}</h3>
            {node.details.length > 0 ? <p><strong>Who belongs here:</strong> {node.details.join(", ")}.</p> : null}
            {node.note ? <p className="branch-note">{node.note}</p> : null}
            {node.example ? <p className="branch-example">{node.example}</p> : null}
            {node.learnMoreLabel ? <a href="#key-terms">{node.learnMoreLabel}</a> : null}
          </section>
        ))}
      </div>
    </section>
  );
}

function SupportingVisualExplainers({ explainers }: { explainers: readonly BriefingVisualExplainer[] }) {
  return explainers.map((explainer) => {
    switch (explainer.kind) {
      case "comparison":
        return (
          <section className="role-comparison" key={explainer.id} aria-labelledby={`${explainer.id}-heading`}>
            <p className="section-kicker">A useful distinction</p>
            <h2 id={`${explainer.id}-heading`}>{explainer.title}</h2>
            {explainer.introduction ? <p>{explainer.introduction}</p> : null}
            {explainer.question ? <h3>{explainer.question}</h3> : null}
            {explainer.answer ? <p>{explainer.answer}</p> : null}
            <div className="table-scroll">
              <table>
                <thead><tr><th scope="col">{explainer.columns.label}</th><th scope="col">{explainer.columns.valueLabel}</th></tr></thead>
                <tbody>{explainer.rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.value}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        );
      case "process-flow":
        return (
          <section className="government-flow" key={explainer.id} aria-labelledby={`${explainer.id}-heading`}>
            <p className="section-kicker">How the parts connect</p>
            <h2 id={`${explainer.id}-heading`}>{explainer.title}</h2>
            <p>{explainer.introduction}</p>
            <ol>{explainer.steps.map((step, index) => <li key={step.title}><span aria-hidden="true">{index + 1}</span><p><strong>{step.title}.</strong> {step.explanation}</p></li>)}</ol>
          </section>
        );
      case "contextual-callout":
        return <aside className="policy-example" key={explainer.id} aria-labelledby={`${explainer.id}-heading`}><h3 id={`${explainer.id}-heading`}>{explainer.title}</h3><p>{explainer.body}</p></aside>;
      case "concept-map":
        return <ConceptMapCards explainer={explainer} key={explainer.id} />;
    }
  });
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const briefing = await createPublicCatalogueFromEnvironment().findPublishedBriefingBySlug(slug);

  if (!briefing) {
    return { title: "Topic not found" };
  }

  return {
    title: briefing.title,
    description: briefing.oneSentenceExplanation,
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  await connection();
  const { slug } = await params;
  const briefing = await createPublicCatalogueFromEnvironment().findPublishedBriefingBySlug(slug);

  if (!briefing) {
    notFound();
  }

  const reviewedDate = formatReviewedDate(briefing.lastReviewedAt);
  const visualExplainers = briefing.visualExplainers ?? [];
  const conceptMap = getConceptMap(visualExplainers);

  return (
    <>
      <header className="site-header">
        <Link className="wordmark" href="/topics/how-singapores-government-works">
          Kopi<span>Context</span>
        </Link>
        <p className="header-note">A little context for the conversation.</p>
      </header>

      <main id="main-content">
        <AnalyticsTopicView topicSlug={briefing.slug} />
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

          {conceptMap ? <ConceptMapDiagram explainer={conceptMap} /> : null}

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

              <SupportingVisualExplainers explainers={visualExplainers} />

              <section id="key-terms" aria-labelledby="terms-heading">
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
