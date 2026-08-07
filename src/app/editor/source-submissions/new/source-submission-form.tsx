"use client";

import { FormEvent, useId, useState } from "react";

type FormState =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "submitting" }>
  | Readonly<{ kind: "queued"; submissionId: string }>
  | Readonly<{ kind: "error"; message: string }>;

const initialState: FormState = { kind: "idle" };

export function SourceSubmissionForm({ editorEmail }: Readonly<{ editorEmail: string }>) {
  const identifierId = useId();
  const rightsId = useId();
  const statusId = useId();
  const [kind, setKind] = useState("transcript");
  const [state, setState] = useState<FormState>(initialState);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setState({ kind: "submitting" });

    try {
      const response = await fetch("/api/editor/source-submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: formData.get("kind"),
          originalIdentifier: formData.get("originalIdentifier"),
          rightsNote: formData.get("rightsNote"),
          ...(kind === "transcript" ? { transcriptText: formData.get("transcriptText") } : {}),
        }),
      });
      const result: unknown = await response.json();
      if (response.status === 202 && isQueued(result)) {
        setState({ kind: "queued", submissionId: result.submission.submissionId });
        form.reset();
        setKind("transcript");
        return;
      }
      setState({ kind: "error", message: messageFrom(result) ?? "Material could not be queued. Check the details and try again." });
    } catch {
      setState({ kind: "error", message: "Material could not be queued. Check your connection and try again." });
    }
  }

  if (state.kind === "queued") {
    return (
      <section className="material-receipt" aria-labelledby="material-queued-heading" tabIndex={-1}>
        <p className="section-kicker">Queued</p>
        <h2 id="material-queued-heading">Material is waiting for preparation.</h2>
        <p>
          It has not been retrieved, interpreted, accepted as evidence, or published. You can keep working while the private worker picks it up.
        </p>
        <p className="material-receipt-id">Submission ID: <code>{state.submissionId}</code></p>
        <div className="material-actions">
          <button type="button" onClick={() => setState(initialState)}>Submit another item</button>
          <a className="text-link" href="/editor">Return to review queue</a>
        </div>
      </section>
    );
  }

  return (
    <form className="material-slip" onSubmit={submit} aria-describedby="material-guardrail">
      <div className="material-slip-rule" aria-hidden="true" />
      <fieldset disabled={state.kind === "submitting"}>
        <legend>Material details</legend>
        <p className="material-helper">These details are retained as submission provenance. The submitting editor is recorded from your signed-in session.</p>

        <label className="material-kind-label" htmlFor="material-kind">What are you submitting?</label>
        <select id="material-kind" name="kind" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="transcript">Transcript</option>
          <option value="url">Public URL</option>
          <option value="document">Document reference</option>
        </select>

        <label htmlFor={identifierId}>{identifierLabel(kind)}</label>
        <input
          id={identifierId}
          name="originalIdentifier"
          required
          maxLength={2048}
          placeholder={identifierPlaceholder(kind)}
          aria-describedby="identifier-hint"
        />
        <p id="identifier-hint" className="field-hint">Use a stable link, upload reference, or transcript identifier that you can recognise later.</p>

        {kind === "transcript" ? <>
          <label htmlFor="transcript-text">Transcript text</label>
          <textarea id="transcript-text" name="transcriptText" required maxLength={100000} rows={10} placeholder="Paste the transcript text. It stays private and is never shown in the reader experience." />
          <p className="field-hint">Private worker input only. It will not be displayed in the editor review view.</p>
        </> : null}

        <label htmlFor={rightsId}>Rights and context</label>
        <textarea
          id={rightsId}
          name="rightsNote"
          required
          maxLength={2000}
          rows={5}
          placeholder="For example: official public material, supplied transcript, and anything the reviewer should know."
        />
      </fieldset>

      <aside id="material-guardrail" className="material-guardrail">
        <p className="section-kicker">What happens next</p>
        <p>This only queues the material. A worker may later prepare suggestions; you still decide whether any source, claim, or draft can be used.</p>
        <p className="material-identity">Submitting as <strong>{editorEmail}</strong></p>
      </aside>

      {state.kind === "error" ? (
        <p id={statusId} className="material-status material-status-error" role="alert">{state.message}</p>
      ) : (
        <p id={statusId} className="material-status" aria-live="polite">
          {state.kind === "submitting" ? "Queueing material…" : ""}
        </p>
      )}

      <div className="material-actions">
        <button type="submit">{state.kind === "submitting" ? "Queueing material…" : "Queue material"}</button>
        <a className="text-link" href="/editor">Cancel</a>
      </div>
    </form>
  );
}

function identifierLabel(kind: string): string {
  if (kind === "url") return "Public URL";
  if (kind === "document") return "Document reference";
  return "Transcript reference";
}

function identifierPlaceholder(kind: string): string {
  if (kind === "url") return "https://www.gov.sg/...";
  if (kind === "document") return "Uploaded file name, drive reference, or archive ID";
  return "Video URL, transcript file name, or archive ID";
}

function isQueued(value: unknown): value is { submission: { state: "queued"; submissionId: string } } {
  return (
    typeof value === "object" &&
    value !== null &&
    "submission" in value &&
    typeof value.submission === "object" &&
    value.submission !== null &&
    "state" in value.submission &&
    value.submission.state === "queued" &&
    "submissionId" in value.submission &&
    typeof value.submission.submissionId === "string"
  );
}

function messageFrom(value: unknown): string | undefined {
  if (
    typeof value === "object" && value !== null && "error" in value &&
    typeof value.error === "object" && value.error !== null && "message" in value.error &&
    typeof value.error.message === "string"
  ) {
    return value.error.message;
  }
  return undefined;
}
