import "server-only";

import type { EditorIdentity } from "@/modules/auth/editor-auth";
import type {
  EditorialBriefingReview,
  EditorialWorkflowAction,
} from "@/modules/editorial/editorial-read-model";

import {
  createPrivateApiClient,
  PrivateApiClientError,
  type PrivateApiClient,
} from "./private-api-client";

export type EditorialReviewQueryTransport = Readonly<{
  getBriefing(editor: EditorIdentity, briefingId: string): Promise<EditorialBriefingReview | undefined>;
  transition(
    editor: EditorIdentity,
    briefingId: string,
    action: EditorialWorkflowAction,
    reason?: string,
  ): Promise<Readonly<{ status: string }>>;
}>;

export type EditorialReviewState =
  | Readonly<{ kind: "available"; review: EditorialBriefingReview }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "unavailable" }>;

export type EditorialTransitionSubmission =
  | Readonly<{ kind: "success"; status: string }>
  | Readonly<{ kind: "rejected"; message: string }>
  | Readonly<{ kind: "unavailable"; message: string }>
  | Readonly<{ kind: "invalid"; message: string }>;

const targets: Readonly<Record<EditorialWorkflowAction, string>> = {
  "move-to-needs-verification": "needs-verification",
  "start-editorial-review": "in-editorial-review",
  "return-to-draft": "draft",
  approve: "approved",
  publish: "published",
  archive: "archived",
  restore: "approved",
};

export function createEditorialReviewBff(
  privateApi: Pick<PrivateApiClient, "query" | "command">,
): EditorialReviewQueryTransport {
  return {
    async getBriefing(_editor, briefingId) {
      const response = await privateApi.query<unknown>({
        path: `/v1/editorial/briefings/${encodeURIComponent(briefingId)}`,
      });
      if (!isEditorialBriefingReview(response)) {
        throw new Error("The private API returned an invalid editorial Briefing review.");
      }
      return response;
    },
    async transition(editor, briefingId, action, reason) {
      const response = await privateApi.command<unknown>({
        path: `/v1/editorial/briefings/${encodeURIComponent(briefingId)}/transitions`,
        method: "POST",
        // This body is deliberately assembled on the server. In particular,
        // no `actorId` is accepted from FormData or any browser payload.
        body: {
          to: targets[action],
          actorId: editor.actorId,
          ...(reason ? { reason } : {}),
        },
      });
      if (!isTransitionResponse(response)) {
        throw new Error("The private API returned an invalid transition response.");
      }
      return response;
    },
  };
}

export async function loadEditorialBriefingReview(
  editor: EditorIdentity,
  briefingId: string,
  dependencies: Readonly<{ transport?: EditorialReviewQueryTransport; environment?: Readonly<Record<string, string | undefined>> }> = {},
): Promise<EditorialReviewState> {
  if (!isBriefingId(briefingId)) return { kind: "not-found" };
  try {
    const transport = dependencies.transport ?? createEditorialReviewBffFromEnvironment(dependencies.environment);
    const review = await transport.getBriefing(editor, briefingId);
    return review ? { kind: "available", review } : { kind: "not-found" };
  } catch (error) {
    if (error instanceof PrivateApiClientError && error.code === "not_found") {
      return { kind: "not-found" };
    }
    return { kind: "unavailable" };
  }
}

export async function submitEditorialTransition(
  editor: EditorIdentity,
  briefingId: string,
  action: unknown,
  reason: unknown,
  confirmation: unknown,
  dependencies: Readonly<{ transport?: EditorialReviewQueryTransport; environment?: Readonly<Record<string, string | undefined>> }> = {},
): Promise<EditorialTransitionSubmission> {
  if (!isBriefingId(briefingId) || !isEditorialWorkflowAction(action)) {
    return { kind: "invalid", message: "This review action is no longer valid. Reload the Briefing and try again." };
  }
  if (action === "publish" && confirmation !== "publish") {
    return { kind: "invalid", message: "Confirm publication before publishing this Briefing." };
  }

  const preparedReason = normaliseReason(reason);
  if (requiresReason(action) && !preparedReason) {
    return { kind: "invalid", message: "Add a short reason before making this change." };
  }
  if (preparedReason === undefined && reason !== null && reason !== undefined && reason !== "") {
    return { kind: "invalid", message: "The reason must be plain text of 2,000 characters or fewer." };
  }

  try {
    const transport = dependencies.transport ?? createEditorialReviewBffFromEnvironment(dependencies.environment);
    const result = await transport.transition(editor, briefingId, action, preparedReason);
    return { kind: "success", status: result.status };
  } catch (error) {
    if (error instanceof PrivateApiClientError && ["conflict", "validation_failed", "bad_request"].includes(error.code)) {
      return { kind: "rejected", message: "This change was not applied. Reload the Briefing and review its current state." };
    }
    return { kind: "unavailable", message: "The editorial service is unavailable. No change was made; try again shortly." };
  }
}

export function createEditorialReviewBffFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): EditorialReviewQueryTransport {
  return createEditorialReviewBff(createPrivateApiClient({
    baseUrl: requiredEnvironmentValue(environment, "PRIVATE_API_BASE_URL"),
    serviceCredential: requiredEnvironmentValue(environment, "PRIVATE_API_SERVICE_CREDENTIAL"),
  }));
}

function requiresReason(action: EditorialWorkflowAction): boolean {
  return action === "return-to-draft" || action === "move-to-needs-verification" || action === "archive";
}

function normaliseReason(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 2_000 ? trimmed : undefined;
}

function isBriefingId(value: string): boolean {
  return value.trim().length > 0 && value.length <= 200;
}

function isEditorialWorkflowAction(value: unknown): value is EditorialWorkflowAction {
  return typeof value === "string" && value in targets;
}

function isTransitionResponse(value: unknown): value is Readonly<{ status: string }> {
  return isRecord(value) && typeof value.status === "string";
}

function isEditorialBriefingReview(value: unknown): value is EditorialBriefingReview {
  if (!isRecord(value) || !isRecord(value.briefing) || !isRecord(value.revision)) return false;
  return (
    typeof value.briefing.id === "string"
    && typeof value.briefing.title === "string"
    && typeof value.briefing.status === "string"
    && typeof value.revision.id === "string"
    && typeof value.revision.sequence === "number"
    && Array.isArray(value.templateSections)
    && Array.isArray(value.claims)
    && Array.isArray(value.acceptedSources)
    && Array.isArray(value.auditRecords)
    && Array.isArray(value.allowedActions)
    && isRecord(value.freshness)
  );
}

function requiredEnvironmentValue(
  environment: Readonly<Record<string, string | undefined>>,
  name: "PRIVATE_API_BASE_URL" | "PRIVATE_API_SERVICE_CREDENTIAL",
): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} must be configured before the editor can contact the private API.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
