import "server-only";

import { randomUUID } from "node:crypto";

import type { EditorIdentity } from "@/modules/auth/editor-auth";
import type { EditorialClaim } from "@/modules/evidence/create-editorial-claim-command";

import { createPrivateApiClient, PrivateApiClientError, type PrivateApiClient } from "./private-api-client";

export type EditorialClaimSubmission =
  | Readonly<{ kind: "success"; claimId: string; claimSupportId: string }>
  | Readonly<{ kind: "invalid" | "rejected" | "unavailable"; message: string }>;

export async function createEditorialClaim(
  editor: EditorIdentity,
  input: Readonly<{
    briefingId: string;
    briefingRevisionId: string;
    acceptedSourceId: string;
    claim: EditorialClaim;
  }>,
  dependencies: Readonly<{
    api?: Pick<PrivateApiClient, "command">;
    env?: Readonly<Record<string, string | undefined>>;
    idempotencyKey?: () => string;
  }> = {},
): Promise<EditorialClaimSubmission> {
  if (!validInput(input)) {
    return { kind: "invalid", message: "Add a statement, the exact supporting excerpt, and a short rationale." };
  }

  try {
    const api = dependencies.api ?? createPrivateApiClient({
      baseUrl: required(dependencies.env, "PRIVATE_API_BASE_URL"),
      serviceCredential: required(dependencies.env, "PRIVATE_API_SERVICE_CREDENTIAL"),
    });
    const value = await api.command<unknown>({
      path: `/v1/editorial/briefings/${encodeURIComponent(input.briefingId)}/claims`,
      method: "POST",
      body: {
        idempotencyKey: (dependencies.idempotencyKey ?? randomUUID)(),
        briefingRevisionId: input.briefingRevisionId,
        acceptedSourceId: input.acceptedSourceId,
        actorId: editor.actorId,
        claim: input.claim,
      },
    });
    if (!record(value) || !id(value.claimId) || !id(value.claimSupportId)) {
      throw new Error("Invalid Claim response.");
    }
    return { kind: "success", claimId: value.claimId, claimSupportId: value.claimSupportId };
  } catch (error) {
    if (error instanceof PrivateApiClientError && ["conflict", "not_found", "validation_failed", "bad_request"].includes(error.code)) {
      return { kind: "rejected", message: "This Claim was not added. Refresh the Draft and check the selected Source." };
    }
    return { kind: "unavailable", message: "The editorial service is unavailable. No Claim was added." };
  }
}

function validInput(input: Readonly<{ briefingId: string; briefingRevisionId: string; acceptedSourceId: string; claim: EditorialClaim }>): boolean {
  return [input.briefingId, input.briefingRevisionId, input.acceptedSourceId, input.claim.statement, input.claim.excerpt, input.claim.rationale].every((value) => value.trim().length > 0);
}

function required(environment: Readonly<Record<string, string | undefined>> | undefined, key: string): string {
  const value = (environment ?? process.env)[key]?.trim();
  if (!value) throw new Error("Private API configuration is required.");
  return value;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function id(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
