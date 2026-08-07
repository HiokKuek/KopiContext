"use client";

import { useActionState } from "react";

import type { EditorialClaimActionState } from "./actions";

const initial: EditorialClaimActionState = { kind: "idle", message: "" };

export function EditorialClaimForm({
  action,
}: Readonly<{
  action: (state: EditorialClaimActionState, form: FormData) => Promise<EditorialClaimActionState>;
}>) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <section className="accept-source editorial-claim-form" aria-labelledby="editorial-claim-heading">
      <p className="section-kicker">Claim</p>
      <h2 id="editorial-claim-heading">Add a supported Claim</h2>
      <p>Write one checkable statement. Quote the exact passage that supports it, then explain the link in your own words.</p>
      <form action={formAction}>
        <label>Claim statement<textarea name="statement" required rows={3} /></label>
        <label>Supporting excerpt<textarea name="excerpt" required rows={4} /></label>
        <label>Why this supports the Claim<textarea name="rationale" required rows={3} /></label>
        <label><input name="confirm-claim" type="checkbox" value="create" required /> I have checked this statement against the accepted Source.</label>
        <button disabled={pending}>{pending ? "Adding Claim…" : "Add supported Claim"}</button>
      </form>
      <p aria-live="polite">{state.kind === "success" ? "Claim added with its supporting Source." : state.message}</p>
    </section>
  );
}
