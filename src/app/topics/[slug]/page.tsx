import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPublishedBriefingBySlug,
  type CivicGovernmentModel,
} from "@/modules/content/published-briefings";

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
  const governmentModel: CivicGovernmentModel | undefined = briefing.civicGovernmentModel;

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

          {governmentModel ? <section className="government-map" aria-labelledby="government-map-heading">
            <div className="government-map-intro">
              <p className="section-kicker">The big picture</p>
              <h2 id="government-map-heading">Start with the map</h2>
              <p>{governmentModel.introduction}</p>
            </div>
            <div className="branch-diagram" aria-label="Singapore Government has three branches: Legislature, Executive, and Judiciary">
              <div className="diagram-root">Singapore Government</div>
              <ol>
                {governmentModel.branches.map((branch) => (
                  <li key={branch.id}>
                    <strong>{branch.name}</strong>
                    <span>{branch.plainLanguagePurpose}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section> : null}

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

              {governmentModel ? <>
              <section className="branch-section" aria-labelledby="branches-heading">
                <p className="section-kicker">The three branches</p>
                <h2 id="branches-heading">Each branch has a different job</h2>
                <div className="branch-cards">
                  {governmentModel.branches.map((branch) => (
                    <section className="branch-card" key={branch.id} aria-labelledby={`${branch.id}-heading`}>
                      <p className="branch-label">{branch.name}</p>
                      <h3 id={`${branch.id}-heading`}>{branch.plainLanguagePurpose}</h3>
                      <p><strong>Who belongs here:</strong> {branch.institutions.join(", ")}.</p>
                      <p className="branch-example">{branch.everydayExample}</p>
                      <a href="#key-terms">{branch.learnMoreLabel}</a>
                    </section>
                  ))}
                </div>
              </section>

              <section className="role-comparison" aria-labelledby="roles-heading">
                <p className="section-kicker">A common mix-up</p>
                <h2 id="roles-heading">{governmentModel.officeComparison.title}</h2>
                <h3>{governmentModel.officeComparison.question}</h3>
                <p>{governmentModel.officeComparison.answer}</p>
                <div className="table-scroll">
                  <table>
                    <thead><tr><th scope="col">Role</th><th scope="col">Main purpose</th></tr></thead>
                    <tbody>
                      {governmentModel.officeComparison.roles.map((item) => (
                        <tr key={item.role}><th scope="row">{item.role}</th><td>{item.purpose}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="government-flow" aria-labelledby="flow-heading">
                <p className="section-kicker">How the parts connect</p>
                <h2 id="flow-heading">{governmentModel.policyFlow.title}</h2>
                <p>{governmentModel.policyFlow.introduction}</p>
                <ol>
                  {governmentModel.policyFlow.steps.map((step, index) => (
                    <li key={step.title}><span aria-hidden="true">{index + 1}</span><p><strong>{step.title}.</strong> {step.explanation}</p></li>
                  ))}
                </ol>
                <aside className="policy-example" aria-labelledby="policy-example-heading">
                  <h3 id="policy-example-heading">{governmentModel.policyFlow.exampleTitle}</h3>
                  <p>{governmentModel.policyFlow.exampleSummary}</p>
                </aside>
              </section>
              </> : null}

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
