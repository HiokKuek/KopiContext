import { describe, expect, it } from "vitest";

import {
  createRotatingSession,
  validateAnonymousEvent,
  type AnonymousEventInput,
} from "./anonymous-events";

const session = createRotatingSession({
  now: "2026-08-07T09:00:00.000Z",
  createToken: () => "opaque-session-token",
});

describe("validateAnonymousEvent", () => {
  it("accepts each approved anonymous event and keeps only its approved fields", () => {
    const examples: ReadonlyArray<AnonymousEventInput> = [
      { type: "page-view", session, occurredAt: "2026-08-07T09:01:00.000Z", path: "/" },
      { type: "search", session, occurredAt: "2026-08-07T09:01:00.000Z", query: "  cpf  " },
      {
        type: "search-result-click",
        session,
        occurredAt: "2026-08-07T09:01:00.000Z",
        query: "cpf",
        topicSlug: "cpf",
        resultPosition: 1,
      },
      { type: "no-result-search", session, occurredAt: "2026-08-07T09:01:00.000Z", query: "kopi" },
      { type: "topic-view", session, occurredAt: "2026-08-07T09:01:00.000Z", topicSlug: "cpf" },
      {
        type: "section-expanded",
        session,
        occurredAt: "2026-08-07T09:01:00.000Z",
        topicSlug: "cpf",
        sectionId: "key-terms",
      },
      {
        type: "current-update-opened",
        session,
        occurredAt: "2026-08-07T09:01:00.000Z",
        topicSlug: "cpf",
        updateId: "update-1",
      },
      {
        type: "related-topic-click",
        session,
        occurredAt: "2026-08-07T09:01:00.000Z",
        topicSlug: "cpf",
        relatedTopicSlug: "ageing-in-singapore",
      },
      {
        type: "share",
        session,
        occurredAt: "2026-08-07T09:01:00.000Z",
        topicSlug: "cpf",
        method: "copy-link",
      },
      {
        type: "topic-request",
        session,
        occurredAt: "2026-08-07T09:01:00.000Z",
        requestedTopic: "How does SkillsFuture work?",
      },
      {
        type: "feedback",
        session,
        occurredAt: "2026-08-07T09:01:00.000Z",
        topicSlug: "cpf",
        sentiment: "helpful",
      },
    ];

    expect(examples.map(validateAnonymousEvent).every((result) => result.ok)).toBe(true);
    expect(validateAnonymousEvent(examples[1])).toEqual({
      ok: true,
      event: {
        type: "search",
        sessionId: session.id,
        occurredAt: "2026-08-07T09:01:00.000Z",
        query: "cpf",
      },
    });
  });

  it("rejects invalid and incomplete event inputs", () => {
    expect(
      validateAnonymousEvent({
        type: "topic-view",
        session,
        occurredAt: "not-a-date",
        topicSlug: "cpf",
      }),
    ).toEqual({ ok: false, reason: "invalid-occurred-at" });

    expect(
      validateAnonymousEvent({
        type: "section-expanded",
        session,
        occurredAt: "2026-08-07T09:01:00.000Z",
        topicSlug: "cpf",
      }),
    ).toEqual({ ok: false, reason: "missing-required-field" });

    expect(
      validateAnonymousEvent({
        type: "share",
        session: { id: "not-an-opaque-session", issuedAt: "2026-08-07T09:00:00.000Z" },
        occurredAt: "2026-08-07T09:01:00.000Z",
        topicSlug: "cpf",
        method: "copy-link",
      }),
    ).toEqual({ ok: false, reason: "invalid-session" });
  });

  it("rejects raw IP addresses and IP-like fields before an event can be persisted", () => {
    expect(
      validateAnonymousEvent({
        type: "page-view",
        session,
        occurredAt: "2026-08-07T09:01:00.000Z",
        path: "/topics/cpf",
        ipAddress: "203.0.113.4",
      }),
    ).toEqual({ ok: false, reason: "raw-ip-not-allowed" });

    expect(
      validateAnonymousEvent({
        type: "topic-request",
        session,
        occurredAt: "2026-08-07T09:01:00.000Z",
        requestedTopic: "Please contact me at 2001:db8::1",
      }),
    ).toEqual({ ok: false, reason: "raw-ip-not-allowed" });
  });
});

describe("createRotatingSession", () => {
  it("creates opaque pseudonymous IDs and identifies sessions that have reached the rotation age", () => {
    expect(session).toEqual({
      id: "kc_session_opaque-session-token",
      issuedAt: "2026-08-07T09:00:00.000Z",
    });
    expect(
      createRotatingSession({
        now: "2026-08-08T09:00:00.000Z",
        existing: session,
        createToken: () => "replacement-token",
      }),
    ).toEqual({ id: "kc_session_replacement-token", issuedAt: "2026-08-08T09:00:00.000Z" });
    expect(
      createRotatingSession({
        now: "2026-08-08T08:59:59.999Z",
        existing: session,
        createToken: () => "unused-token",
      }),
    ).toEqual(session);
  });
});
