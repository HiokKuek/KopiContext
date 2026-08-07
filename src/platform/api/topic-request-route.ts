import type { FastifyInstance } from "fastify";

import { type TopicRequestTransport, validateTopicRequest } from "@/modules/discovery/topic-request";
import { TopicRequestRejectedError } from "@/modules/discovery/topic-request-command";

/**
 * This is a private BFF command, never a browser endpoint. App-level service
 * authentication protects it before this handler sees a request.
 */
export type TopicRequestCommand = TopicRequestTransport;

type InvalidRequestBody = Readonly<{
  error: Readonly<{
    code: "invalid_request";
    message: "The Topic request is invalid.";
  }>;
}>;

/**
 * Accepts the one allow-listed public value and sends it to the aggregate-only
 * discovery command. It rejects extra fields before they can cross the HTTP
 * boundary, including accidental browser metadata or network information.
 */
export function registerTopicRequestRoute(app: FastifyInstance, topicRequests: TopicRequestCommand): void {
  app.post<{ Body: unknown }>("/v1/discovery/topic-requests", async (request, reply) => {
    const requestBody = readTopicRequest(request.body);
    if (!requestBody) {
      return reply.code(400).send(invalidRequestBody());
    }

    const validation = validateTopicRequest(requestBody);
    if (!validation.ok) {
      return reply.code(400).send(invalidRequestBody());
    }

    try {
      const submission = await topicRequests.submit(validation.request);
      return reply.code(202).send(submission);
    } catch (error) {
      if (error instanceof TopicRequestRejectedError) {
        return reply.code(400).send(invalidRequestBody());
      }
      throw error;
    }
  });
}

function readTopicRequest(value: unknown): Readonly<{ requestedTopic: string }> | undefined {
  if (!isPlainObject(value) || Object.keys(value).length !== 1 || !("requestedTopic" in value)) {
    return undefined;
  }
  if (typeof value.requestedTopic !== "string") {
    return undefined;
  }
  return { requestedTopic: value.requestedTopic };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidRequestBody(): InvalidRequestBody {
  return { error: { code: "invalid_request", message: "The Topic request is invalid." } };
}
