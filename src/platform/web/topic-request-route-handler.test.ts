import { describe, expect, it, vi } from "vitest";

import { createTopicRequestRouteHandler } from "./topic-request-route-handler";
import type { TopicRequestTransport } from "@/modules/discovery/topic-request";

describe("Topic-request same-origin BFF handler", () => {
  it("validates and forwards only the normalised Topic", async () => {
    const submit = vi.fn().mockResolvedValue({ status: "received" });
    const response = await createTopicRequestRouteHandler({ topicRequests: { submit } })(
      jsonRequest({ requestedTopic: "  How does   CPF work?  " }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ status: "received" });
    expect(submit).toHaveBeenCalledWith({ requestedTopic: "How does CPF work?" });
  });

  it("rejects malformed JSON, personal data, and unsupported fields before forwarding", async () => {
    const submit = vi.fn();
    const handler = createTopicRequestRouteHandler({ topicRequests: { submit } });
    const malformed = await handler(new Request("https://kopi.example.test/api/topic-requests", { method: "POST", body: "{" }));
    const personal = await handler(jsonRequest({ requestedTopic: "reader@example.com" }));
    const extra = await handler(jsonRequest({ requestedTopic: "CPF", rawIp: "203.0.113.7" }));

    expect(malformed.status).toBe(400);
    expect(personal.status).toBe(400);
    expect(extra.status).toBe(400);
    await expect(extra.json()).resolves.toEqual({
      error: { code: "invalid_request", message: "The Topic request is invalid." },
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it("does not expose private API failures to the browser", async () => {
    const topicRequests: TopicRequestTransport = {
      submit: vi.fn().mockRejectedValue(new Error("private endpoint credentials rejected")),
    };
    const response = await createTopicRequestRouteHandler({ topicRequests })(jsonRequest({ requestedTopic: "CPF" }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "topic_requests_unavailable",
        message: "Topic requests are unavailable right now. Please try again later.",
      },
    });
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("https://kopi.example.test/api/topic-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
