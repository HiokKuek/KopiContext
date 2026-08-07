import Link from "next/link";

import type { EditorIdentity } from "@/modules/auth/editor-auth";
import type { EditorialBriefingReview } from "@/modules/editorial/editorial-read-model";

import { EditorHeader } from "../../editor-workspace";
import { TransitionPanel } from "./transition-panel";
import type {
  EditorialClaimActionState,
  CurrentUpdateActionState,
  EditorialSourceActionState,
  EditorialTransitionActionState,
} from "./actions";
import { EditorialSourceForm } from "./editorial-source-form";
import { CurrentUpdateForm } from "./current-update-form";

type TransitionAction = (state: EditorialTransitionActionState, formData: FormData) => Promise<EditorialTransitionActionState>;

export function BriefingReview({
  editor,
  review,
  transitionAction,
  sourceAction,
  claimAction,
  currentUpdateAction,
}: Readonly<{
  editor: EditorIdentity;
  review: EditorialBriefingReview;
  transitionAction: TransitionAction;
  sourceAction: (state: EditorialSourceActionState, form: FormData) => Promise<EditorialSourceActionState>;
  claimAction: (sourceId: string) => (state: EditorialClaimActionState, form: FormData) => Promise<EditorialClaimActionState>;
  currentUpdateAction: (state: CurrentUpdateActionState, form: FormData) => Promise<CurrentUpdateActionState>;
}>) {
  return (
    <>
      <EditorHeader editor={editor} />
      <main id="main-content" className="editor-shell briefing-review-shell">
        <Link className="editor-back-link" href="/editor">← Back to queue</Link>
        <header className="review-heading">
          <p className="eyebrow">{review.briefing.topic.title}</p>
          <h1>{review.briefing.title}</h1>
          <p className="briefing-meta">
            <span className="status-token">{review.briefing.status.replaceAll("-", " ")}</span>
            Revision {review.revision.sequence} · {review.revision.origin} draft · Last activity {formatDate(review.freshness.lastActivityAt)}
          </p>
          {review.briefing.status === "draft" ? <Link className="editor-revise-link" href={`/editor/briefings/${review.briefing.id}/revise`}>Edit this draft →</Link> : null}
        </header>

        <div className="review-layout">
          <div className="review-reading">
            <section aria-labelledby="completeness-heading">
              <p className="section-kicker">Evidence</p>
              <h2 id="completeness-heading">Completeness</h2>
              <ul className="template-checklist">
                {review.templateSections.map((section) => <li key={section.key} data-state={section.state}>{section.label}: {section.state}</li>)}
              </ul>
            </section>
            <section aria-labelledby="claims-heading">
              <p className="section-kicker">Claims</p>
              <h2 id="claims-heading">What the draft says</h2>
              {review.claims.length === 0 ? <p className="editor-empty">No Claims are attached to this revision yet.</p> : (
                <ol className="review-claims">
                  {review.claims.map((claim) => <li key={claim.id}><p>{claim.statement}</p><small>{claim.supports.length === 0 ? "No supporting Source attached." : `${claim.supports.length} supporting Source${claim.supports.length === 1 ? "" : "s"}.`}</small></li>)}
                </ol>
              )}
            </section>
            <section aria-labelledby="sources-heading">
              <p className="section-kicker">Sources</p>
              <h2 id="sources-heading">Accepted evidence</h2>
              {review.acceptedSources.length === 0 ? <p className="editor-empty">No accepted Sources are attached to this revision yet.</p> : (
                <ul className="review-sources">
                  {review.acceptedSources.map((source) => <li key={source.id}><a href={source.canonicalUrl} target="_blank" rel="noreferrer">{source.title}</a><p>{source.publisher} · {source.sourceType} · Retrieved {formatDate(source.retrievedAt)}</p><small>Rights: {source.rightsNote}</small></li>)}
                </ul>
              )}
            </section>
            {review.briefing.status === "draft" ? <EditorialSourceForm action={sourceAction} claimAction={claimAction} /> : null}
            {review.briefing.status === "draft" ? <CurrentUpdateForm sources={review.acceptedSources} action={currentUpdateAction} /> : null}
            <section aria-labelledby="audit-heading">
              <p className="section-kicker">Record</p>
              <h2 id="audit-heading">Editorial record</h2>
              {review.auditRecords.length === 0 ? <p className="editor-empty">No decisions have been recorded for this revision yet.</p> : (
                <ol className="audit-list">{review.auditRecords.map((record, index) => <li key={`${record.occurredAt}-${index}`}><strong>{record.from.replaceAll("-", " ")} → {record.to.replaceAll("-", " ")}</strong><span>{formatDate(record.occurredAt)} · {record.actorId}</span>{record.reason ? <p>{record.reason}</p> : null}</li>)}</ol>
              )}
            </section>
          </div>
          <TransitionPanel allowedActions={review.allowedActions} action={transitionAction} />
        </div>
      </main>
    </>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "an unknown date" : new Intl.DateTimeFormat("en-SG", { dateStyle: "medium" }).format(date);
}
