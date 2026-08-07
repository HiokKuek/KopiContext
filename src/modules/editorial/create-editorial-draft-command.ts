import { isTemplateV1RevisionContent, type TemplateV1RevisionContent } from "./create-human-revision-command";

export type CreateEditorialDraftRequest = Readonly<{
  idempotencyKey: string;
  actorId: string;
  occurredAt: string;
  topic: Readonly<{ slug: string; title: string; description: string }>;
  content: TemplateV1RevisionContent;
}>;

export type CreateEditorialDraftRepository = Readonly<{
  createDraft(input: CreateEditorialDraftRequest & Readonly<{
    status: "draft";
    revision: Readonly<{ templateVersion: "v1"; content: TemplateV1RevisionContent; origin: "human"; createdBy: string }>;
  }>): Promise<
    | Readonly<{ kind: "created" | "idempotent"; topicId: string; briefingId: string; revisionId: string; creationRecordId: string }>
    | Readonly<{ kind: "topic-conflict" | "idempotency-conflict" }>
  >;
}>;

export function createEditorialDraftCommand(repository: CreateEditorialDraftRepository) {
  return { async create(request: CreateEditorialDraftRequest) {
    if (!valid(request)) return { ok: false as const, reason: "invalid-draft" as const };
    const result = await repository.createDraft({ ...request, actorId: request.actorId.trim(), topic: { slug: request.topic.slug.trim(), title: request.topic.title.trim(), description: request.topic.description.trim() }, status: "draft", revision: { templateVersion: "v1", content: request.content, origin: "human", createdBy: request.actorId.trim() } });
    return result.kind === "created" || result.kind === "idempotent" ? { ok: true as const, ...result } : { ok: false as const, reason: result.kind };
  } };
}

function valid(request: CreateEditorialDraftRequest): boolean {
  return /^[A-Za-z0-9._:-]{8,200}$/.test(request.idempotencyKey)
    && request.actorId.trim().length > 0
    && !Number.isNaN(Date.parse(request.occurredAt))
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(request.topic.slug.trim())
    && request.topic.title.trim().length > 0
    && request.topic.description.trim().length > 0
    && isTemplateV1RevisionContent(request.content);
}
