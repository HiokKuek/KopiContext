import type { FastifyInstance } from "fastify";

import { attachCurrentUpdateSupportCommand } from "@/modules/evidence/attach-current-update-support-command";

export function registerCurrentUpdateSupportRoute(
  app: FastifyInstance,
  dependencies: Readonly<{
    supports: Pick<ReturnType<typeof attachCurrentUpdateSupportCommand>, "attach">;
    now: () => Date;
    invalid: (message: string) => Error;
    notFound: () => Error;
    conflict: () => Error;
    rejected: () => Error;
  }>,
) {
  app.post<{ Params: unknown; Body: unknown }>(
    "/v1/editorial/current-updates/:currentUpdateId/supports",
    async (request, reply) => {
      const currentUpdateId = uuid(
        (request.params as Record<string, unknown>).currentUpdateId,
        "currentUpdateId",
        dependencies.invalid,
      );
      const body = isRecord(request.body) ? request.body : undefined;
      if (!body || Object.keys(body).some((key) => !["idempotencyKey", "actorId", "acceptedSourceId", "excerpt", "rationale"].includes(key))) {
        throw dependencies.invalid("Request body is invalid.");
      }

      const outcome = await dependencies.supports.attach({
        idempotencyKey: text(body.idempotencyKey, "idempotencyKey", dependencies.invalid),
        currentUpdateId,
        acceptedSourceId: uuid(body.acceptedSourceId, "acceptedSourceId", dependencies.invalid),
        excerpt: text(body.excerpt, "excerpt", dependencies.invalid),
        rationale: text(body.rationale, "rationale", dependencies.invalid),
        actorId: text(body.actorId, "actorId", dependencies.invalid),
        occurredAt: dependencies.now().toISOString(),
      });

      if (!outcome.ok) {
        if (outcome.reason === "source-not-found") throw dependencies.notFound();
        if (outcome.reason === "idempotency-conflict" || outcome.reason === "update-conflict") {
          throw dependencies.conflict();
        }
        throw dependencies.rejected();
      }

      return reply.code(outcome.kind === "created" ? 201 : 200).send(outcome);
    },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, name: string, invalid: (message: string) => Error): string {
  if (typeof value !== "string" || !value.trim()) throw invalid(`${name} must be a non-empty string.`);
  return value.trim();
}

function uuid(value: unknown, name: string, invalid: (message: string) => Error): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw invalid(`${name} must be a UUID.`);
  }
  return value;
}
