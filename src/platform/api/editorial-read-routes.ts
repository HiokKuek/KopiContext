import type { FastifyInstance } from "fastify";

import type {
  EditorialBriefingReview,
  EditorialReadRepository,
  EditorialWorkQueue,
} from "@/modules/editorial/editorial-read-model";

export type EditorialReadRouteDependencies = Readonly<{
  editorialReadModels: EditorialReadRepository;
  invalidRequest: (message: string) => Error;
  notFound: () => Error;
}>;

/**
 * Registers editor-only query routes. App-level service authentication protects
 * both paths; this adapter further projects the model so raw preparation
 * inputs, processor output, and accidental adapter fields cannot cross HTTP.
 */
export function registerEditorialReadRoutes(
  app: FastifyInstance,
  dependencies: EditorialReadRouteDependencies,
): void {
  app.get("/v1/editorial/work", async () =>
    serializeWorkQueue(await dependencies.editorialReadModels.listEditorialWork()),
  );

  app.get<{ Params: unknown }>("/v1/editorial/briefings/:briefingId", async (request) => {
    const briefingId = readBriefingId((request.params as Record<string, unknown>).briefingId);
    const briefing = await dependencies.editorialReadModels.getEditorialBriefing(briefingId);
    if (!briefing) throw dependencies.notFound();
    return serializeEditorialBriefing(briefing);
  });

  function readBriefingId(value: unknown): string {
    if (typeof value !== "string" || !value.trim() || value.length > 200) {
      throw dependencies.invalidRequest("briefingId must be a non-empty string.");
    }
    return value.trim();
  }
}

function serializeWorkQueue(queue: EditorialWorkQueue): EditorialWorkQueue {
  return {
    countsByStatus: { ...queue.countsByStatus },
    items: queue.items.map((item) => ({
      briefingId: item.briefingId,
      title: item.title,
      topicTitle: item.topicTitle,
      status: item.status,
      revisionId: item.revisionId,
      revisionCreatedAt: item.revisionCreatedAt,
      freshness: { ...item.freshness },
      completeness: { ...item.completeness },
    })),
  };
}

function serializeEditorialBriefing(briefing: EditorialBriefingReview): EditorialBriefingReview {
  return {
    briefing: {
      id: briefing.briefing.id,
      title: briefing.briefing.title,
      topic: { ...briefing.briefing.topic },
      status: briefing.briefing.status,
    },
    revision: {
      id: briefing.revision.id,
      sequence: briefing.revision.sequence,
      templateVersion: briefing.revision.templateVersion,
      content: structuredClone(briefing.revision.content),
      origin: briefing.revision.origin,
      createdBy: briefing.revision.createdBy,
      createdAt: briefing.revision.createdAt,
    },
    templateSections: briefing.templateSections.map((section) => ({ ...section })),
    claims: briefing.claims.map((claim) => ({
      id: claim.id,
      statement: claim.statement,
      status: claim.status,
      supports: claim.supports.map((support) => ({ ...support })),
    })),
    acceptedSources: briefing.acceptedSources.map((source) => ({
      id: source.id,
      title: source.title,
      publisher: source.publisher,
      sourceType: source.sourceType,
      canonicalUrl: source.canonicalUrl,
      ...(source.externalIdentifier ? { externalIdentifier: source.externalIdentifier } : {}),
      ...(source.publishedAt ? { publishedAt: source.publishedAt } : {}),
      retrievedAt: source.retrievedAt,
      relation: source.relation,
      rightsNote: source.rightsNote,
      acceptedBy: source.acceptedBy,
      acceptedAt: source.acceptedAt,
      ...(source.submission
        ? {
            submission: {
              id: source.submission.id,
              kind: source.submission.kind,
              originalIdentifier: source.submission.originalIdentifier,
              ...(source.submission.originalUrl ? { originalUrl: source.submission.originalUrl } : {}),
              submittedBy: source.submission.submittedBy,
              submittedAt: source.submission.submittedAt,
              ...(source.submission.retrievedAt ? { retrievedAt: source.submission.retrievedAt } : {}),
              rightsNote: source.submission.rightsNote,
              processingStatus: source.submission.processingStatus,
              ...(source.submission.proposedTopic ? { proposedTopic: source.submission.proposedTopic } : {}),
              ...(source.submission.proposedSubtopic ? { proposedSubtopic: source.submission.proposedSubtopic } : {}),
              ...(source.submission.classificationConfidence === undefined
                ? {}
                : { classificationConfidence: source.submission.classificationConfidence }),
              ...(source.submission.classificationRationale
                ? { classificationRationale: source.submission.classificationRationale }
                : {}),
            },
          }
        : {}),
    })),
    freshness: { ...briefing.freshness },
    auditRecords: briefing.auditRecords.map((record) => ({ ...record })),
    allowedActions: [...briefing.allowedActions],
  };
}
