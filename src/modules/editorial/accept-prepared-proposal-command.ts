import { createHash } from "node:crypto";

import type { AgentPreparationProposal } from "@/modules/preparation/source-preparation";

export type PreparedProposalState = "prepared" | "needs-review" | "duplicate" | "failed";

/** The reviewable snapshot read from a Source Submission before an editor decides. */
export type PreparedProposalForEditorialDecision =
  | Readonly<{
      submissionId: string;
      state: "prepared" | "needs-review";
      proposal: AgentPreparationProposal;
      outputFingerprint: string;
    }>
  | Readonly<{
      submissionId: string;
      state: "duplicate" | "failed";
    }>;

export type AcceptPreparedProposalRequest = Readonly<{
  idempotencyKey: string;
  submissionId: string;
  expectedOutputFingerprint: string;
  /** Trusted server-side identity; never a browser-selected audit value. */
  actorId: string;
  occurredAt: string;
  topic: Readonly<{
    slug: string;
    description: string;
  }>;
}>;

export type NewAgentRevisionFromProposal = Readonly<{
  templateVersion: string;
  content: AgentPreparationProposal["draft"];
  origin: "agent";
  createdBy: string;
  sourceSubmissionId: string;
  aiProvider: string;
  aiModel: string;
  promptVersion: string;
  /** The exact generated output accepted by the editor. */
  generationOutput: AgentPreparationProposal;
}>;

export type AcceptPreparedProposalPersistenceRequest = Readonly<{
  idempotencyKey: string;
  submissionId: string;
  expectedOutputFingerprint: string;
  actorId: string;
  occurredAt: string;
  topic: Readonly<{
    slug: string;
    title: string;
    description: string;
  }>;
  status: "draft";
  revision: NewAgentRevisionFromProposal;
}>;

export type AcceptedPreparedProposal = Readonly<{
  kind: "created" | "idempotent";
  topicId: string;
  briefingId: string;
  revisionId: string;
  decisionId: string;
}>;

export type AcceptPreparedProposalPersistenceFailure = Readonly<{
  kind: "proposal-conflict" | "topic-conflict" | "idempotency-conflict" | "proposal-not-ready";
}>;

/**
 * The persistence seam makes one complete acceptance atomic. Its durable
 * implementation re-checks the Source Submission snapshot while locked; the
 * use case's earlier read exists for a useful, immediate rejection only.
 */
export type AcceptPreparedProposalRepository = Readonly<{
  retrievePreparedProposal(
    submissionId: string,
  ): Promise<PreparedProposalForEditorialDecision | undefined>;
  acceptPreparedProposal(
    request: AcceptPreparedProposalPersistenceRequest,
  ): Promise<AcceptedPreparedProposal | AcceptPreparedProposalPersistenceFailure>;
}>;

export type AcceptPreparedProposalResult =
  | Readonly<{
      ok: true;
      kind: "created" | "idempotent";
      topicId: string;
      briefingId: string;
      revisionId: string;
      decisionId: string;
    }>
  | Readonly<{
      ok: false;
      reason:
        | "acceptance-requires-editor"
        | "proposal-not-found"
        | "proposal-not-ready"
        | "proposal-conflict"
        | "topic-conflict"
        | "idempotency-conflict"
        | "invalid-topic";
    }>;

export type AcceptPreparedProposalCommand = Readonly<{
  accept(request: AcceptPreparedProposalRequest): Promise<AcceptPreparedProposalResult>;
}>;

/**
 * Accepts only the classification and draft portion of a prepared proposal.
 * It intentionally creates no Accepted Source or Claim and cannot target an
 * existing Topic or Briefing.
 */
export function createAcceptPreparedProposalCommand(
  repository: AcceptPreparedProposalRepository,
): AcceptPreparedProposalCommand {
  return {
    async accept(request) {
      if (!hasText(request.actorId)) return { ok: false, reason: "acceptance-requires-editor" };
      if (!isNewTopic(request.topic)) return { ok: false, reason: "invalid-topic" };

      const prepared = await repository.retrievePreparedProposal(request.submissionId);
      if (!prepared) return { ok: false, reason: "proposal-not-found" };
      if (prepared.state !== "prepared" && prepared.state !== "needs-review") {
        return { ok: false, reason: "proposal-not-ready" };
      }
      if (prepared.outputFingerprint !== request.expectedOutputFingerprint) {
        return { ok: false, reason: "proposal-conflict" };
      }

      const result = await repository.acceptPreparedProposal({
        idempotencyKey: request.idempotencyKey,
        submissionId: request.submissionId,
        expectedOutputFingerprint: request.expectedOutputFingerprint,
        actorId: request.actorId,
        occurredAt: request.occurredAt,
        topic: {
          slug: request.topic.slug.trim(),
          title: prepared.proposal.classification.proposedTopic,
          description: request.topic.description.trim(),
        },
        status: "draft",
        revision: {
          templateVersion: prepared.proposal.draft.templateVersion,
          content: prepared.proposal.draft,
          origin: "agent",
          createdBy: `agent:${prepared.proposal.provider}:${prepared.proposal.model}`,
          sourceSubmissionId: prepared.submissionId,
          aiProvider: prepared.proposal.provider,
          aiModel: prepared.proposal.model,
          promptVersion: prepared.proposal.promptVersion,
          generationOutput: prepared.proposal,
        },
      });

      if (result.kind !== "created" && result.kind !== "idempotent") {
        return { ok: false, reason: result.kind };
      }
      return { ok: true, ...result };
    },
  };
}

/** Stable across JSON object insertion order; arrays retain their authored order. */
export function fingerprintProposalOutput(proposal: AgentPreparationProposal): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(proposal))).digest("hex")}`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function isNewTopic(topic: AcceptPreparedProposalRequest["topic"]): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.slug.trim()) && hasText(topic.description);
}
