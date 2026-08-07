import "server-only";

import { randomUUID } from "node:crypto";

import type { EditorIdentity } from "@/modules/auth/editor-auth";
import type { TemplateV1RevisionContent } from "@/modules/editorial/create-human-revision-command";

import { createPrivateApiClient, PrivateApiClientError, type PrivateApiClient } from "./private-api-client";

export type HumanRevisionSubmission =
  | Readonly<{ kind: "success"; revisionId: string; sequence: number }>
  | Readonly<{ kind: "invalid" | "rejected" | "unavailable"; message: string }>;

export type HumanRevisionTransport = Readonly<{
  create(input: Readonly<{
    briefingId: string; expectedRevisionId: string; actorId: string; idempotencyKey: string; content: TemplateV1RevisionContent; note?: string;
  }>): Promise<Readonly<{ revisionId: string; sequence: number }>>;
}>;

export async function createHumanRevision(
  editor: EditorIdentity,
  input: Readonly<{ briefingId: string; expectedRevisionId: string; content: TemplateV1RevisionContent; note?: string }>,
  dependencies: Readonly<{ transport?: HumanRevisionTransport; environment?: Readonly<Record<string, string | undefined>>; idempotencyKey?: () => string }> = {},
): Promise<HumanRevisionSubmission> {
  if (!id(input.briefingId) || !id(input.expectedRevisionId)) return { kind: "invalid", message: "This Briefing revision is no longer valid. Reload the page and try again." };
  if (input.note !== undefined && (!input.note.trim() || input.note.trim().length > 2_000)) return { kind: "invalid", message: "The revision note must be plain text of at most 2,000 characters." };
  try {
    const result = await (dependencies.transport ?? transportFromEnvironment(dependencies.environment)).create({
      ...input, actorId: editor.actorId, idempotencyKey: (dependencies.idempotencyKey ?? randomUUID)(), ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    });
    return { kind: "success", revisionId: result.revisionId, sequence: result.sequence };
  } catch (error) {
    if (error instanceof PrivateApiClientError && ["not_found", "conflict", "validation_failed", "bad_request"].includes(error.code)) return { kind: "rejected", message: "This revision was not saved. Reload the Briefing, then review the current draft and evidence." };
    return { kind: "unavailable", message: "The editorial service is unavailable. No revision was saved; try again shortly." };
  }
}

export function createHumanRevisionBff(privateApi: Pick<PrivateApiClient, "command">): HumanRevisionTransport {
  return { async create(input) {
    const response = await privateApi.command<unknown>({ path: `/v1/editorial/briefings/${encodeURIComponent(input.briefingId)}/revisions`, method: "POST", body: {
      expectedRevisionId: input.expectedRevisionId, actorId: input.actorId, idempotencyKey: input.idempotencyKey, content: input.content, ...(input.note ? { note: input.note } : {}),
    } });
    if (!record(response) || !id(response.revisionId) || typeof response.sequence !== "number" || !Number.isInteger(response.sequence)) throw new Error("The private API returned an invalid human revision response.");
    return { revisionId: response.revisionId, sequence: response.sequence };
  } };
}

function transportFromEnvironment(environment: Readonly<Record<string, string | undefined>> = process.env): HumanRevisionTransport {
  const baseUrl = environment.PRIVATE_API_BASE_URL?.trim(); const serviceCredential = environment.PRIVATE_API_SERVICE_CREDENTIAL?.trim();
  if (!baseUrl || !serviceCredential) throw new Error("Private API configuration is required before saving a Briefing revision.");
  return createHumanRevisionBff(createPrivateApiClient({ baseUrl, serviceCredential }));
}
function id(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
