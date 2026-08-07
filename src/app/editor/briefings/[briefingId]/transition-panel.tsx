"use client";

import { useActionState, useEffect, useRef } from "react";

import type { EditorialWorkflowAction } from "@/modules/editorial/editorial-read-model";

import type { EditorialTransitionActionState } from "./actions";

type TransitionAction = (
  state: EditorialTransitionActionState,
  formData: FormData,
) => Promise<EditorialTransitionActionState>;

type TransitionFormAction = (formData: FormData) => void;

const initialEditorialTransitionActionState: EditorialTransitionActionState = { kind: "idle", message: "" };

export function TransitionPanel({
  allowedActions,
  action,
}: Readonly<{
  allowedActions: ReadonlyArray<EditorialWorkflowAction>;
  action: TransitionAction;
}>) {
  const [state, formAction, pending] = useActionState<EditorialTransitionActionState, FormData>(action, initialEditorialTransitionActionState);
  const resultRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.kind !== "idle") resultRef.current?.focus();
  }, [state]);

  return (
    <aside className="decision-panel" aria-labelledby="decision-heading">
      <p className="section-kicker">Decision</p>
      <h2 id="decision-heading">Choose the next step</h2>
      <p className="decision-intro">Only actions allowed for this revision are shown. The editorial service checks again before recording any change.</p>
      <p ref={resultRef} className={`decision-result decision-result-${state.kind}`} tabIndex={-1} aria-live="polite">
        {messageFor(state)}
      </p>
      {allowedActions.length === 0 ? (
        <p className="editor-empty">There is no next action available for this Briefing.</p>
      ) : (
        <div className="decision-actions">
          {allowedActions.map((nextAction) => (
            <TransitionForm key={nextAction} nextAction={nextAction} formAction={formAction} pending={pending} />
          ))}
        </div>
      )}
    </aside>
  );
}

function TransitionForm({
  nextAction,
  formAction,
  pending,
}: Readonly<{
  nextAction: EditorialWorkflowAction;
  formAction: TransitionFormAction;
  pending: boolean;
}>) {
  const needsReason = nextAction === "return-to-draft" || nextAction === "move-to-needs-verification" || nextAction === "archive";
  const isPublish = nextAction === "publish";
  const copy = actionCopy(nextAction);
  return (
    <form action={formAction} className={`decision-action decision-action-${nextAction}`}>
      <h3>{copy.title}</h3>
      <p>{copy.consequence}</p>
      {(needsReason || nextAction === "approve") && (
        <label>
          {needsReason ? "Reason" : "Review note (optional)"}
          <textarea name="reason" required={needsReason} maxLength={2000} rows={3} />
        </label>
      )}
      {isPublish && (
        <label className="publish-confirmation">
          <input type="checkbox" name="confirm-publication" value="publish" required />
          I understand this makes the reviewed revision public.
        </label>
      )}
      <button name="action" value={nextAction} type="submit" disabled={pending}>
        {pending ? "Recording decision…" : copy.button}
      </button>
    </form>
  );
}

function messageFor(state: EditorialTransitionActionState): string {
  if (state.kind === "idle") return "";
  if (state.kind === "success") return `Recorded. This Briefing is now ${state.status.replaceAll("-", " ")}.`;
  return state.message;
}

function actionCopy(action: EditorialWorkflowAction): Readonly<{ title: string; consequence: string; button: string }> {
  const copy: Record<EditorialWorkflowAction, { title: string; consequence: string; button: string }> = {
    "move-to-needs-verification": { title: "Needs verification", consequence: "Marks this revision as needing further evidence before review continues.", button: "Move to needs verification" },
    "start-editorial-review": { title: "Start editorial review", consequence: "Moves this revision into the editorial review stage.", button: "Start review" },
    "return-to-draft": { title: "Return to draft", consequence: "Sends this revision back for revision. Add a reason for the record.", button: "Return to draft" },
    approve: { title: "Approve", consequence: "Records that this revision has passed editorial review. It remains private until published.", button: "Approve revision" },
    publish: { title: "Publish", consequence: "Makes this exact reviewed revision visible on the public site.", button: "Publish Briefing" },
    archive: { title: "Archive", consequence: "Removes this published Briefing from public visibility while keeping its record.", button: "Archive Briefing" },
    restore: { title: "Restore to approved", consequence: "Returns this archived Briefing to approved status. It stays private until published again.", button: "Restore to approved" },
  };
  return copy[action];
}
