import "server-only";
import { randomUUID } from "node:crypto";
import type { EditorIdentity } from "@/modules/auth/editor-auth";
import type { TemplateV1RevisionContent } from "@/modules/editorial/create-human-revision-command";
import { createPrivateApiClient, PrivateApiClientError, type PrivateApiClient } from "./private-api-client";

export type EditorialDraftSubmission = Readonly<{ kind: "success"; briefingId: string; revisionId: string }> | Readonly<{ kind: "invalid" | "rejected" | "unavailable"; message: string }>;
export async function createEditorialDraft(editor: EditorIdentity, input: Readonly<{ topic: Readonly<{ slug: string; title: string; description: string }>; content: TemplateV1RevisionContent }>, dependencies: Readonly<{ transport?: { create(value: unknown): Promise<{ briefingId: string; revisionId: string }> }; environment?: Readonly<Record<string, string | undefined>> }> = {}): Promise<EditorialDraftSubmission> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.topic.slug) || !input.topic.title.trim() || !input.topic.description.trim()) return { kind: "invalid", message: "Use a lowercase Topic slug plus a title and description." };
  try { const result = await (dependencies.transport ?? transport(dependencies.environment)).create({ idempotencyKey: randomUUID(), actorId: editor.actorId, topic: input.topic, content: input.content }); return { kind: "success", briefingId: result.briefingId, revisionId: result.revisionId }; }
  catch (error) { if (error instanceof PrivateApiClientError && ["conflict", "validation_failed", "bad_request"].includes(error.code)) return { kind: "rejected", message: "The Draft was not created. Check the Topic and try again." }; return { kind: "unavailable", message: "The editorial service is unavailable. No Draft was created." }; }
}
function transport(env: Readonly<Record<string, string | undefined>> = process.env) { const baseUrl = env.PRIVATE_API_BASE_URL?.trim(), serviceCredential = env.PRIVATE_API_SERVICE_CREDENTIAL?.trim(); if (!baseUrl || !serviceCredential) throw new Error("Private API configuration is required before creating a Draft."); return createEditorialDraftBff(createPrivateApiClient({ baseUrl, serviceCredential })); }
export function createEditorialDraftBff(api: Pick<PrivateApiClient, "command">) { return { async create(value: unknown) { const response = await api.command<unknown>({ path: "/v1/editorial/briefings", method: "POST", body: value }); if (!record(response) || !id(response.briefingId) || !id(response.revisionId)) throw new Error("The private API returned an invalid Draft response."); return { briefingId: response.briefingId, revisionId: response.revisionId }; } }; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function id(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
