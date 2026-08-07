import type { FastifyInstance } from "fastify";

import type {
  CreateEditorialClaimRequest,
  createEditorialClaimCommand,
} from "@/modules/evidence/create-editorial-claim-command";

export type EditorialClaimRouteDependencies = Readonly<{
  editorialClaims: Pick<ReturnType<typeof createEditorialClaimCommand>, "create">;
  now: () => Date;
  invalid: (message: string) => Error;
  conflict: () => Error;
  notFound: () => Error;
  rejected: () => Error;
}>;

export function registerEditorialClaimRoute(app: FastifyInstance, dependencies: EditorialClaimRouteDependencies): void {
  app.post<{ Params: unknown; Body: unknown }>(
    "/v1/editorial/briefings/:briefingId/claims",
    async (request, reply) => {
      const briefingId = readUuid((request.params as Record<string, unknown>).briefingId, "briefingId", dependencies.invalid);
      const body = readBody(request.body, dependencies.invalid);
      const outcome = await dependencies.editorialClaims.create({
        ...body,
        briefingId,
        occurredAt: dependencies.now().toISOString(),
      });

      if (!outcome.ok) {
        if (outcome.reason === "source-not-found") throw dependencies.notFound();
        if (["briefing-conflict", "idempotency-conflict"].includes(outcome.reason)) throw dependencies.conflict();
        throw dependencies.rejected();
      }

      return reply.code(outcome.kind === "created" ? 201 : 200).send({
        kind: outcome.kind,
        claimId: outcome.claimId,
        claimSupportId: outcome.claimSupportId,
        recordId: outcome.recordId,
      });
    },
  );
}

function readBody(value: unknown, invalid: (message: string) => Error): Omit<CreateEditorialClaimRequest, "briefingId" | "occurredAt"> {
  if (!record(value)) throw invalid("Request body must be a JSON object.");
  const allowed = new Set(["idempotencyKey", "briefingRevisionId", "acceptedSourceId", "actorId", "claim"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw invalid("Request body contains an unsupported field.");
  if (!record(value.claim)) throw invalid("claim must be an object.");

  return {
    idempotencyKey: readOpaqueKey(value.idempotencyKey, invalid),
    briefingRevisionId: readUuid(value.briefingRevisionId, "briefingRevisionId", invalid),
    acceptedSourceId: readUuid(value.acceptedSourceId, "acceptedSourceId", invalid),
    actorId: readText(value.actorId, "actorId", 200, invalid),
    claim: {
      statement: readText(value.claim.statement, "claim.statement", 4_000, invalid),
      excerpt: readText(value.claim.excerpt, "claim.excerpt", 8_000, invalid),
      rationale: readText(value.claim.rationale, "claim.rationale", 4_000, invalid),
    },
  };
}

function readOpaqueKey(value: unknown, invalid: (message: string) => Error): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{8,200}$/.test(value)) throw invalid("idempotencyKey must be an opaque 8–200 character command key.");
  return value;
}

function readUuid(value: unknown, name: string, invalid: (message: string) => Error): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw invalid(`${name} must be a valid UUID.`);
  return value;
}

function readText(value: unknown, name: string, maximum: number, invalid: (message: string) => Error): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) throw invalid(`${name} must be a non-empty string of at most ${maximum} characters.`);
  return value.trim();
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
