import "server-only";

import type { EditorIdentity } from "@/modules/auth/editor-auth";
import type { EditorialWorkQueue } from "@/modules/editorial/editorial-read-model";

import { createPrivateApiClient, type PrivateApiClient } from "./private-api-client";

const EDITORIAL_WORK_QUEUE_PATH = "/v1/editorial/work";

/**
 * Server-side query seam for the editor's review queue. It intentionally has
 * no browser-facing route: private API credentials stay in the Vercel server
 * runtime and the caller's identity comes from `requireEditorSession()`.
 */
export type EditorialWorkspaceQueryTransport = Readonly<{
  listReviewQueue(editor: EditorIdentity): Promise<EditorialWorkQueue>;
}>;

export type EditorWorkspaceQueueState =
  | Readonly<{ kind: "available"; queue: EditorialWorkQueue }>
  | Readonly<{ kind: "unavailable" }>;

export function createEditorialWorkspaceBff(
  privateApi: Pick<PrivateApiClient, "query">,
): EditorialWorkspaceQueryTransport {
  return {
    async listReviewQueue(_editor) {
      // `_editor` makes the trust boundary explicit. The service credential is
      // intentionally the only private-API credential sent across this hop;
      // future audit-aware commands will derive their actor from this same
      // trusted identity rather than accepting a browser-provided actor ID.
      const response = await privateApi.query<unknown>({ path: EDITORIAL_WORK_QUEUE_PATH });
      if (!isEditorialWorkQueue(response)) {
        throw new Error("The private API returned an invalid editorial work queue.");
      }
      return response;
    },
  };
}

/**
 * Runtime composition for server-rendered editor routes. The private read
 * endpoint is not composed yet, so failures are deliberately shown as a
 * truthful unavailable state instead of a fabricated empty queue.
 */
export async function loadEditorWorkspaceQueue(
  editor: EditorIdentity,
  dependencies: Readonly<{
    transport?: EditorialWorkspaceQueryTransport;
    environment?: Readonly<Record<string, string | undefined>>;
  }> = {},
): Promise<EditorWorkspaceQueueState> {
  try {
    const transport = dependencies.transport ?? createEditorialWorkspaceBffFromEnvironment(dependencies.environment);
    return { kind: "available", queue: await transport.listReviewQueue(editor) };
  } catch {
    // Do not expose private topology, credentials, or response details in the
    // editor UI. The page has a clear retry path and keeps editorial facts out
    // of the browser until the server query succeeds.
    return { kind: "unavailable" };
  }
}

export function createEditorialWorkspaceBffFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): EditorialWorkspaceQueryTransport {
  return createEditorialWorkspaceBff(
    createPrivateApiClient({
      baseUrl: requiredEnvironmentValue(environment, "PRIVATE_API_BASE_URL"),
      serviceCredential: requiredEnvironmentValue(environment, "PRIVATE_API_SERVICE_CREDENTIAL"),
    }),
  );
}

function requiredEnvironmentValue(
  environment: Readonly<Record<string, string | undefined>>,
  name: "PRIVATE_API_BASE_URL" | "PRIVATE_API_SERVICE_CREDENTIAL",
): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be configured before the editor workspace can query the private API.`);
  }
  return value;
}

function isEditorialWorkQueue(value: unknown): value is EditorialWorkQueue {
  if (!isRecord(value) || !isRecord(value.countsByStatus) || !Array.isArray(value.items)) return false;

  const states = ["draft", "needs-verification", "in-editorial-review", "approved", "published", "archived"];
  const countsByStatus = value.countsByStatus;
  if (!states.every((state) => typeof countsByStatus[state] === "number")) return false;

  return value.items.every(isEditorialWorkItem);
}

function isEditorialWorkItem(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.freshness) || !isRecord(value.completeness)) return false;
  return (
    typeof value.briefingId === "string"
    && typeof value.title === "string"
    && typeof value.topicTitle === "string"
    && typeof value.status === "string"
    && typeof value.revisionId === "string"
    && typeof value.revisionCreatedAt === "string"
    && typeof value.freshness.lastActivityAt === "string"
    && typeof value.freshness.reviewAgeDays === "number"
    && typeof value.freshness.isStale === "boolean"
    && typeof value.completeness.isComplete === "boolean"
    && typeof value.completeness.missingSectionCount === "number"
    && typeof value.completeness.claimCount === "number"
    && typeof value.completeness.unsupportedClaimCount === "number"
    && typeof value.completeness.acceptedSourceCount === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
