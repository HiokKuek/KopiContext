"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { EditorialBriefingReview } from "@/modules/editorial/editorial-read-model";
import type { HumanRevisionActionState } from "../actions";

const initial: HumanRevisionActionState = { kind: "idle", message: "" };
type Action = (state: HumanRevisionActionState, formData: FormData) => Promise<HumanRevisionActionState>;

export function RevisionForm({ briefing, revision, action }: Readonly<{ briefing: EditorialBriefingReview["briefing"]; revision: EditorialBriefingReview["revision"]; action: Action }>) {
  const [state, formAction, pending] = useActionState(action, initial);
  const content = revision.content;
  return <main className="editor-shell revision-shell"><Link className="editor-back-link" href={`/editor/briefings/${briefing.id}`}>← Back to review</Link><header className="revision-heading"><p className="eyebrow">Revision {revision.sequence + 1}</p><h1>Make the explanation easier to follow.</h1><p>You are creating a new private draft. The current revision stays in the record, and evidence review still happens before publication.</p></header><form action={formAction} className="revision-slip"><fieldset disabled={pending}><legend>{briefing.title}</legend><Text name="oneSentenceExplanation" label="One-sentence explanation" value={string(content.oneSentenceExplanation)} /><Text name="thirtySecondOverview" label="30-second overview" value={string(content.thirtySecondOverview)} multiline /><Text name="fiveMinuteExplanation" label="Five-minute explanation" value={string(content.fiveMinuteExplanation)} multiline rows={10} /><Text name="whyPeopleCare" label="Why people care" value={string(content.whyPeopleCare)} multiline /><List name="keyTerms" label="Key terms" hint="One per line: Term :: clear definition" value={terms(content.keyTerms)} /><List name="entities" label="People and institutions" value={list(content.entities)} /><List name="debates" label="Conversation debates" value={list(content.debates)} /><Text name="singaporeSeaAngle" label="Singapore context" value={string(content.singaporeSeaAngle)} multiline /><List name="questionsToAsk" label="Questions to ask" value={list(content.questionsToAsk)} /><List name="mistakesToAvoid" label="Common misconceptions" value={list(content.mistakesToAvoid)} /><input type="hidden" name="visualExplainers" value={json(content.visualExplainers)} /><Text name="note" label="What changed? (optional)" value="" multiline rows={3} /><p className={`revision-status revision-status-${state.kind}`} aria-live="polite">{state.kind === "success" ? `Saved as revision ${state.sequence}. Return to review to check it against evidence.` : state.message}</p><div className="material-actions"><button type="submit">{pending ? "Saving revision…" : "Save new revision"}</button><Link href={`/editor/briefings/${briefing.id}`}>Cancel</Link></div></fieldset></form></main>;
}
function Text({ name, label, value, multiline, rows = 4 }: Readonly<{ name: string; label: string; value: string; multiline?: boolean; rows?: number }>) { return <label>{label}{multiline ? <textarea name={name} defaultValue={value} rows={rows} /> : <input name={name} defaultValue={value} />}</label>; }
function List({ name, label, hint, value }: Readonly<{ name: string; label: string; hint?: string; value: string }>) { return <label>{label}{hint ? <small className="field-hint">{hint}</small> : null}<textarea name={name} defaultValue={value} rows={4} /></label>; }
function string(value: unknown): string { return typeof value === "string" ? value : ""; }
function list(value: unknown): string { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join("\n") : ""; }
function terms(value: unknown): string { return Array.isArray(value) ? value.map((term) => typeof term === "object" && term !== null && typeof (term as { term?: unknown }).term === "string" && typeof (term as { definition?: unknown }).definition === "string" ? `${(term as { term: string }).term} :: ${(term as { definition: string }).definition}` : "").filter(Boolean).join("\n") : ""; }
function json(value: unknown): string { return value === undefined ? "" : JSON.stringify(value); }
