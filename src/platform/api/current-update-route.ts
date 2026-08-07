import type { FastifyInstance } from "fastify";
import { createCurrentUpdateCommand } from "@/modules/editorial/create-current-update-command";

export function registerCurrentUpdateRoute(app: FastifyInstance, dependencies: Readonly<{ updates: Pick<ReturnType<typeof createCurrentUpdateCommand>, "create">; now: () => Date; invalid: (message: string) => Error; notFound: () => Error; conflict: () => Error; rejected: () => Error }>) {
  app.post<{ Params: unknown; Body: unknown }>("/v1/editorial/briefings/:briefingId/current-updates", async (request, reply) => {
    const briefingId = uuid((request.params as Record<string, unknown>).briefingId, "briefingId", dependencies.invalid);
    const body = record(request.body) ? request.body : undefined;
    if (!body || Object.keys(body).some((key) => !["idempotencyKey", "actorId", "title", "body", "effectiveAt"].includes(key))) throw dependencies.invalid("Request body is invalid.");
    const outcome = await dependencies.updates.create({ idempotencyKey: text(body.idempotencyKey, "idempotencyKey", dependencies.invalid), briefingId, actorId: text(body.actorId, "actorId", dependencies.invalid), title: text(body.title, "title", dependencies.invalid), body: text(body.body, "body", dependencies.invalid), effectiveAt: text(body.effectiveAt, "effectiveAt", dependencies.invalid), occurredAt: dependencies.now().toISOString() });
    if (!outcome.ok) { if (outcome.reason === "briefing-not-found") throw dependencies.notFound(); if (outcome.reason === "idempotency-conflict") throw dependencies.conflict(); throw dependencies.rejected(); }
    return reply.code(outcome.kind === "created" ? 201 : 200).send({ kind: outcome.kind, currentUpdateId: outcome.currentUpdateId });
  });
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(value: unknown, name: string, invalid: (message: string) => Error): string { if (typeof value !== "string" || !value.trim()) throw invalid(`${name} must be a non-empty string.`); return value.trim(); }
function uuid(value: unknown, name: string, invalid: (message: string) => Error): string { if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw invalid(`${name} must be a UUID.`); return value; }
