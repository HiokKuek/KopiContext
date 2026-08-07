import type { FastifyInstance } from "fastify";

import {
  isTemplateV1RevisionContent,
  type CreateHumanRevisionCommand,
  type CreateHumanRevisionRequest,
  type TemplateV1RevisionContent,
} from "@/modules/editorial/create-human-revision-command";

export type HumanRevisionRouteDependencies = Readonly<{
  humanRevisions: Pick<CreateHumanRevisionCommand, "create">;
  now: () => Date;
  invalid: (message: string) => Error;
  notFound: () => Error;
  conflict: () => Error;
  rejected: () => Error;
}>;

type RequestBody = Omit<CreateHumanRevisionRequest, "briefingId" | "occurredAt">;

/**
 * Private-service-only command route. The Vercel BFF derives actorId from the
 * authenticated editor; neither this route nor the browser can alter prior
 * immutable revisions.
 */
export function registerHumanRevisionRoute(app: FastifyInstance, dependencies: HumanRevisionRouteDependencies): void {
  app.post<{ Params: unknown; Body: unknown }>(
    "/v1/editorial/briefings/:briefingId/revisions",
    async (request, reply) => {
      const briefingId = readUuid((request.params as Record<string, unknown>).briefingId, "briefingId", dependencies.invalid);
      const body = readBody(request.body, dependencies.invalid);
      const outcome = await dependencies.humanRevisions.create({
        ...body,
        briefingId,
        occurredAt: dependencies.now().toISOString(),
      });
      if (!outcome.ok) {
        if (outcome.reason === "briefing-not-found") throw dependencies.notFound();
        if (["revision-conflict", "idempotency-conflict"].includes(outcome.reason)) throw dependencies.conflict();
        throw dependencies.rejected();
      }
      return reply.code(outcome.kind === "created" ? 201 : 200).send({
        kind: outcome.kind,
        briefingId: outcome.briefingId,
        revisionId: outcome.revisionId,
        sequence: outcome.sequence,
        creationRecordId: outcome.creationRecordId,
      });
    },
  );
}

function readBody(value: unknown, invalid: (message: string) => Error): RequestBody {
  if (!record(value)) throw invalid("Request body must be a JSON object.");
  const keys = new Set(["idempotencyKey", "expectedRevisionId", "actorId", "content", "note"]);
  if (Object.keys(value).some((key) => !keys.has(key))) throw invalid("Request body contains an unsupported field.");
  const content = readContent(value.content, invalid);
  const note = value.note === undefined ? undefined : readText(value.note, "note", 2_000, invalid);
  return {
    idempotencyKey: readOpaqueKey(value.idempotencyKey, invalid),
    expectedRevisionId: readUuid(value.expectedRevisionId, "expectedRevisionId", invalid),
    actorId: readText(value.actorId, "actorId", 200, invalid),
    content,
    ...(note ? { note } : {}),
  };
}

function readContent(value: unknown, invalid: (message: string) => Error): TemplateV1RevisionContent {
  if (!isTemplateV1RevisionContent(value)) throw invalid("content must be a structurally valid Briefing Template v1 object.");
  const content = value as TemplateV1RevisionContent;
  const strings = [content.oneSentenceExplanation, content.thirtySecondOverview, content.fiveMinuteExplanation, content.whyPeopleCare, content.singaporeSeaAngle];
  if (strings.some((item) => item.length > 20_000) || content.keyTerms.length > 100 || [content.entities, content.debates, content.questionsToAsk, content.mistakesToAvoid].some((items) => items.length > 100)) {
    throw invalid("content exceeds the supported Template v1 limits.");
  }
  if (content.keyTerms.some((term) => term.term.length > 500 || term.definition.length > 4_000) || [content.entities, content.debates, content.questionsToAsk, content.mistakesToAvoid].some((items) => items.some((item) => item.length > 4_000))) {
    throw invalid("content exceeds the supported Template v1 limits.");
  }
  return content;
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
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
