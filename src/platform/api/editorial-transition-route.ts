import type { FastifyInstance } from "fastify";

const editorialStatuses = [
  "draft",
  "needs-verification",
  "in-editorial-review",
  "approved",
  "published",
  "archived",
] as const;

export type EditorialBriefingStatus = (typeof editorialStatuses)[number];

/**
 * The private HTTP adapter's command port. The editorial module owns the
 * workflow rules; this contract only carries a validated request across the
 * application boundary.
 */
export type EditorialBriefingTransitionCommand = Readonly<{
  transition(
    input: EditorialBriefingTransitionInput,
  ): Promise<EditorialBriefingTransitionResult> | EditorialBriefingTransitionResult;
}>;

export type EditorialBriefingTransitionInput = Readonly<{
  briefingId: string;
  to: EditorialBriefingStatus;
  actorId: string;
  reason?: string;
  occurredAt: string;
}>;

export type EditorialBriefingTransitionResult =
  | Readonly<{
      ok: true;
      briefingId: string;
      revisionId: string;
      status: EditorialBriefingStatus;
      audit: Readonly<{
        from: EditorialBriefingStatus;
        to: EditorialBriefingStatus;
        actorId: string;
        occurredAt: string;
        reason?: string;
      }>;
    }>
  | Readonly<{
      ok: false;
      reason: string;
    }>;

export type EditorialTransitionRouteDependencies = Readonly<{
  editorialBriefingTransitions: EditorialBriefingTransitionCommand;
  now: () => Date;
  invalidRequest: (message: string) => Error;
  rejectedTransition: () => Error;
}>;

type TransitionBody = Readonly<{
  to: EditorialBriefingStatus;
  actorId: string;
  reason?: string;
}>;

/** Registers the authenticated command route; authentication is owned by app.ts. */
export function registerEditorialTransitionRoute(
  app: FastifyInstance,
  dependencies: EditorialTransitionRouteDependencies,
): void {
  app.post<{ Params: unknown; Body: unknown }>(
    "/v1/editorial/briefings/:briefingId/transitions",
    async (request) => {
      const briefingId = readIdentifier((request.params as Record<string, unknown>).briefingId, "briefingId");
      const body = readTransitionBody(request.body);
      const outcome = await dependencies.editorialBriefingTransitions.transition({
        briefingId,
        ...body,
        occurredAt: dependencies.now().toISOString(),
      });

      if (!outcome.ok) {
        throw dependencies.rejectedTransition();
      }

      return {
        briefingId: outcome.briefingId,
        revisionId: outcome.revisionId,
        status: outcome.status,
        audit: outcome.audit,
      };
    },
  );

  function readIdentifier(value: unknown, name: string): string {
    if (typeof value !== "string" || !value.trim() || value.length > 200) {
      throw dependencies.invalidRequest(`${name} must be a non-empty string.`);
    }

    return value.trim();
  }

  function readTransitionBody(body: unknown): TransitionBody {
    if (!isPlainObject(body)) {
      throw dependencies.invalidRequest("Request body must be a JSON object.");
    }

    const allowedKeys = new Set(["to", "actorId", "reason"]);
    if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
      throw dependencies.invalidRequest("Request body contains an unsupported field.");
    }

    if (typeof body.to !== "string" || !editorialStatuses.includes(body.to as EditorialBriefingStatus)) {
      throw dependencies.invalidRequest("to must be a valid editorial status.");
    }

    const actorId = readIdentifier(body.actorId, "actorId");
    if (body.reason !== undefined && (typeof body.reason !== "string" || body.reason.trim().length > 2_000)) {
      throw dependencies.invalidRequest("reason must be a string of at most 2000 characters.");
    }

    return {
      to: body.to as EditorialBriefingStatus,
      actorId,
      ...(body.reason?.trim() ? { reason: body.reason.trim() } : {}),
    };
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
