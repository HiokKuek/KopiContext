"use client";

import { useActionState } from "react";

import type {
  EditorialCurrentUpdate,
  EditorialWorkflowAction,
} from "@/modules/editorial/editorial-read-model";

import type { CurrentUpdateTransitionActionState } from "./actions";

const labels: Readonly<Record<EditorialWorkflowAction, string>> = {
  "move-to-needs-verification": "Send to verification",
  "start-editorial-review": "Start editorial review",
  "return-to-draft": "Return to draft",
  approve: "Approve",
  publish: "Publish",
  archive: "Archive",
  restore: "Restore approval",
};

const initial: CurrentUpdateTransitionActionState = { kind: "idle", message: "" };

export function CurrentUpdatesPanel({
  updates,
  action,
}: Readonly<{
  updates: ReadonlyArray<EditorialCurrentUpdate>;
  action: (currentUpdateId: string) => (state: CurrentUpdateTransitionActionState, form: FormData) => Promise<CurrentUpdateTransitionActionState>;
}>) {
  if (updates.length === 0) return null;
  return (
    <section className="review-current-updates" aria-labelledby="current-updates-heading">
      <p className="section-kicker">Current context</p>
      <h2 id="current-updates-heading">Dated updates</h2>
      <p className="editor-section-intro">Each update has its own evidence and approval history. Publishing one never changes the evergreen Briefing.</p>
      <ol className="current-update-review-list">
        {updates.map((update) => <CurrentUpdateCard key={update.id} update={update} action={action(update.id)} />)}
      </ol>
    </section>
  );
}

function CurrentUpdateCard({
  update,
  action,
}: Readonly<{
  update: EditorialCurrentUpdate;
  action: (state: CurrentUpdateTransitionActionState, form: FormData) => Promise<CurrentUpdateTransitionActionState>;
}>) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <li className="current-update-review-card">
      <header>
        <p className="briefing-meta"><span className="status-token">{update.status.replaceAll("-", " ")}</span> Effective {formatDate(update.effectiveAt)}</p>
        <h3>{update.title}</h3>
      </header>
      <p>{update.body}</p>
      <div className="current-update-evidence">
        <strong>Supporting evidence</strong>
        {update.supports.length === 0 ? <p className="editor-empty">No source is attached. This update cannot be published.</p> : (
          <ul>{update.supports.map((support) => <li key={support.id}><a href={support.canonicalUrl} target="_blank" rel="noreferrer">{support.publisher} — {support.title}</a><blockquote>{support.excerpt}</blockquote><small>{support.rationale}</small></li>)}</ul>
        )}
      </div>
      {update.allowedActions.length > 0 ? <form action={formAction} className="current-update-transition-form">
        <label>Next step<select name="action" defaultValue=""><option value="" disabled>Select a review step</option>{update.allowedActions.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select></label>
        <label>Reason, where required<textarea name="reason" rows={2} /></label>
        <label><input name="confirm-publication" type="checkbox" value="publish" /> I confirm publication when I choose Publish.</label>
        <button disabled={pending}>{pending ? "Saving…" : "Save review step"}</button>
        <p aria-live="polite">{state.kind === "success" ? `Update is now ${state.status.replaceAll("-", " ")}.` : state.message}</p>
      </form> : null}
    </li>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "an unknown date" : new Intl.DateTimeFormat("en-SG", { dateStyle: "medium" }).format(date);
}
