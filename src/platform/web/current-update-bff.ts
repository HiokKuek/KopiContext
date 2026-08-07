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

export type CurrentUpdateTransitionSubmission =
  | Readonly<{ kind: "success"; status: string }>
  | Readonly<{ kind: "invalid" | "rejected" | "unavailable"; message: string }>;

const transitionTargets = {
  "move-to-needs-verification": "needs-verification",
  "start-editorial-review": "in-editorial-review",
  "return-to-draft": "draft",
  approve: "approved",
  publish: "published",
  archive: "archived",
  restore: "approved",
} as const;

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

export async function submitCurrentUpdateTransition(
  editor: EditorIdentity,
  currentUpdateId: string,
  action: unknown,
  reason: unknown,
  confirmation: unknown,
  dependencies: Readonly<{
    api?: Pick<PrivateApiClient, "command">;
    env?: Readonly<Record<string, string | undefined>>;
  }> = {},
): Promise<CurrentUpdateTransitionSubmission> {
  if (!isUuid(currentUpdateId) || typeof action !== "string" || !(action in transitionTargets)) {
    return { kind: "invalid", message: "This Current Update action is no longer valid. Refresh and try again." };
  }
  if (action === "publish" && confirmation !== "publish") {
    return { kind: "invalid", message: "Confirm publication before publishing this Current Update." };
  }
  if (typeof reason !== "string" && reason !== null && reason !== undefined) {
    return { kind: "invalid", message: "The reason must be plain text of 2,000 characters or fewer." };
  }
  const preparedReason = typeof reason === "string" ? reason.trim() : undefined;
  if ((action === "return-to-draft" || action === "move-to-needs-verification" || action === "archive") && !preparedReason) {
    return { kind: "invalid", message: "Add a short reason before making this change." };
  }
  if (preparedReason && preparedReason.length > 2_000) {
    return { kind: "invalid", message: "The reason must be plain text of 2,000 characters or fewer." };
  }

  try {
    const api = dependencies.api ?? createPrivateApiClient({
      baseUrl: required(dependencies.env, "PRIVATE_API_BASE_URL"),
      serviceCredential: required(dependencies.env, "PRIVATE_API_SERVICE_CREDENTIAL"),
    });
    const value = await api.command<unknown>({
      path: `/v1/editorial/current-updates/${encodeURIComponent(currentUpdateId)}/transitions`,
      method: "POST",
      body: { to: transitionTargets[action as keyof typeof transitionTargets], actorId: editor.actorId, ...(preparedReason ? { reason: preparedReason } : {}) },
    });
    if (!isRecord(value) || typeof value.status !== "string") throw new Error("Invalid Current Update transition response.");
    return { kind: "success", status: value.status };
  } catch (error) {
    if (error instanceof PrivateApiClientError && ["conflict", "not_found", "validation_failed", "bad_request"].includes(error.code)) {
      return { kind: "rejected", message: "This change was not applied. Refresh the Current Update and review its evidence." };
    }
    return { kind: "unavailable", message: "The editorial service is unavailable. No change was made." };
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
