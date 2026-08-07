import type { FastifyInstance } from "fastify";
import type { CreateEditorialDraftRequest } from "@/modules/editorial/create-editorial-draft-command";
import { isTemplateV1RevisionContent, type TemplateV1RevisionContent } from "@/modules/editorial/create-human-revision-command";

export type EditorialDraftRouteDependencies = Readonly<{ editorialDrafts: { create(input: CreateEditorialDraftRequest): Promise<unknown> }; now: () => Date; invalid: (message: string) => Error; conflict: () => Error; rejected: () => Error }>;

export function registerEditorialDraftRoute(app: FastifyInstance, dependencies: EditorialDraftRouteDependencies): void {
  app.post<{ Body: unknown }>("/v1/editorial/briefings", async (request, reply) => {
    const body = read(request.body, dependencies.invalid);
    const result = await dependencies.editorialDrafts.create({ ...body, occurredAt: dependencies.now().toISOString() }) as { ok: boolean; reason?: string; kind?: "created" | "idempotent"; topicId?: string; briefingId?: string; revisionId?: string; creationRecordId?: string };
    if (!result.ok) { if (["topic-conflict", "idempotency-conflict"].includes(result.reason ?? "")) throw dependencies.conflict(); throw dependencies.rejected(); }
    return reply.code(result.kind === "created" ? 201 : 200).send({ kind: result.kind, topicId: result.topicId, briefingId: result.briefingId, revisionId: result.revisionId, creationRecordId: result.creationRecordId });
  });
}

function read(value: unknown, invalid: (message: string) => Error): Omit<CreateEditorialDraftRequest, "occurredAt"> {
  if (!record(value)) throw invalid("Request body must be a JSON object.");
  const keys = new Set(["idempotencyKey", "actorId", "topic", "content"]); if (Object.keys(value).some((key) => !keys.has(key))) throw invalid("Request body contains an unsupported field.");
  if (!record(value.topic) || !text(value.topic.slug, 160) || !text(value.topic.title, 500) || !text(value.topic.description, 2_000)) throw invalid("topic must contain a slug, title, and description.");
  if (!text(value.idempotencyKey, 200) || !text(value.actorId, 200) || !isTemplateV1RevisionContent(value.content)) throw invalid("The Draft request is invalid.");
  return { idempotencyKey: value.idempotencyKey.trim(), actorId: value.actorId.trim(), topic: { slug: value.topic.slug.trim(), title: value.topic.title.trim(), description: value.topic.description.trim() }, content: value.content as TemplateV1RevisionContent };
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(value: unknown, maximum: number): value is string { return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maximum; }
