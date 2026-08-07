import { describe, expect, it, vi } from "vitest";

import {
  createTopicRequestBffTransport,
  createTopicRequestBffTransportFromEnvironment,
} from "./topic-request-bff";
import type { PrivateApiClient } from "./private-api-client";

describe("Topic-request web BFF", () => {
  it("forwards only the Topic request through the server-only private API command", async () => {
    const command = vi.fn().mockResolvedValue({ status: "received" });
    const transport = createTopicRequestBffTransport({ command } as unknown as PrivateApiClient);

    await expect(transport.submit({ requestedTopic: "How does CPF work?" })).resolves.toEqual({
      status: "received",
    });
    expect(command).toHaveBeenCalledWith({
      path: "/v1/discovery/topic-requests",
      method: "POST",
      body: { requestedTopic: "How does CPF work?" },
    });
  });

  it("rejects a malformed private API response instead of treating it as accepted", async () => {
    const transport = createTopicRequestBffTransport({
      command: vi.fn().mockResolvedValue({ status: "queued", internal: "do-not-expose" }),
    } as unknown as PrivateApiClient);

    await expect(transport.submit({ requestedTopic: "CPF" })).rejects.toThrow("invalid Topic-request response");
  });

  it("requires private configuration only on the server composition boundary", () => {
    expect(() => createTopicRequestBffTransportFromEnvironment({})).toThrow("PRIVATE_API_BASE_URL");
    expect(() =>
      createTopicRequestBffTransportFromEnvironment({ PRIVATE_API_BASE_URL: "https://private.example.test" }),
    ).toThrow("PRIVATE_API_SERVICE_CREDENTIAL");
  });
});
