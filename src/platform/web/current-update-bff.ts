import "server-only";

import { randomUUID } from "node:crypto";

import type { EditorIdentity } from "@/modules/auth/editor-auth";

import {
  createPrivateApiClient,
  PrivateApiClientError,
  type PrivateApiClient,
} from "./private-api-client";

export type CurrentUpdateSubmission =
  | Readonly<{ kind: "success"; currentUpdateId: string; supportId: string }>
  | Readonly<{ kind: "invalid" | "rejected" | "unavailable"; message: string }>;

/**
 * Creates a Current Update and immediately attaches its reviewed evidence.
 * Both private API calls remain independently idempotent; this BFF never
 * changes status or performs publication on the editor's behalf.
 */
export async function createCurrentUpdateWithSupport(
  editor: EditorIdentity,
  input: Readonly<{
    briefingId: string;
    title: string;
    body: string;
    effectiveAt: string;
    acceptedSourceId: string;
    excerpt: string;
    rationale: string;
  }>,
  dependencies: Readonly<{
    api?: Pick<PrivateApiClient, "command">;
    env?: Readonly<Record<string, string | undefined>>;
    idempotencyKey?: () => string;
  }> = {},
): Promise<CurrentUpdateSubmission> {
  if (!isValid(input)) {
    return {
      kind: "invalid",
      message: "Add a title, explanation, effective date, accepted Source, exact excerpt, and rationale.",
    };
  }

  try {
    const api = dependencies.api ?? createPrivateApiClient({
      baseUrl: required(dependencies.env, "PRIVATE_API_BASE_URL"),
      serviceCredential: required(dependencies.env, "PRIVATE_API_SERVICE_CREDENTIAL"),
    });
    const idempotencyKey = dependencies.idempotencyKey ?? randomUUID;
    const created = await api.command<unknown>({
      path: `/v1/editorial/briefings/${encodeURIComponent(input.briefingId)}/current-updates`,
      method: "POST",
      body: {
        idempotencyKey: idempotencyKey(),
        actorId: editor.actorId,
        title: input.title.trim(),
        body: input.body.trim(),
        effectiveAt: new Date(input.effectiveAt).toISOString(),
      },
    });
    if (!isRecord(created) || !isUuid(created.currentUpdateId)) {
      throw new Error("The private API returned an invalid Current Update response.");
    }

    const attached = await api.command<unknown>({
      path: `/v1/editorial/current-updates/${encodeURIComponent(created.currentUpdateId)}/supports`,
      method: "POST",
      body: {
        idempotencyKey: idempotencyKey(),
        actorId: editor.actorId,
        acceptedSourceId: input.acceptedSourceId,
        excerpt: input.excerpt.trim(),
        rationale: input.rationale.trim(),
      },
    });
    if (!isRecord(attached) || !isUuid(attached.supportId)) {
      throw new Error("The private API returned an invalid Current Update evidence response.");
    }

    return {
      kind: "success",
      currentUpdateId: created.currentUpdateId,
      supportId: attached.supportId,
    };
  } catch (error) {
    if (
      error instanceof PrivateApiClientError
      && ["conflict", "not_found", "validation_failed", "bad_request"].includes(error.code)
    ) {
      return {
        kind: "rejected",
        message: "This Current Update was not saved. Refresh the Briefing and check the Source and evidence.",
      };
    }
    return {
      kind: "unavailable",
      message: "The editorial service is unavailable. The update was not sent for review.",
    };
  }
}

function isValid(input: Readonly<Record<string, string>>): boolean {
  return (
    Object.values(input).every((value) => value.trim().length > 0)
    && !Number.isNaN(Date.parse(input.effectiveAt))
    && isUuid(input.acceptedSourceId)
  );
}

function required(
  environment: Readonly<Record<string, string | undefined>> | undefined,
  key: string,
): string {
  const value = (environment ?? process.env)[key]?.trim();
  if (!value) throw new Error("Private API configuration is required.");
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
