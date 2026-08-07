import "server-only";

import { randomUUID } from "node:crypto";

import type { EditorIdentity } from "@/modules/auth/editor-auth";
import { createPrivateApiClient, PrivateApiClientError, type PrivateApiClient } from "./private-api-client";

export type PreparedProposalAcceptanceTransport = Readonly<{
  accept(input: Readonly<{ submissionId: string; actorId: string; idempotencyKey: string; expectedOutputFingerprint: string; topic: Readonly<{ slug: string; description: string }> }>): Promise<Readonly<{ briefingId: string }>>;
}>;
export type PreparedProposalAcceptanceResult = Readonly<{ kind: "success"; briefingId: string }> | Readonly<{ kind: "rejected"; message: string }> | Readonly<{ kind: "unavailable"; message: string }> | Readonly<{ kind: "invalid"; message: string }>;

export function createPreparedProposalAcceptanceBff(privateApi: Pick<PrivateApiClient, "command">): PreparedProposalAcceptanceTransport {
  return { async accept(input) {
    const response = await privateApi.command<unknown>({ path: `/v1/editorial/source-submissions/${encodeURIComponent(input.submissionId)}/acceptance`, method: "POST", body: input });
    if (!record(response) || typeof response.briefingId !== "string") throw new Error("The private API returned an invalid proposal acceptance response.");
    return { briefingId: response.briefingId };
  } };
}

export async function acceptPreparedProposal(editor: EditorIdentity, input: Readonly<{ submissionId: string; expectedOutputFingerprint: string; topicSlug: unknown; topicDescription: unknown; confirmed: unknown }>, dependencies: Readonly<{ transport?: PreparedProposalAcceptanceTransport; environment?: Readonly<Record<string, string | undefined>>; idempotencyKey?: () => string }> = {}): Promise<PreparedProposalAcceptanceResult> {
  const slug = text(input.topicSlug); const description = text(input.topicDescription);
  if (input.confirmed !== "accept-proposal") return { kind: "invalid", message: "Confirm that this creates a new draft Briefing before continuing." };
  if (!uuid(input.submissionId) || !/^sha256:[a-f0-9]{64}$/.test(input.expectedOutputFingerprint)) return { kind: "invalid", message: "This prepared proposal is no longer valid. Reload it before accepting." };
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !description || description.length > 2_000) return { kind: "invalid", message: "Provide a lowercase Topic slug and a concise Topic description before accepting." };
  try {
    const transport = dependencies.transport ?? fromEnvironment(dependencies.environment);
    const result = await transport.accept({ submissionId: input.submissionId, actorId: editor.actorId, idempotencyKey: (dependencies.idempotencyKey ?? randomUUID)(), expectedOutputFingerprint: input.expectedOutputFingerprint, topic: { slug, description } });
    return { kind: "success", briefingId: result.briefingId };
  } catch (error) {
    if (error instanceof PrivateApiClientError && ["not_found", "conflict", "validation_failed", "bad_request"].includes(error.code)) return { kind: "rejected", message: "This proposal was not accepted. Reload it and review the latest material before trying again." };
    return { kind: "unavailable", message: "The editorial service is unavailable. No draft Briefing was created; try again shortly." };
  }
}
function fromEnvironment(environment: Readonly<Record<string, string | undefined>> = process.env): PreparedProposalAcceptanceTransport { const baseUrl=environment.PRIVATE_API_BASE_URL?.trim(),serviceCredential=environment.PRIVATE_API_SERVICE_CREDENTIAL?.trim(); if(!baseUrl||!serviceCredential) throw new Error("Private API configuration is required."); return createPreparedProposalAcceptanceBff(createPrivateApiClient({baseUrl,serviceCredential})); }
function text(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function uuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
