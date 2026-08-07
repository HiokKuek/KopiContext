import { describe, expect, it, vi } from "vitest";

import {
  PrivateApiClientError,
  createPrivateApiClient,
  type FetchLike,
} from "./private-api-client";

const clientConfig = {
  baseUrl: "https://private-api.example.test",
  serviceCredential: "test-credential",
  timeoutMs: 50,
};

describe("private API client", () => {
  it("uses the configured base URL and service credential for a typed query", async () => {
    const fetch = vi.fn<FetchLike>().mockResolvedValue(jsonResponse({
      status: "ok",
      version: "v1",
      checkedAt: "2026-08-07T10:00:00.000Z",
    }));
    const client = createPrivateApiClient({ ...clientConfig, fetch });

    await expect(client.health()).resolves.toEqual({
      status: "ok",
      version: "v1",
      checkedAt: "2026-08-07T10:00:00.000Z",
    });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe("https://private-api.example.test/v1/healthz");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-credential");
    expect(init?.cache).toBe("no-store");
  });

  it("retries a transient query failure only within the configured bound", async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "internal_error", message: "Try again." } }, 500))
      .mockResolvedValueOnce(jsonResponse({ status: "ok", version: "v1", checkedAt: "2026-08-07T10:00:00.000Z" }));
    const client = createPrivateApiClient({ ...clientConfig, fetch, maxQueryAttempts: 2 });

    await expect(client.health()).resolves.toMatchObject({ status: "ok" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry a command after its transport fails", async () => {
    const fetch = vi.fn<FetchLike>().mockRejectedValue(new Error("connection reset"));
    const client = createPrivateApiClient({ ...clientConfig, fetch, maxQueryAttempts: 3 });

    await expect(client.command({ path: "/v1/editorial/submissions", method: "POST", body: { title: "A source" } }))
      .rejects.toMatchObject({ code: "network_error" });

    expect(fetch).toHaveBeenCalledOnce();
  });

  it("maps the private API error envelope to a stable caller error", async () => {
    const fetch = vi.fn<FetchLike>().mockResolvedValue(
      jsonResponse({ error: { code: "not_found", message: "The requested Briefing does not exist." } }, 404),
    );
    const client = createPrivateApiClient({ ...clientConfig, fetch });

    await expect(client.getPublishedBriefing("missing-topic")).rejects.toEqual(
      expect.objectContaining<Partial<PrivateApiClientError>>({
        code: "not_found",
        status: 404,
        message: "The requested Briefing does not exist.",
      }),
    );
  });

  it("rejects invalid configuration before issuing a request", () => {
    expect(() => createPrivateApiClient({ ...clientConfig, baseUrl: "postgres://private" })).toThrow(
      "baseUrl must be an absolute HTTP(S) URL.",
    );
    expect(() => createPrivateApiClient({ ...clientConfig, serviceCredential: " " })).toThrow(
      "serviceCredential must not be empty.",
    );
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
