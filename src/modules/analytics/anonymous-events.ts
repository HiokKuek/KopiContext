/**
 * Privacy-safe application seam for the approved first-party anonymous events.
 * It validates event inputs before a delivery or persistence adapter sees them.
 * Sessions are deliberately opaque and contain no network, account, or device
 * identifier.
 */

const SESSION_PREFIX = "kc_session_";
const SESSION_ROTATION_MS = 24 * 60 * 60 * 1000;
const MAX_TEXT_LENGTH = 280;
const MAX_PATH_LENGTH = 2_000;

export type AnonymousEventType =
  | "page-view"
  | "search"
  | "search-result-click"
  | "no-result-search"
  | "topic-view"
  | "section-expanded"
  | "current-update-opened"
  | "related-topic-click"
  | "share"
  | "topic-request"
  | "feedback";

export type RotatingSession = {
  id: string;
  issuedAt: string;
};

type EventBase = {
  type: AnonymousEventType;
  session: RotatingSession;
  occurredAt: string;
};

export type AnonymousEventInput =
  | (EventBase & { type: "page-view"; path: string })
  | (EventBase & { type: "search" | "no-result-search"; query: string })
  | (EventBase & {
      type: "search-result-click";
      query: string;
      topicSlug: string;
      resultPosition: number;
    })
  | (EventBase & { type: "topic-view"; topicSlug: string })
  | (EventBase & { type: "section-expanded"; topicSlug: string; sectionId: string })
  | (EventBase & { type: "current-update-opened"; topicSlug: string; updateId: string })
  | (EventBase & { type: "related-topic-click"; topicSlug: string; relatedTopicSlug: string })
  | (EventBase & { type: "share"; topicSlug: string; method: "native-share" | "copy-link" })
  | (EventBase & { type: "topic-request"; requestedTopic: string })
  | (EventBase & { type: "feedback"; topicSlug: string; sentiment: "helpful" | "not-helpful" });

export type ValidatedAnonymousEvent =
  | { type: "page-view"; sessionId: string; occurredAt: string; path: string }
  | { type: "search" | "no-result-search"; sessionId: string; occurredAt: string; query: string }
  | {
      type: "search-result-click";
      sessionId: string;
      occurredAt: string;
      query: string;
      topicSlug: string;
      resultPosition: number;
    }
  | { type: "topic-view"; sessionId: string; occurredAt: string; topicSlug: string }
  | {
      type: "section-expanded";
      sessionId: string;
      occurredAt: string;
      topicSlug: string;
      sectionId: string;
    }
  | {
      type: "current-update-opened";
      sessionId: string;
      occurredAt: string;
      topicSlug: string;
      updateId: string;
    }
  | {
      type: "related-topic-click";
      sessionId: string;
      occurredAt: string;
      topicSlug: string;
      relatedTopicSlug: string;
    }
  | {
      type: "share";
      sessionId: string;
      occurredAt: string;
      topicSlug: string;
      method: "native-share" | "copy-link";
    }
  | { type: "topic-request"; sessionId: string; occurredAt: string; requestedTopic: string }
  | {
      type: "feedback";
      sessionId: string;
      occurredAt: string;
      topicSlug: string;
      sentiment: "helpful" | "not-helpful";
    };

export type EventValidationFailure = {
  ok: false;
  reason:
    | "invalid-event"
    | "invalid-session"
    | "invalid-occurred-at"
    | "missing-required-field"
    | "invalid-field"
    | "raw-ip-not-allowed";
};

export type EventValidationResult =
  | { ok: true; event: ValidatedAnonymousEvent }
  | EventValidationFailure;

export type CreateRotatingSessionOptions = {
  now: string;
  createToken: () => string;
  existing?: RotatingSession;
};

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function hasRawIp(value: unknown): boolean {
  if (typeof value === "string") {
    const hasIpv4 = /(?:^|[^\d])(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}(?:$|[^\d])/.test(
      value,
    );
    const hasIpv6 = /(?:^|[^\w:])(?:[\da-f]{1,4}:){2,}[\da-f:]+(?:$|[^\w:])/i.test(value);
    return hasIpv4 || hasIpv6;
  }

  if (Array.isArray(value)) {
    return value.some(hasRawIp);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, nestedValue]) => /(?:^|[-_])ip(?:[-_]|$)|ipaddress/i.test(key) || hasRawIp(nestedValue));
  }

  return false;
}

function isValidSession(session: unknown): session is RotatingSession {
  if (!session || typeof session !== "object") {
    return false;
  }

  const candidate = session as Partial<RotatingSession>;
  return (
    typeof candidate.id === "string" &&
    /^kc_session_[A-Za-z0-9_-]{8,}$/.test(candidate.id) &&
    isIsoDate(candidate.issuedAt)
  );
}

function normaliseRequiredText(value: unknown, maxLength = MAX_TEXT_LENGTH): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalised = value.trim();
  return normalised.length > 0 && normalised.length <= maxLength ? normalised : undefined;
}

function getBaseEvent(input: unknown):
  | { input: Record<string, unknown>; sessionId: string; occurredAt: string }
  | EventValidationFailure {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, reason: "invalid-event" };
  }
  if (hasRawIp(input)) {
    return { ok: false, reason: "raw-ip-not-allowed" };
  }

  const event = input as Record<string, unknown>;
  if (!isValidSession(event.session)) {
    return { ok: false, reason: "invalid-session" };
  }
  if (!isIsoDate(event.occurredAt)) {
    return { ok: false, reason: "invalid-occurred-at" };
  }

  return { input: event, sessionId: event.session.id, occurredAt: event.occurredAt };
}

function isFailure(
  result: { input: Record<string, unknown>; sessionId: string; occurredAt: string } | EventValidationFailure,
): result is EventValidationFailure {
  return !("input" in result);
}

/**
 * Creates a new opaque session only when no valid session exists or the current
 * one is at least 24 hours old. The token supplier is injected so web adapters
 * can use secure randomness while tests remain deterministic.
 */
export function createRotatingSession(options: CreateRotatingSessionOptions): RotatingSession {
  const now = Date.parse(options.now);
  if (Number.isNaN(now)) {
    throw new Error("A valid ISO timestamp is required to create an analytics session.");
  }

  if (
    isValidSession(options.existing) &&
    now - Date.parse(options.existing.issuedAt) < SESSION_ROTATION_MS &&
    now >= Date.parse(options.existing.issuedAt)
  ) {
    return options.existing;
  }

  const token = options.createToken();
  if (!/^[A-Za-z0-9_-]{8,}$/.test(token)) {
    throw new Error("Analytics session tokens must be opaque URL-safe values.");
  }

  return { id: `${SESSION_PREFIX}${token}`, issuedAt: options.now };
}

/**
 * Validates one approved anonymous event. On success, the returned event is a
 * new allow-listed object: arbitrary request metadata is never forwarded to a
 * persistence or analytics-delivery adapter.
 */
export function validateAnonymousEvent(input: unknown): EventValidationResult {
  const base = getBaseEvent(input);
  if (isFailure(base)) {
    return base;
  }

  const { type } = base.input;
  const text = (field: string, maxLength?: number) => normaliseRequiredText(base.input[field], maxLength);
  const topicSlug = () => text("topicSlug");
  const missing = (): EventValidationFailure => ({ ok: false, reason: "missing-required-field" });
  const invalid = (): EventValidationFailure => ({ ok: false, reason: "invalid-field" });

  switch (type) {
    case "page-view": {
      const path = text("path", MAX_PATH_LENGTH);
      return path && path.startsWith("/")
        ? { ok: true, event: { type, sessionId: base.sessionId, occurredAt: base.occurredAt, path } }
        : path
          ? invalid()
          : missing();
    }
    case "search":
    case "no-result-search": {
      const query = text("query");
      return query
        ? { ok: true, event: { type, sessionId: base.sessionId, occurredAt: base.occurredAt, query } }
        : missing();
    }
    case "search-result-click": {
      const query = text("query");
      const slug = topicSlug();
      const position = base.input.resultPosition;
      if (!query || !slug || position === undefined) return missing();
      return typeof position === "number" && Number.isInteger(position) && position > 0
        ? {
            ok: true,
            event: {
              type,
              sessionId: base.sessionId,
              occurredAt: base.occurredAt,
              query,
              topicSlug: slug,
              resultPosition: position,
            },
          }
        : invalid();
    }
    case "topic-view": {
      const slug = topicSlug();
      return slug
        ? { ok: true, event: { type, sessionId: base.sessionId, occurredAt: base.occurredAt, topicSlug: slug } }
        : missing();
    }
    case "section-expanded": {
      const slug = topicSlug();
      const sectionId = text("sectionId");
      return slug && sectionId
        ? { ok: true, event: { type, sessionId: base.sessionId, occurredAt: base.occurredAt, topicSlug: slug, sectionId } }
        : missing();
    }
    case "current-update-opened": {
      const slug = topicSlug();
      const updateId = text("updateId");
      return slug && updateId
        ? { ok: true, event: { type, sessionId: base.sessionId, occurredAt: base.occurredAt, topicSlug: slug, updateId } }
        : missing();
    }
    case "related-topic-click": {
      const slug = topicSlug();
      const relatedTopicSlug = text("relatedTopicSlug");
      return slug && relatedTopicSlug
        ? {
            ok: true,
            event: { type, sessionId: base.sessionId, occurredAt: base.occurredAt, topicSlug: slug, relatedTopicSlug },
          }
        : missing();
    }
    case "share": {
      const slug = topicSlug();
      const method = base.input.method;
      if (!slug || method === undefined) return missing();
      return method === "native-share" || method === "copy-link"
        ? { ok: true, event: { type, sessionId: base.sessionId, occurredAt: base.occurredAt, topicSlug: slug, method } }
        : invalid();
    }
    case "topic-request": {
      const requestedTopic = text("requestedTopic");
      return requestedTopic
        ? { ok: true, event: { type, sessionId: base.sessionId, occurredAt: base.occurredAt, requestedTopic } }
        : missing();
    }
    case "feedback": {
      const slug = topicSlug();
      const sentiment = base.input.sentiment;
      if (!slug || sentiment === undefined) return missing();
      return sentiment === "helpful" || sentiment === "not-helpful"
        ? { ok: true, event: { type, sessionId: base.sessionId, occurredAt: base.occurredAt, topicSlug: slug, sentiment } }
        : invalid();
    }
    default:
      return { ok: false, reason: "invalid-event" };
  }
}
