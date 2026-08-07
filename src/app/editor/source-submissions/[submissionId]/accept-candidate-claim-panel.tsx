"use client";

import { useActionState } from "react";

import type { CandidateClaimAcceptanceContext } from "@/modules/evidence/candidate-claim-acceptance-context";
import type { CandidateClaimAcceptanceActionState } from "./candidate-claim-actions";

type Action = (state: CandidateClaimAcceptanceActionState, formData: FormData) => Promise<CandidateClaimAcceptanceActionState>;
const initial: CandidateClaimAcceptanceActionState = { kind: "idle", message: "" };

export function AcceptCandidateClaimPanel({ candidate, revisions, sources, action }: Readonly<{
  candidate: CandidateClaimAcceptanceContext["proposal"]["candidateClaims"][number];
  revisions: CandidateClaimAcceptanceContext["revisionsCreatedFromSubmission"];
  sources: CandidateClaimAcceptanceContext["sourcesAcceptedFromSubmission"];
  action: Action;
}>) {
  const [state, formAction, pending] = useActionState<CandidateClaimAcceptanceActionState, FormData>(action, initial);
  const canAccept = revisions.length > 0 && sources.length > 0;
  return <section className="candidate-claim-decision">
    <p className="section-kicker">Explicit evidence decision</p>
    <h3>Accept this candidate Claim</h3>
    <p className="candidate-claim-statement">{candidate.statement}</p>
    <p>Link it to one Draft revision and one already accepted Source. This does not publish a Briefing.</p>
    {canAccept ? <form action={formAction}>
      <label>Draft revision
        <select name="briefing-revision-id" required defaultValue=""><option value="" disabled>Choose a Draft revision</option>{revisions.map((revision) => <option key={revision.id} value={revision.id}>{revision.topic.title} · revision {revision.sequence} · {revision.draftTitle}</option>)}</select>
      </label>
      <label>Accepted Source
        <select name="accepted-source-id" required defaultValue=""><option value="" disabled>Choose an Accepted Source</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.publisher} · {source.title}</option>)}</select>
      </label>
      <label className="publish-confirmation"><input name="confirm-candidate-claim" type="checkbox" value="accept-candidate-claim" required />I have reviewed this statement and its excerpt, and I accept it as a Claim supported by the selected Source.</label>
      <button disabled={pending} type="submit">{pending ? "Accepting Claim…" : "Accept Claim"}</button>
    </form> : <p className="candidate-claim-blocked">Accept the proposed Draft and this material as a Source first. Claim acceptance needs both records.</p>}
    <p className={`accept-proposal-result ${state.kind}`} aria-live="polite">{state.kind === "idle" ? "" : state.kind === "success" ? `Accepted Claim ID: ${state.claimId}` : state.message}</p>
  </section>;
}
