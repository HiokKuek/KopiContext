import type { EditorIdentity } from "@/modules/auth/editor-auth";
import {
  EditorAccessDeniedError,
  EditorAuthenticationRequiredError,
} from "@/modules/auth/editor-auth";
import type { SourceSubmissionKind } from "@/modules/preparation/source-preparation";

import type {
  SourceSubmissionDraft,
  SourceSubmissionQueueTransport,
} from "./source-submission-bff";

export type EditorSourceSubmissionRouteDependencies = Readonly<{
  requireEditor(): Promise<EditorIdentity>;
  sourceSubmissions: SourceSubmissionQueueTransport;
  now?: () => Date;
  newId?: () => string;
}>;

const kinds = new Set<SourceSubmissionKind>(["url", "document", "transcript"]);

/**
 * Same-origin BFF action. It derives the submitter, record ID, timestamp, and
 * idempotency key on the server after session verification, so none can be
 * forged by a browser form.
 */
export function createEditorSourceSubmissionRouteHandler(
  dependencies: EditorSourceSubmissionRouteDependencies,
): (request: Request) => Promise<Response> {
  const now = dependencies.now ?? (() => new Date());
  const newId = dependencies.newId ?? crypto.randomUUID;

  return async (request) => {
    const draft = readDraft(await jsonRequestBody(request));
    if (!draft) return invalidRequestResponse();

    let editor: EditorIdentity;
    try {
      editor = await dependencies.requireEditor();
    } catch (error) {
      if (error instanceof EditorAuthenticationRequiredError) return signInRequiredResponse();
      if (error instanceof EditorAccessDeniedError) return accessDeniedResponse();
      return unavailableResponse();
    }

    const submissionId = newId();
    if (!isUuid(submissionId)) return unavailableResponse();
    const submittedAt = now().toISOString();
    try {
      const submission = await dependencies.sourceSubmissions.queue({
        idempotencyKey: `source-submission:${submissionId}`,
        submission: {
          id: submissionId,
          kind: draft.kind,
          originalIdentifier: draft.originalIdentifier,
          // The editor identity is derived server-side; the form has no field
          // for it and this is never inferred from a browser-provided email.
          submittedBy: editor.actorId,
          submittedAt,
          rightsNote: draft.rightsNote,
          ...(draft.transcriptText ? { transcriptText: draft.transcriptText } : {}),
        },
      });
      return Response.json({ submission }, { status: 202 });
    } catch {
      return unavailableResponse();
    }
  };
}

function readDraft(value: unknown): SourceSubmissionDraft | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ["kind", "originalIdentifier", "rightsNote", "transcriptText"]) || !("kind" in value && "originalIdentifier" in value && "rightsNote" in value)) return undefined;
  if (!isKind(value.kind) || !boundedText(value.originalIdentifier, 2_048) || !boundedText(value.rightsNote, 2_000) || ("transcriptText" in value && !boundedText(value.transcriptText, 100_000)) || (value.kind !== "transcript" && "transcriptText" in value)) {
    return undefined;
  }
  return {
    kind: value.kind,
    originalIdentifier: value.originalIdentifier.trim(),
    rightsNote: value.rightsNote.trim(),
    ...("transcriptText" in value ? { transcriptText: (value.transcriptText as string).trim() } : {}),
  };
}

async function jsonRequestBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function hasOnlyKeys(value: Record<string, unknown>, keys: ReadonlyArray<string>): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isKind(value: unknown): value is SourceSubmissionKind {
  return typeof value === "string" && kinds.has(value as SourceSubmissionKind);
}

function boundedText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidRequestResponse(): Response {
  return Response.json(
    { error: { code: "invalid_request", message: "Check the material details and try again." } },
    { status: 400 },
  );
}

function signInRequiredResponse(): Response {
  return Response.json(
    { error: { code: "editor_sign_in_required", message: "Sign in to submit material." } },
    { status: 401 },
  );
}

function accessDeniedResponse(): Response {
  return Response.json(
    { error: { code: "editor_access_denied", message: "This account cannot submit material." } },
    { status: 403 },
  );
}

function unavailableResponse(): Response {
  return Response.json(
    { error: { code: "source_submission_unavailable", message: "Material could not be queued. Try again shortly." } },
    { status: 503 },
  );
}
