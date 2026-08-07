import { describe, expect, it, vi } from "vitest";

import {
  TopicRequestRejectedError,
  createTopicRequestCommand,
  type TopicRequestDemandRepository,
} from "./topic-request-command";

describe("topic-request acceptance command", () => {
  it("records only the normalised topic and acceptance time as aggregate demand", async () => {
    const recordAcceptedDemand = vi.fn();
    const command = createTopicRequestCommand(
      { recordAcceptedDemand, listDemand: () => [] } satisfies TopicRequestDemandRepository,
      { now: () => new Date("2026-08-07T11:00:00.000Z") },
    );

    await expect(command.submit({ requestedTopic: "  How does   CPF work?  " })).resolves.toEqual({
      status: "received",
    });
    expect(recordAcceptedDemand).toHaveBeenCalledWith({
      requestedTopic: "How does CPF work?",
      acceptedAt: "2026-08-07T11:00:00.000Z",
    });
  });

  it("does not persist an invalid request even when a caller bypasses the web BFF", async () => {
    const recordAcceptedDemand = vi.fn();
    const command = createTopicRequestCommand({ recordAcceptedDemand, listDemand: () => [] });

    await expect(
      command.submit({ requestedTopic: "reader@example.com" }),
    ).rejects.toEqual(new TopicRequestRejectedError("personal-information-not-allowed"));
    expect(recordAcceptedDemand).not.toHaveBeenCalled();
  });
});
