import { describe, expect, it } from "vitest";

import {
  createAcceptSourceFromSubmissionCommand,
  type AcceptSourceFromSubmissionRepository,
} from "./accept-source-from-submission-command";

const prepared = {
  submissionId: "submission-government",
  state: "prepared" as const,
  outputFingerprint: "sha256:8bb0d4d4b9e657a7281c8026bd2ac6200277f426f8a4cf7cab4349e43d8b01a7",
};

const request = {
  idempotencyKey: "source-acceptance:government:v1",
  submissionId: prepared.submissionId,
  expectedOutputFingerprint: prepared.outputFingerprint,
  actorId: "google:editor",
  occurredAt: "2026-08-08T11:00:00.000Z",
  source: {
    title: "Singapore Constitution",
    publisher: "Singapore Statutes Online",
    sourceType: "legal",
    canonicalUrl: "https://sso.agc.gov.sg/Constitution/Constitution",
    retrievedAt: "2026-08-08T10:00:00.000Z",
    relation: "Primary legal context.",
    rightsNote: "Public legal material.",
  },
};

describe("accept Source from Submission command", () => {
  it("creates only an Accepted Source and append-only source decision from a prepared Submission", async () => {
    const writes: unknown[] = [];
    const repository: AcceptSourceFromSubmissionRepository = {
      retrievePreparedSubmission: async () => prepared,
      acceptSourceFromSubmission: async (input) => {
        writes.push(input);
        return { kind: "created", acceptedSourceId: "source-constitution", decisionId: "decision-source" };
      },
    };

    await expect(createAcceptSourceFromSubmissionCommand(repository).accept(request)).resolves.toEqual({
      ok: true,
      kind: "created",
      acceptedSourceId: "source-constitution",
      decisionId: "decision-source",
    });
    expect(writes).toEqual([expect.objectContaining({ source: expect.objectContaining({ acceptedFromSubmissionId: prepared.submissionId, acceptedBy: "google:editor" }) })]);
  });

  it("rejects stale output before persistence", async () => {
    let wrote = false;
    const repository: AcceptSourceFromSubmissionRepository = {
      retrievePreparedSubmission: async () => prepared,
      acceptSourceFromSubmission: async () => { wrote = true; return { kind: "created", acceptedSourceId: "source", decisionId: "decision" }; },
    };
    await expect(createAcceptSourceFromSubmissionCommand(repository).accept({ ...request, expectedOutputFingerprint: "sha256:old" })).resolves.toEqual({ ok: false, reason: "proposal-conflict" });
    expect(wrote).toBe(false);
  });

  it("requires a trusted editor and a prepared Submission", async () => {
    const repository: AcceptSourceFromSubmissionRepository = {
      retrievePreparedSubmission: async () => ({ ...prepared, state: "duplicate" as const }),
      acceptSourceFromSubmission: async () => { throw new Error("must not write"); },
    };
    const command = createAcceptSourceFromSubmissionCommand(repository);
    await expect(command.accept(request)).resolves.toEqual({ ok: false, reason: "proposal-not-ready" });
    await expect(command.accept({ ...request, actorId: " " })).resolves.toEqual({ ok: false, reason: "acceptance-requires-editor" });
  });
});
