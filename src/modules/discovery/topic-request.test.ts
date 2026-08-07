import { describe, expect, it } from "vitest";

import { validateTopicRequest } from "./topic-request";

describe("validateTopicRequest", () => {
  it("keeps only a compact, normalised requested topic", () => {
    expect(validateTopicRequest({ requestedTopic: "  How does   CPF work?  " })).toEqual({
      ok: true,
      request: { requestedTopic: "How does CPF work?" },
    });
  });

  it("rejects absent, excessively short, and excessively long topics", () => {
    expect(validateTopicRequest({})).toEqual({ ok: false, reason: "missing-topic" });
    expect(validateTopicRequest({ requestedTopic: "a" })).toEqual({ ok: false, reason: "topic-too-short" });
    expect(validateTopicRequest({ requestedTopic: "a".repeat(121) })).toEqual({
      ok: false,
      reason: "topic-too-long",
    });
  });

  it("rejects personal contact, phone, and network details", () => {
    expect(validateTopicRequest({ requestedTopic: "Email me at reader@example.com about CPF" })).toEqual({
      ok: false,
      reason: "personal-information-not-allowed",
    });
    expect(validateTopicRequest({ requestedTopic: "Call 8123 4567 about HDB" })).toEqual({
      ok: false,
      reason: "personal-information-not-allowed",
    });
    expect(validateTopicRequest({ requestedTopic: "203.0.113.7 and public transport" })).toEqual({
      ok: false,
      reason: "personal-information-not-allowed",
    });
  });
});
