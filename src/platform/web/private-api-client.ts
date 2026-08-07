import "server-only";

import type { PublishedBriefing } from "@/modules/content/published-briefings";

/**
 * The server-side boundary between the Vercel web application and the private
 * application API. Keep this module out of client components: it holds the
 * service credential used by the web BFF.
 */

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type PrivateApiClientConfig = Readonly<{
  baseUrl: string;
  serviceCredential: string;
  fetch?: FetchLike;
  timeoutMs?: number;
  maxQueryAttempts?: number;
}>;

export type PrivateApiQuery = Readonly<{
  path: string;
  headers?: HeadersInit;
}>;

export type PrivateApiCommand = Readonly<{
  path: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
}>;

export type PrivateApiHealth = Readonly<{
  status: "ok";
  version: "v1";
  checkedAt: string;
}>;

export type PrivateApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation_failed"
  | "timeout"
  | "network_error"
  | "unavailable"
  | "internal_error"
  | "invalid_response";

/** A stable, transport-independent error for callers in the web layer. */
export class PrivateApiClientError extends Error {
  constructor(
    readonly code: PrivateApiErrorCode,
    message: string,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PrivateApiClientError";
  }
}

export type PrivateApiClient = Readonly<{
  query<T>(query: PrivateApiQuery): Promise<T>;
  command<T>(command: PrivateApiCommand): Promise<T>;
  health(): Promise<PrivateApiHealth>;
  getPublishedBriefing(slug: string): Promise<PublishedBriefing>;
}>;

const DEFAULT_TIMEOUT_MS = 2_500;
const DEFAULT_MAX_QUERY_ATTEMPTS = 2;

/**
 * Creates the only client that server-rendered web code may use for the
 * private runtime. Configuration is passed in deliberately so it can be
 * validated at composition time and replaced by a fake fetch in tests.
 */
export function createPrivateApiClient(config: PrivateApiClientConfig): PrivateApiClient {
  const baseUrl = validateBaseUrl(config.baseUrl);
  const serviceCredential = requiredValue(config.serviceCredential, "serviceCredential");
  const timeoutMs = positiveInteger(config.timeoutMs ?? DEFAULT_TIMEOUT_MS, "timeoutMs");
  const maxQueryAttempts = boundedAttempts(config.maxQueryAttempts ?? DEFAULT_MAX_QUERY_ATTEMPTS);
  const fetch = config.fetch ?? globalThis.fetch;

  if (!fetch) {
    throw new Error("A fetch implementation is required to create a private API client.");
  }

  async function query<T>(request: PrivateApiQuery): Promise<T> {
    let lastError: PrivateApiClientError | undefined;

    for (let attempt = 1; attempt <= maxQueryAttempts; attempt += 1) {
      try {
        return await requestJson<T>({
          path: request.path,
          method: "GET",
          headers: request.headers,
          retryable: true,
        });
      } catch (error) {
        const mapped = asPrivateApiError(error);
        lastError = mapped;

        if (!isRetryable(mapped) || attempt === maxQueryAttempts) {
          throw mapped;
        }
      }
    }

    // The loop either returns or throws. This satisfies TypeScript while
    // retaining a stable error if that invariant ever changes.
    throw lastError ?? new PrivateApiClientError("internal_error", "The private API query could not complete.");
  }

  function command<T>(request: PrivateApiCommand): Promise<T> {
    // Commands are intentionally attempted once. Retrying a write may create
    // duplicate editorial work when the first request reached the server.
    return requestJson<T>({
      path: request.path,
      method: request.method,
      headers: request.headers,
      body: request.body,
      retryable: false,
    });
  }

  async function requestJson<T>(request: {
    path: string;
    method: "GET" | PrivateApiCommand["method"];
    headers?: HeadersInit;
    body?: unknown;
    retryable: boolean;
  }): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const headers = new Headers(request.headers);
      headers.set("Authorization", `Bearer ${serviceCredential}`);
      headers.set("Accept", "application/json");

      const init: RequestInit = {
        method: request.method,
        headers,
        signal: controller.signal,
        cache: "no-store",
      };

      if (request.body !== undefined) {
        headers.set("Content-Type", "application/json");
        init.body = JSON.stringify(request.body);
      }

      const response = await fetch(resolvePath(baseUrl, request.path), init);

      if (!response.ok) {
        throw await errorFromResponse(response);
      }

      return await jsonBody<T>(response);
    } catch (error) {
      if (error instanceof PrivateApiClientError) {
        throw error;
      }

      if (timedOut) {
        throw new PrivateApiClientError("timeout", "The private API did not respond before the request timed out.", undefined, {
          cause: error,
        });
      }

      throw new PrivateApiClientError("network_error", "The private API could not be reached.", undefined, {
        cause: error,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    query,
    command,
    health: () => query<PrivateApiHealth>({ path: "/v1/healthz" }),
    getPublishedBriefing: (slug) =>
      query<PublishedBriefing>({ path: `/v1/public/briefings/${encodeURIComponent(slug)}` }),
  };
}

async function jsonBody<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new PrivateApiClientError("invalid_response", "The private API returned invalid JSON.", response.status, {
      cause: error,
    });
  }
}

async function errorFromResponse(response: Response): Promise<PrivateApiClientError> {
  const body = await safeJson(response);
  const message = errorMessage(body) ?? messageForStatus(response.status);
  const code = errorCode(body) ?? codeForStatus(response.status);

  return new PrivateApiClientError(code, message, response.status);
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function errorCode(body: unknown): PrivateApiErrorCode | undefined {
  if (!isErrorEnvelope(body)) {
    return undefined;
  }

  return isPrivateApiErrorCode(body.error.code) ? body.error.code : undefined;
}

function errorMessage(body: unknown): string | undefined {
  return isErrorEnvelope(body) ? body.error.message : undefined;
}

function isErrorEnvelope(value: unknown): value is { error: { code: string; message: string } } {
  if (!value || typeof value !== "object" || !("error" in value)) {
    return false;
  }

  const error = value.error;
  return Boolean(
    error
      && typeof error === "object"
      && "code" in error
      && "message" in error
      && typeof error.code === "string"
      && typeof error.message === "string",
  );
}

function isPrivateApiErrorCode(code: string): code is PrivateApiErrorCode {
  return [
    "bad_request",
    "unauthorized",
    "forbidden",
    "not_found",
    "conflict",
    "validation_failed",
    "timeout",
    "network_error",
    "unavailable",
    "internal_error",
    "invalid_response",
  ].includes(code);
}

function codeForStatus(status: number): PrivateApiErrorCode {
  if (status === 400) return "bad_request";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 422) return "validation_failed";
  if (status === 429 || status >= 502) return "unavailable";
  return "internal_error";
}

function messageForStatus(status: number): string {
  if (status === 401) return "The private API rejected the service credential.";
  if (status === 404) return "The requested private API resource does not exist.";
  if (status === 429 || status >= 502) return "The private API is temporarily unavailable.";
  return "The private API could not complete the request.";
}

function isRetryable(error: PrivateApiClientError): boolean {
  return error.code === "network_error" || error.code === "timeout" || error.code === "unavailable" || error.status === 500;
}

function resolvePath(baseUrl: URL, path: string): URL {
  if (!path.startsWith("/v1/")) {
    throw new Error("Private API paths must begin with /v1/.");
  }

  return new URL(path, baseUrl);
}

function validateBaseUrl(value: string): URL {
  const raw = requiredValue(value, "baseUrl");
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error("baseUrl must be an absolute HTTP(S) URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("baseUrl must be an absolute HTTP(S) URL.");
  }

  return url;
}

function requiredValue(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${name} must not be empty.`);
  }

  return trimmed;
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

function boundedAttempts(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 3) {
    throw new Error("maxQueryAttempts must be an integer between 1 and 3.");
  }

  return value;
}

function asPrivateApiError(error: unknown): PrivateApiClientError {
  if (error instanceof PrivateApiClientError) {
    return error;
  }

  return new PrivateApiClientError("network_error", "The private API could not be reached.", undefined, {
    cause: error,
  });
}
