"use client";

import { useActionState } from "react";

import type { EditorialEvidenceSource } from "@/modules/editorial/editorial-read-model";

import type { CurrentUpdateActionState } from "./actions";

const initial: CurrentUpdateActionState = { kind: "idle", message: "" };

export function CurrentUpdateForm({
  sources,
  action,
}: Readonly<{
  sources: ReadonlyArray<EditorialEvidenceSource>;
  action: (state: CurrentUpdateActionState, form: FormData) => Promise<CurrentUpdateActionState>;
}>) {
  const [state, formAction, pending] = useActionState(action, initial);

  if (sources.length === 0) {
    return (
      <section className="accept-source" aria-labelledby="current-update-heading">
        <p className="section-kicker">Current context</p>
        <h2 id="current-update-heading">Add a Current Update</h2>
        <p>Accept a Source and add a supported Claim first. A Current Update always begins with evidence you have already reviewed.</p>
      </section>
    );
  }

  return (
    <section className="accept-source current-update-form" aria-labelledby="current-update-heading">
      <p className="section-kicker">Current context</p>
      <h2 id="current-update-heading">Add a Current Update</h2>
      <p>Use this for a dated development that supplements the evergreen explanation. It starts as a Draft and cannot publish itself.</p>
      <form action={formAction}>
        <label>What changed?<input name="title" required /></label>
        <label>Plain-English explanation<textarea name="body" required rows={4} /></label>
        <label>Effective date<input name="effectiveAt" type="datetime-local" required /></label>
        <label>Accepted Source<select name="acceptedSourceId" required defaultValue=""><option value="" disabled>Select reviewed evidence</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.publisher} — {source.title}</option>)}</select></label>
        <label>Exact supporting excerpt<textarea name="excerpt" required rows={4} /></label>
        <label>Why this supports the update<textarea name="rationale" required rows={3} /></label>
        <label><input name="confirm-current-update" type="checkbox" value="create" required /> I have checked this dated update against the accepted Source.</label>
        <button disabled={pending}>{pending ? "Saving update…" : "Save Current Update as Draft"}</button>
      </form>
      <p aria-live="polite">{state.kind === "success" ? "Current Update saved as a Draft with its supporting Source." : state.message}</p>
    </section>
  );
}
