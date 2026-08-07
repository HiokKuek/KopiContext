import type { FastifyInstance } from "fastify";

import {
  type ValidatedAnonymousEvent,
  validateAnonymousEvent,
} from "@/modules/analytics/anonymous-events";

/**
 * The only persistence/delivery seam for public analytics. Implementations
 * receive the allow-listed event created by the analytics module, never a
 * Fastify request or unvalidated browser payload.
 */
export type AnonymousAnalyticsEventCommand = Readonly<{
  record(
    input: Readonly<{
      event: ValidatedAnonymousEvent;
      idempotencyKey?: string;
    }>,
  ): Promise<void> | void;
}>;

type InvalidRequestBody = Readonly<{
  error: Readonly<{
    code: "invalid_request";
    message: "The analytics event request is invalid.";
  }>;
}>;

const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,200}$/;

/**
 * Registers the intentionally public analytics collection endpoint. It does
 * not use service authentication because a browser may call it; deploy it only
 * behind the public web/BFF ingress described in the runtime documentation.
 */
export function registerAnonymousAnalyticsEventRoute(
  app: FastifyInstance,
  analyticsEvents: AnonymousAnalyticsEventCommand,
): void {
  app.post<{ Body: unknown }>("/v1/public/analytics/events", async (request, reply) => {
    const result = validateAnonymousEvent(request.body);
    const idempotencyKey = readIdempotencyKey(request.headers["idempotency-key"]);

    if (!result.ok || idempotencyKey === false) {
      return reply.code(400).send(invalidRequestBody());
    }

    await analyticsEvents.record({
      event: result.event,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });

    // Do not echo submitted payloads: browser metadata should not become part
    // of a response, intermediary log, or client-side data flow.
    return reply.code(202).send({ accepted: true });
  });
}

function readIdempotencyKey(value: string | string[] | undefined): string | false | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value) || !IDEMPOTENCY_KEY.test(value)) {
    return false;
  }

  return value;
}

function invalidRequestBody(): InvalidRequestBody {
  return {
    error: {
      code: "invalid_request",
      message: "The analytics event request is invalid.",
    },
  };
}
