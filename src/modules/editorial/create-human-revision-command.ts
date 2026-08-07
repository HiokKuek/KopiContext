/**
 * The editor-owned way to replace an unpublished Briefing draft. A revision is
 * a complete immutable snapshot; this command never mutates an older snapshot
 * and intentionally has no Source Submission or AI-provenance inputs.
 */
import type { BriefingVisualExplainer } from "@/modules/content/published-briefings";

export type TemplateV1RevisionContent = Readonly<{
  oneSentenceExplanation: string;
  thirtySecondOverview: string;
  fiveMinuteExplanation: string;
  whyPeopleCare: string;
  keyTerms: ReadonlyArray<Readonly<{ term: string; definition: string }>>;
  entities: ReadonlyArray<string>;
  debates: ReadonlyArray<string>;
  singaporeSeaAngle: string;
  questionsToAsk: ReadonlyArray<string>;
  mistakesToAvoid: ReadonlyArray<string>;
  /** Optional source-backed orientation components; absence is valid for topics that do not need them. */
  visualExplainers?: ReadonlyArray<BriefingVisualExplainer>;
}>;

export type CurrentBriefingForHumanRevision = Readonly<{
  briefingId: string;
  status: "draft" | "needs-verification" | "in-editorial-review" | "approved" | "published" | "archived";
  currentRevisionId: string;
}>;

export type CreateHumanRevisionRequest = Readonly<{
  idempotencyKey: string;
  briefingId: string;
  /** The current immutable revision observed by the editor before writing. */
  expectedRevisionId: string;
  /** Derived from the authenticated editor session by the transport layer. */
  actorId: string;
  occurredAt: string;
  content: TemplateV1RevisionContent;
  note?: string;
}>;

export type CreateHumanRevisionPersistenceRequest = CreateHumanRevisionRequest & Readonly<{
  templateVersion: "v1";
}>;

export type CreateHumanRevisionPersistenceResult =
  | Readonly<{ kind: "created" | "idempotent"; revisionId: string; sequence: number; creationRecordId: string }>
  | Readonly<{ kind: "briefing-not-found" | "briefing-not-draft" | "revision-conflict" | "idempotency-conflict" }>;

export type HumanRevisionRepository = Readonly<{
  retrieveCurrentBriefing(briefingId: string): Promise<CurrentBriefingForHumanRevision | undefined>;
  createHumanRevision(request: CreateHumanRevisionPersistenceRequest): Promise<CreateHumanRevisionPersistenceResult>;
}>;

export type CreateHumanRevisionResult =
  | Readonly<{ ok: true; kind: "created" | "idempotent"; briefingId: string; revisionId: string; sequence: number; creationRecordId: string }>
  | Readonly<{ ok: false; reason: "revision-requires-editor" | "invalid-template-content" | "briefing-not-found" | "briefing-not-draft" | "revision-conflict" | "idempotency-conflict" }>;

export type CreateHumanRevisionCommand = Readonly<{
  create(request: CreateHumanRevisionRequest): Promise<CreateHumanRevisionResult>;
}>;

/**
 * Creates an immutable human-origin Template v1 revision only from the
 * current Draft. The repository repeats the current-revision check while its
 * Briefing row is locked; this initial read gives the editor a fast, useful
 * failure without replacing that durable guarantee.
 */
export function createHumanRevisionCommand(repository: HumanRevisionRepository): CreateHumanRevisionCommand {
  return {
    async create(request) {
      if (!hasText(request.actorId)) return { ok: false, reason: "revision-requires-editor" };
      if (!isTemplateV1RevisionContent(request.content)) return { ok: false, reason: "invalid-template-content" };

      const briefing = await repository.retrieveCurrentBriefing(request.briefingId);
      if (!briefing) return { ok: false, reason: "briefing-not-found" };
      if (briefing.status !== "draft") return { ok: false, reason: "briefing-not-draft" };
      if (briefing.currentRevisionId !== request.expectedRevisionId) return { ok: false, reason: "revision-conflict" };

      const result = await repository.createHumanRevision({
        ...request,
        actorId: request.actorId.trim(),
        ...(request.note?.trim() ? { note: request.note.trim() } : {}),
        templateVersion: "v1",
      });
      if (result.kind !== "created" && result.kind !== "idempotent") return { ok: false, reason: result.kind };
      return { ok: true, kind: result.kind, briefingId: request.briefingId, revisionId: result.revisionId, sequence: result.sequence, creationRecordId: result.creationRecordId };
    },
  };
}

/** Structural validation allows an editor to save an incomplete Draft, while
 * the existing workflow remains responsible for completeness before publish. */
export function isTemplateV1RevisionContent(value: unknown): value is TemplateV1RevisionContent {
  if (!record(value)) return false;
  return strings(value, ["oneSentenceExplanation", "thirtySecondOverview", "fiveMinuteExplanation", "whyPeopleCare", "singaporeSeaAngle"])
    && stringArray(value.entities)
    && stringArray(value.debates)
    && stringArray(value.questionsToAsk)
    && stringArray(value.mistakesToAvoid)
    && Array.isArray(value.keyTerms)
    && value.keyTerms.every((term) => record(term) && typeof term.term === "string" && typeof term.definition === "string")
    && (value.visualExplainers === undefined || isVisualExplainers(value.visualExplainers));
}

function hasText(value: string): boolean { return value.trim().length > 0; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function strings(value: Record<string, unknown>, keys: ReadonlyArray<string>): boolean { return keys.every((key) => typeof value[key] === "string"); }
function stringArray(value: unknown): value is ReadonlyArray<string> { return Array.isArray(value) && value.every((item) => typeof item === "string"); }

/** Validates the generic shape common to every reader visual before preserving it in an immutable revision. */
function isVisualExplainers(value: unknown): value is ReadonlyArray<BriefingVisualExplainer> {
  return Array.isArray(value) && value.every((explainer) => {
    if (!record(explainer) || !string(explainer.kind) || !string(explainer.id) || !string(explainer.title) || !stringArray(explainer.sourceIds)) return false;
    switch (explainer.kind) {
      case "concept-map": return string(explainer.introduction) && string(explainer.centralLabel) && Array.isArray(explainer.nodes) && explainer.nodes.every((node) => record(node) && string(node.id) && string(node.label) && string(node.summary) && stringArray(node.details) && stringArray(node.sourceIds));
      case "comparison": return record(explainer.columns) && string(explainer.columns.label) && string(explainer.columns.valueLabel) && Array.isArray(explainer.rows) && explainer.rows.every((row) => record(row) && string(row.label) && string(row.value) && stringArray(row.sourceIds));
      case "process-flow": return string(explainer.introduction) && Array.isArray(explainer.steps) && explainer.steps.every((step) => record(step) && string(step.title) && string(step.explanation) && stringArray(step.sourceIds));
      case "contextual-callout": return string(explainer.body);
      default: return false;
    }
  });
}
function string(value: unknown): value is string { return typeof value === "string"; }
