"use client";

import { type FormEvent, useId, useState } from "react";
import { validateTopicRequest, type TopicRequestValidationFailure } from "@/modules/discovery/topic-request";

type SubmissionState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "validation-error"; reason: TopicRequestValidationFailure["reason"] }
  | { kind: "unavailable" };

type TopicRequestFormProps = Readonly<{
  initialTopic: string;
}>;

const endpoint = "/api/topic-requests";

function errorMessage(reason: TopicRequestValidationFailure["reason"]) {
  switch (reason) {
    case "missing-topic":
      return "Tell us the Topic you would like to understand.";
    case "topic-too-short":
      return "Please use at least two characters so we can understand the Topic.";
    case "topic-too-long":
      return "Keep the Topic to 120 characters or fewer.";
    case "personal-information-not-allowed":
      return "Please remove personal contact or network details and request only the Topic.";
  }
}

/**
 * A deliberately small client boundary. It talks only to the same-origin web
 * BFF route, which will own server-side authentication to the private API.
 */
export function TopicRequestForm({ initialTopic }: TopicRequestFormProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [submission, setSubmission] = useState<SubmissionState>({ kind: "idle" });
  const inputId = useId();
  const messageId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateTopicRequest({ requestedTopic: topic });

    if (!validation.ok) {
      setSubmission({ kind: "validation-error", reason: validation.reason });
      return;
    }

    setSubmission({ kind: "submitting" });

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(validation.request),
      });

      if (!response.ok) {
        setSubmission({ kind: "unavailable" });
        return;
      }

      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || !("status" in payload) || payload.status !== "received") {
        setSubmission({ kind: "unavailable" });
        return;
      }

      setSubmission({ kind: "success" });
    } catch {
      setSubmission({ kind: "unavailable" });
    }
  }

  return (
    <form className="topic-request-form" onSubmit={submit} aria-describedby={`${messageId} ${inputId}-privacy`}>
      <label htmlFor={inputId}>What Topic would you like explained?</label>
      <div className="topic-request-controls">
        <input
          aria-invalid={submission.kind === "validation-error"}
          id={inputId}
          maxLength={120}
          name="requestedTopic"
          onChange={(event) => {
            setTopic(event.target.value);
            if (submission.kind !== "idle") setSubmission({ kind: "idle" });
          }}
          required
          type="text"
          value={topic}
        />
        <button disabled={submission.kind === "submitting"} type="submit">
          {submission.kind === "submitting" ? "Sending request…" : "Request this Topic"}
        </button>
      </div>
      <p className="topic-request-privacy" id={`${inputId}-privacy`}>
        No account needed. Please do not include your name, contact details, or personal situation.
      </p>
      <p aria-live="polite" className="topic-request-status" id={messageId}>
        {submission.kind === "success" ? "Request received. The editor will consider it for the collection." : null}
        {submission.kind === "validation-error" ? errorMessage(submission.reason) : null}
        {submission.kind === "unavailable" ? "Topic requests are unavailable right now. Please try again later." : null}
      </p>
    </form>
  );
}
