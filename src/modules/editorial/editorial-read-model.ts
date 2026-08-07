import type { SourceSubmissionKind } from "@/modules/preparation/source-preparation";

import {
  evaluateEditorialTransition,
  type EditorialAuditRecord,
  type EditorialItem,
  type EditorialStatus,
} from "./editorial-workflow";

/**
 * Private, transport-neutral queries for the sole editor's workspace. These
 * values deliberately differ from the public Briefing contract: they include
 * evidence and audit facts needed for an Editorial Approval, never reader
 * analytics or raw agent/retrieval material.
 */

export type EditorialWorkflowAction =
  | "move-to-needs-verification"
  | "start-editorial-review"
  | "return-to-draft"
  | "approve"
  | "publish"
  | "archive"
  | "restore";

export type TemplateSectionState = Readonly<{
  key: string;
  label: string;
  state: "complete" | "missing";
}>;

export type EditorialEvidenceSource = Readonly<{
  id: string;
  title: string;
  publisher: string;
  sourceType: string;
  canonicalUrl: string;
  externalIdentifier?: string;
  publishedAt?: string;
  retrievedAt: string;
  relation: string;
  rightsNote: string;
  acceptedBy: string;
  acceptedAt: string;
  submission?: EditorialSourceSubmissionProvenance;
}>;

/** Provenance shown to an editor without exposing raw submitted material or agent prompts. */
export type EditorialSourceSubmissionProvenance = Readonly<{
  id: string;
  kind: SourceSubmissionKind;
  originalIdentifier: string;
  originalUrl?: string;
  submittedBy: string;
  submittedAt: string;
  retrievedAt?: string;
  rightsNote: string;
  processingStatus: "submitted" | "processing" | "ready-for-review" | "escalated" | "rejected";
  proposedTopic?: string;
  proposedSubtopic?: string;
  classificationConfidence?: number;
  classificationRationale?: string;
}>;

export type EditorialClaimSupport = Readonly<{
  id: string;
  sourceId: string;
  kind: "direct" | "contextual";
  locator?: string;
  excerpt?: string;
  rationale?: string;
  addedBy: string;
  addedAt: string;
}>;

export type EditorialClaim = Readonly<{
  id: string;
  statement: string;
  status: "candidate" | "verified" | "rejected";
  supports: ReadonlyArray<EditorialClaimSupport>;
}>;

export type EditorialCurrentUpdate = Readonly<{
  id: string;
  title: string;
  body: string;
  effectiveAt: string;
  status: EditorialStatus;
  supports: ReadonlyArray<Readonly<{
    id: string;
    sourceId: string;
    title: string;
    publisher: string;
    canonicalUrl: string;
    excerpt: string;
    rationale: string;
  }>>;
  allowedActions: ReadonlyArray<EditorialWorkflowAction>;
}>;

export type EditorialFreshness = Readonly<{
  lastActivityAt: string;
  reviewAgeDays: number;
  isStale: boolean;
}>;

export type EditorialBriefingReview = Readonly<{
  briefing: Readonly<{
    id: string;
    title: string;
    topic: Readonly<{ id: string; slug: string; title: string }>;
    status: EditorialStatus;
  }>;
  revision: Readonly<{
    id: string;
    sequence: number;
    templateVersion: string;
    content: Readonly<Record<string, unknown>>;
    origin: "human" | "agent";
    createdBy: string;
    createdAt: string;
  }>;
  templateSections: ReadonlyArray<TemplateSectionState>;
  claims: ReadonlyArray<EditorialClaim>;
  acceptedSources: ReadonlyArray<EditorialEvidenceSource>;
  currentUpdates?: ReadonlyArray<EditorialCurrentUpdate>;
  freshness: EditorialFreshness;
  auditRecords: ReadonlyArray<EditorialAuditRecord>;
  allowedActions: ReadonlyArray<EditorialWorkflowAction>;
}>;

export type EditorialWorkItem = Readonly<{
  briefingId: string;
  title: string;
  topicTitle: string;
  status: EditorialStatus;
  revisionId: string;
  revisionCreatedAt: string;
  freshness: EditorialFreshness;
  completeness: Readonly<{
    isComplete: boolean;
    missingSectionCount: number;
    claimCount: number;
    unsupportedClaimCount: number;
    acceptedSourceCount: number;
  }>;
}>;

export type EditorialWorkQueue = Readonly<{
  countsByStatus: Readonly<Record<EditorialStatus, number>>;
  items: ReadonlyArray<EditorialWorkItem>;
}>;

/** The private application seam consumed by an authenticated editor BFF only. */
export type EditorialReadRepository = Readonly<{
  listEditorialWork(): Promise<EditorialWorkQueue>;
  getEditorialBriefing(briefingId: string): Promise<EditorialBriefingReview | undefined>;
}>;

const templateSections = [
  ["oneSentenceExplanation", "One-sentence explanation", "string"],
  ["thirtySecondOverview", "30-second overview", "string"],
  ["fiveMinuteExplanation", "Five-minute explanation", "string"],
  ["whyPeopleCare", "Why people care", "string"],
  ["keyTerms", "Key terms", "array"],
  ["entities", "People and institutions", "array"],
  ["debates", "Debates", "array"],
  ["singaporeSeaAngle", "Singapore context", "string"],
  ["questionsToAsk", "Conversation questions", "array"],
  ["mistakesToAvoid", "Common misconceptions", "array"],
] as const;

/** Describes the known v1 template without making unrecognised versions publishable. */
export function assessTemplateSections(
  templateVersion: string,
  content: unknown,
): ReadonlyArray<TemplateSectionState> {
  const record = isRecord(content) ? content : {};
  return templateSections.map(([key, label, expectedType]) => ({
    key,
    label,
    state: templateVersion === "v1" && sectionHasContent(key, record[key], expectedType) ? "complete" : "missing",
  }));
}

/** Policy-derived actions are advisory to the UI; transition commands remain authoritative. */
export function allowedEditorialWorkflowActions(item: EditorialItem): ReadonlyArray<EditorialWorkflowAction> {
  const actionForTarget: Readonly<Partial<Record<EditorialStatus, EditorialWorkflowAction>>> = {
    draft: "return-to-draft",
    "needs-verification": "move-to-needs-verification",
    "in-editorial-review": "start-editorial-review",
    approved: "approve",
    published: "publish",
    archived: "archive",
  };

  const targets: EditorialStatus[] = [
    "draft",
    "needs-verification",
    "in-editorial-review",
    "approved",
    "published",
    "archived",
  ];
  const actions: EditorialWorkflowAction[] = [];
  for (const target of targets) {
    const outcome = evaluateEditorialTransition(item, {
      to: target,
      actorId: "editor-read-policy",
      reason: "Read-model policy evaluation.",
      occurredAt: "1970-01-01T00:00:00.000Z",
    });
    if (!outcome.ok) continue;
    if (item.status === "archived" && target === "approved") {
      actions.push("restore");
    } else {
      const action = actionForTarget[target];
      if (action) actions.push(action);
    }
  }
  return actions;
}

export function freshnessFrom(lastActivityAt: Date, now: Date, staleAfterDays: number): EditorialFreshness {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const reviewAgeDays = Math.max(0, Math.floor((now.getTime() - lastActivityAt.getTime()) / millisecondsPerDay));
  return {
    lastActivityAt: lastActivityAt.toISOString(),
    reviewAgeDays,
    isStale: reviewAgeDays >= staleAfterDays,
  };
}

function sectionHasContent(
  key: (typeof templateSections)[number][0],
  value: unknown,
  expectedType: "string" | "array",
): boolean {
  if (expectedType === "string") return typeof value === "string" && value.trim().length > 0;
  if (!Array.isArray(value) || value.length === 0) return false;
  if (key === "keyTerms") {
    return value.every(
      (term) =>
        isRecord(term) &&
        typeof term.term === "string" &&
        term.term.trim().length > 0 &&
        typeof term.definition === "string" &&
        term.definition.trim().length > 0,
    );
  }
  return value.every((item) => typeof item === "string" && item.trim().length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
