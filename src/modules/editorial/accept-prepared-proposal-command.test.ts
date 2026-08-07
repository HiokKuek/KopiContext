import { describe, expect, it } from "vitest";

import type { AgentPreparationProposal } from "@/modules/preparation/source-preparation";

import {
  createAcceptPreparedProposalCommand,
  fingerprintProposalOutput,
  type AcceptPreparedProposalRepository,
  type PreparedProposalForEditorialDecision,
} from "./accept-prepared-proposal-command";

const proposal: AgentPreparationProposal = {
  classification: {
    proposedTopic: "How Singapore's Government Works",
    proposedSubtopic: "Three branches of government",
    confidence: 0.9,
    rationale: "The transcript is an introductory civic explanation.",
  },
  candidateClaims: [
    {
      statement: "Parliament makes laws.",
      excerpt: "Parliament makes laws.",
      supportingSubmissionId: "submission-government",
      confidence: 0.9,
      rationale: "The statement is explicit in the submitted transcript.",
    },
  ],
  draft: {
    templateVersion: "v1",
    title: "How Singapore's Government Works",
    sections: [{ section: "oneSentenceExplanation", body: "A map of Singapore's government." }],
  },
  risks: [],
  provider: "test-provider",
  model: "test-model",
  promptVersion: "v1",
};

const prepared: Extract<PreparedProposalForEditorialDecision, { proposal: unknown }> = {
  submissionId: "submission-government",
  state: "prepared",
  proposal,
  outputFingerprint: fingerprintProposalOutput(proposal),
};

function commandFor(repository: AcceptPreparedProposalRepository) {
  return createAcceptPreparedProposalCommand(repository);
}

function request() {
  return {
    idempotencyKey: "proposal-acceptance:government:v1",
    submissionId: prepared.submissionId,
    expectedOutputFingerprint: prepared.outputFingerprint,
    actorId: "google:editor",
    occurredAt: "2026-08-08T10:00:00.000Z",
    topic: {
      slug: "how-singapores-government-works",
      description: "A clear introduction to Singapore's system of government.",
    },
  };
}

describe("accept prepared proposal command", () => {
  it("creates only a new draft Topic, Briefing, agent revision, and proposal decision", async () => {
    const persisted: unknown[] = [];
    const repository: AcceptPreparedProposalRepository = {
      retrievePreparedProposal: async () => prepared,
      acceptPreparedProposal: async (input) => {
        persisted.push(input);
        return {
          kind: "created",
          topicId: "topic-government",
          briefingId: "briefing-government",
          revisionId: "revision-government-1",
          decisionId: "decision-government",
        };
      },
    };

    await expect(commandFor(repository).accept(request())).resolves.toEqual({
      ok: true,
      kind: "created",
      topicId: "topic-government",
      briefingId: "briefing-government",
      revisionId: "revision-government-1",
      decisionId: "decision-government",
    });
    expect(persisted).toEqual([
      expect.objectContaining({
        topic: {
          slug: "how-singapores-government-works",
          title: "How Singapore's Government Works",
          description: "A clear introduction to Singapore's system of government.",
        },
        status: "draft",
        revision: expect.objectContaining({
          origin: "agent",
          content: proposal.draft,
          sourceSubmissionId: "submission-government",
          aiProvider: "test-provider",
          aiModel: "test-model",
          promptVersion: "v1",
        }),
      }),
    ]);
  });

  it("refuses a stale proposal before any persistence attempt", async () => {
    let persisted = false;
    const repository: AcceptPreparedProposalRepository = {
      retrievePreparedProposal: async () => prepared,
      acceptPreparedProposal: async () => {
        persisted = true;
        return { kind: "created", topicId: "topic", briefingId: "briefing", revisionId: "revision", decisionId: "decision" };
      },
    };

    await expect(
      commandFor(repository).accept({ ...request(), expectedOutputFingerprint: "sha256:old-output" }),
    ).resolves.toEqual({ ok: false, reason: "proposal-conflict" });
    expect(persisted).toBe(false);
  });

  it("refuses a command without a trusted editor identity", async () => {
    const repository: AcceptPreparedProposalRepository = {
      retrievePreparedProposal: async () => prepared,
      acceptPreparedProposal: async () => {
        throw new Error("must not persist");
      },
    };

    await expect(commandFor(repository).accept({ ...request(), actorId: "  " })).resolves.toEqual({
      ok: false,
      reason: "acceptance-requires-editor",
    });
  });

  it("accepts only a prepared proposal and never falls back to an existing Topic", async () => {
    const repository: AcceptPreparedProposalRepository = {
      retrievePreparedProposal: async () => ({ ...prepared, state: "duplicate" }),
      acceptPreparedProposal: async () => {
        throw new Error("must not persist");
      },
    };

    await expect(commandFor(repository).accept(request())).resolves.toEqual({
      ok: false,
      reason: "proposal-not-ready",
    });
  });

  it("returns the existing outcome for an idempotent command", async () => {
    const repository: AcceptPreparedProposalRepository = {
      retrievePreparedProposal: async () => prepared,
      acceptPreparedProposal: async () => ({
        kind: "idempotent",
        topicId: "topic-government",
        briefingId: "briefing-government",
        revisionId: "revision-government-1",
        decisionId: "decision-government",
      }),
    };

    await expect(commandFor(repository).accept(request())).resolves.toMatchObject({ ok: true, kind: "idempotent" });
  });
});
