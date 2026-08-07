import type { FastifyInstance } from "fastify";

import { type EditorialStatus } from "@/modules/editorial/editorial-workflow";
import { createCurrentUpdateWorkflowCommand } from "@/modules/editorial/current-update-workflow-command";

const statuses = ["draft", "needs-verification", "in-editorial-review", "approved", "published", "archived"] as const;

export function registerCurrentUpdateTransitionRoute(
  app: FastifyInstance,
  dependencies: Readonly<{
    transitions: Pick<ReturnType<typeof createCurrentUpdateWorkflowCommand>, "transition">;
    now: () => Date;
    invalid: (message: string) => Error;
    notFound: () => Error;
    rejected: () => Error;
  }>,
) {
  app.post<{ Params: unknown; Body: unknown }>(
    "/v1/editorial/current-updates/:currentUpdateId/transitions",
    async (request) => {
      const currentUpdateId = identifier(
        (request.params as Record<string, unknown>).currentUpdateId,
        "currentUpdateId",
        dependencies.invalid,
      );
      const body = isRecord(request.body) ? request.body : undefined;
      if (!body || Object.keys(body).some((key) => !["to", "actorId", "reason"].includes(key))) {
        throw dependencies.invalid("Request body is invalid.");
      }
      if (typeof body.to !== "string" || !statuses.includes(body.to as EditorialStatus)) {
        throw dependencies.invalid("to must be a valid editorial status.");
      }

      const outcome = await dependencies.transitions.transition({
        currentUpdateId,
        to: body.to as EditorialStatus,
        actorId: identifier(body.actorId, "actorId", dependencies.invalid),
        ...(body.reason === undefined ? {} : { reason: optionalReason(body.reason, dependencies.invalid) }),
        occurredAt: dependencies.now().toISOString(),
      });
      if (!outcome.ok) {
        if (outcome.reason === "current-update-not-found") throw dependencies.notFound();
        throw dependencies.rejected();
      }
      return outcome;
    },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function identifier(value: unknown, name: string, invalid: (message: string) => Error): string {
  if (typeof value !== "string" || !value.trim() || value.length > 200) {
    throw invalid(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalReason(value: unknown, invalid: (message: string) => Error): string | undefined {
  if (typeof value !== "string" || value.trim().length > 2_000) {
    throw invalid("reason must be plain text of 2,000 characters or fewer.");
  }
  return value.trim() || undefined;
}
