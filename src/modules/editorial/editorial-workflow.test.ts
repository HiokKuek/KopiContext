import { describe, expect, it } from "vitest";

import {
  evaluateEditorialTransition,
  type EditorialItem,
  type EditorialStatus,
} from "./editorial-workflow";

const completeItem = (status: EditorialStatus): EditorialItem => ({
  id: "briefing-government",
  status,
  revisionId: "revision-3",
  template: { isComplete: true },
  acceptedSources: [{ id: "constitution" }],
  claims: [{ id: "parliamentary-democracy", isSupported: true }],
});

describe("evaluateEditorialTransition", () => {
  it("moves a Briefing through the approved pre-publication workflow", () => {
    const toVerification = evaluateEditorialTransition(completeItem("draft"), {
      to: "needs-verification",
      actorId: "editor-1",
      occurredAt: "2026-08-07T10:00:00.000Z",
    });
    const toReview = evaluateEditorialTransition(completeItem("needs-verification"), {
      to: "in-editorial-review",
      actorId: "editor-1",
      occurredAt: "2026-08-07T10:01:00.000Z",
    });
    const toApproved = evaluateEditorialTransition(completeItem("in-editorial-review"), {
      to: "approved",
      actorId: "editor-1",
      occurredAt: "2026-08-07T10:02:00.000Z",
    });

    expect(toVerification).toMatchObject({ ok: true, item: { status: "needs-verification" } });
    expect(toReview).toMatchObject({ ok: true, item: { status: "in-editorial-review" } });
    expect(toApproved).toMatchObject({ ok: true, item: { status: "approved" } });
  });

  it("records an immutable audit outcome for an accepted transition", () => {
    const result = evaluateEditorialTransition(completeItem("in-editorial-review"), {
      to: "approved",
      actorId: "editor-1",
      reason: "Every civic claim has been checked against its source.",
      occurredAt: "2026-08-07T10:02:00.000Z",
    });

    expect(result).toEqual({
      ok: true,
      item: { ...completeItem("in-editorial-review"), status: "approved" },
      audit: {
        itemId: "briefing-government",
        revisionId: "revision-3",
        from: "in-editorial-review",
        to: "approved",
        actorId: "editor-1",
        reason: "Every civic claim has been checked against its source.",
        occurredAt: "2026-08-07T10:02:00.000Z",
      },
    });
  });

  it("allows a reviewer to return any pre-published item to Draft or Needs verification only with a reason", () => {
    expect(
      evaluateEditorialTransition(completeItem("approved"), {
        to: "draft",
        actorId: "editor-1",
        reason: "The opening needs plainer language.",
        occurredAt: "2026-08-07T10:03:00.000Z",
      }),
    ).toMatchObject({ ok: true, item: { status: "draft" } });

    expect(
      evaluateEditorialTransition(completeItem("in-editorial-review"), {
        to: "needs-verification",
        actorId: "editor-1",
        occurredAt: "2026-08-07T10:03:00.000Z",
      }),
    ).toEqual({ ok: false, reason: "return-requires-reason" });
  });

  it("rejects transitions that bypass the approved workflow", () => {
    expect(
      evaluateEditorialTransition(completeItem("draft"), {
        to: "approved",
        actorId: "editor-1",
        occurredAt: "2026-08-07T10:00:00.000Z",
      }),
    ).toEqual({ ok: false, reason: "invalid-transition" });
  });

  it.each([
    ["missing editor identity", { actorId: "" }, "publication-requires-editor"],
    ["incomplete template", { template: { isComplete: false } }, "publication-requires-complete-template"],
    ["no accepted sources", { acceptedSources: [] }, "publication-requires-accepted-source"],
    ["no claims", { claims: [] }, "publication-requires-supported-claims"],
    ["unsupported claim", { claims: [{ id: "cabinet", isSupported: false }] }, "publication-requires-supported-claims"],
  ] as const)("refuses publication with %s", (_caseName, patch, reason) => {
    expect(
      evaluateEditorialTransition({ ...completeItem("approved"), ...patch }, {
        to: "published",
        actorId: "actorId" in patch ? patch.actorId : "editor-1",
        occurredAt: "2026-08-07T10:04:00.000Z",
      }),
    ).toEqual({ ok: false, reason });
  });

  it("publishes only an Approved Briefing and then supports archiving and restoring it for re-approval", () => {
    const published = evaluateEditorialTransition(completeItem("approved"), {
      to: "published",
      actorId: "editor-1",
      occurredAt: "2026-08-07T10:04:00.000Z",
    });
    const archived = evaluateEditorialTransition(completeItem("published"), {
      to: "archived",
      actorId: "editor-1",
      reason: "This explanation has been superseded.",
      occurredAt: "2026-08-07T10:05:00.000Z",
    });
    const restored = evaluateEditorialTransition(completeItem("archived"), {
      to: "approved",
      actorId: "editor-1",
      reason: "The replacement was withdrawn.",
      occurredAt: "2026-08-07T10:06:00.000Z",
    });

    expect(published).toMatchObject({ ok: true, item: { status: "published" } });
    expect(archived).toMatchObject({ ok: true, item: { status: "archived" } });
    expect(restored).toMatchObject({ ok: true, item: { status: "approved" } });
  });
});
