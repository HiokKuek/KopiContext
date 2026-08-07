import { describe, expect, it, vi } from "vitest";

import { createBrowserAnalyticsClient, type BrowserStorage } from "./browser-analytics-client";

function createStorage(): BrowserStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

describe("browser analytics client", () => {
  it("sends an approved page view with a rotating opaque session and no credentials", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    const storage = createStorage();
    const client = createBrowserAnalyticsClient({
      fetch,
      storage,
      now: () => "2026-08-07T09:00:00.000Z",
      createToken: () => "opaque-browser-token",
    });

    client.record({ type: "page-view", path: "/topics/cpf" });
    await Promise.resolve();

    expect(fetch).toHaveBeenCalledWith("/v1/public/analytics/events", {
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      keepalive: true,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": "event:opaque-browser-token",
      },
      body: JSON.stringify({
        type: "page-view",
        session: { id: "kc_session_opaque-browser-token", issuedAt: "2026-08-07T09:00:00.000Z" },
        occurredAt: "2026-08-07T09:00:00.000Z",
        path: "/topics/cpf",
      }),
    });
    expect([...storage.values.values()]).toEqual([
      JSON.stringify({ id: "kc_session_opaque-browser-token", issuedAt: "2026-08-07T09:00:00.000Z" }),
    ]);
  });

  it("keeps a valid session for less than 24 hours and rotates it at the boundary", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    const storage = createStorage();
    const timestamps = ["2026-08-07T09:00:00.000Z", "2026-08-08T08:59:59.999Z", "2026-08-08T09:00:00.000Z"];
    const tokens = ["first-opaque-token", "first-delivery-token", "second-delivery-token", "next-opaque-token", "third-delivery-token"];
    const client = createBrowserAnalyticsClient({
      fetch,
      storage,
      now: () => timestamps.shift() ?? "2026-08-08T09:00:00.000Z",
      createToken: () => tokens.shift() ?? "unused-token",
    });

    client.record({ type: "search", query: "cpf" });
    client.record({ type: "no-result-search", query: "new topic" });
    client.record({ type: "topic-view", topicSlug: "cpf" });
    await Promise.resolve();

    const payloads = fetch.mock.calls.map(([, request]) => JSON.parse((request as RequestInit).body as string));
    expect(payloads.map((payload) => payload.session.id)).toEqual([
      "kc_session_first-opaque-token",
      "kc_session_first-opaque-token",
      "kc_session_next-opaque-token",
    ]);
  });

  it("does not send invalid event values or use browser metadata as a fallback", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    const client = createBrowserAnalyticsClient({
      fetch,
      now: () => "2026-08-07T09:00:00.000Z",
      createToken: () => "opaque-browser-token",
    });

    client.record({ type: "search", query: "" });
    await Promise.resolve();

    expect(fetch).not.toHaveBeenCalled();
  });
});
