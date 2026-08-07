import type { TopicRequestTransport } from "@/modules/discovery/topic-request";
import { validateTopicRequest } from "@/modules/discovery/topic-request";

export type TopicRequestRouteHandlerDependencies = Readonly<{
  topicRequests: TopicRequestTransport;
}>;

/**
 * Transport-neutral logic for the same-origin Next Route Handler. Parsing is
 * deliberately strict: no browser payload beyond `requestedTopic` is retained
 * or forwarded to the private runtime.
 */
export function createTopicRequestRouteHandler(
  dependencies: TopicRequestRouteHandlerDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const body = await jsonRequestBody(request);
    if (!isTopicRequestBody(body)) {
      return invalidRequestResponse();
    }

    const validation = validateTopicRequest(body);
    if (!validation.ok) {
      return invalidRequestResponse();
    }

    try {
      const submission = await dependencies.topicRequests.submit(validation.request);
      if (submission.status !== "received") {
        return unavailableResponse();
      }
      return Response.json({ status: "received" }, { status: 202 });
    } catch {
      // Private error details can identify deployment topology or credentials;
      // the reader only needs a safe retryable outcome.
      return unavailableResponse();
    }
  };
}

async function jsonRequestBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function isTopicRequestBody(value: unknown): value is Readonly<{ requestedTopic: string }> {
  return (
    typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && Object.keys(value).length === 1
    && "requestedTopic" in value
    && typeof value.requestedTopic === "string"
  );
}

function invalidRequestResponse(): Response {
  return Response.json(
    { error: { code: "invalid_request", message: "The Topic request is invalid." } },
    { status: 400 },
  );
}

function unavailableResponse(): Response {
  return Response.json(
    {
      error: {
        code: "topic_requests_unavailable",
        message: "Topic requests are unavailable right now. Please try again later.",
      },
    },
    { status: 503 },
  );
}
