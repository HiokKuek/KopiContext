import {
  createRotatingSession,
  type AnonymousEventInput,
  type RotatingSession,
  type ValidatedAnonymousEvent,
  validateAnonymousEvent,
} from "./anonymous-events";

const SESSION_STORAGE_KEY = "kopicontext.analytics.session.v1";
const DEFAULT_ENDPOINT = "/v1/public/analytics/events";

type WithoutSession<T> = T extends unknown ? Omit<T, "session" | "occurredAt"> : never;

/** The four reader events currently emitted by the public web experience. */
export type ReaderAnalyticsEvent = WithoutSession<
  Extract<
    AnonymousEventInput,
    { type: "page-view" | "search" | "no-result-search" | "topic-view" }
  >
>;

export type BrowserStorage = Readonly<{
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}>;

export type BrowserAnalyticsClientOptions = Readonly<{
  endpoint?: string;
  now?: () => string;
  storage?: BrowserStorage;
  createToken?: () => string;
  fetch?: (input: string, init: RequestInit) => Promise<unknown>;
}>;

export type BrowserAnalyticsClient = Readonly<{
  record(event: ReaderAnalyticsEvent): void;
}>;

/**
 * A deliberately tiny browser transport. It writes only an opaque rotating
 * session to local storage and sends a newly validated allow-listed event to
 * the public analytics endpoint. It has no access to cookies, headers,
 * accounts, device characteristics, or application secrets.
 */
export function createBrowserAnalyticsClient(
  options: BrowserAnalyticsClientOptions = {},
): BrowserAnalyticsClient {
  const now = options.now ?? (() => new Date().toISOString());
  const storage = options.storage ?? browserStorage();
  const createToken = options.createToken ?? secureBrowserToken;
  const send = options.fetch ?? browserFetch();
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;

  return {
    record(event) {
      if (!send) {
        return;
      }

      const occurredAt = now();
      let session: RotatingSession;

      try {
        session = createRotatingSession({
          now: occurredAt,
          existing: readSession(storage),
          createToken,
        });
        writeSession(storage, session);
      } catch {
        // Analytics must never interrupt the reader if secure randomness or
        // local storage is unavailable.
        return;
      }

      const validation = validateAnonymousEvent({ ...event, session, occurredAt });
      if (!validation.ok) {
        return;
      }

      let idempotencyKey: string;
      try {
        idempotencyKey = `event:${createToken()}`;
      } catch {
        return;
      }

      void send(endpoint, {
        method: "POST",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        keepalive: true,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          type: validation.event.type,
          session: { id: session.id, issuedAt: session.issuedAt },
          occurredAt: validation.event.occurredAt,
          ...eventFields(validation.event),
        }),
      }).catch(() => {
        // Delivery is best-effort and intentionally has no reader-visible UI.
      });
    },
  };
}

function eventFields(event: ValidatedAnonymousEvent) {
  const { type: _type, sessionId: _sessionId, occurredAt: _occurredAt, ...fields } = event;
  return fields;
}

function browserStorage(): BrowserStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function browserFetch() {
  return typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : undefined;
}

function readSession(storage: BrowserStorage | undefined): RotatingSession | undefined {
  if (!storage) return undefined;

  try {
    const stored = storage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return undefined;
    const candidate: unknown = JSON.parse(stored);
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return undefined;
    const { id, issuedAt } = candidate as Partial<RotatingSession>;
    return typeof id === "string" && typeof issuedAt === "string" ? { id, issuedAt } : undefined;
  } catch {
    return undefined;
  }
}

function writeSession(storage: BrowserStorage | undefined, session: RotatingSession): void {
  try {
    storage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // The event remains anonymous when persistence is unavailable; a later
    // event simply starts another opaque session.
  }
}

function secureBrowserToken(): string {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure browser randomness is unavailable.");
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
