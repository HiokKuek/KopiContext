import "server-only";

import type { TopicRequest, TopicRequestSubmission, TopicRequestTransport } from "@/modules/discovery/topic-request";

import { createPrivateApiClient, type PrivateApiClient } from "./private-api-client";

const TOPIC_REQUEST_PATH = "/v1/discovery/topic-requests";

/**
 * The server-only web BFF adapter. It does not inspect browser headers,
 * cookies, IP addresses, or user-agent data; its only input is the validated
 * Topic request passed by the route handler.
 */
export function createTopicRequestBffTransport(privateApi: Pick<PrivateApiClient, "command">): TopicRequestTransport {
  return {
    async submit(request: TopicRequest): Promise<TopicRequestSubmission> {
      const response = await privateApi.command<unknown>({
        path: TOPIC_REQUEST_PATH,
        method: "POST",
        body: { requestedTopic: request.requestedTopic },
      });

      if (!isReceivedSubmission(response)) {
        throw new Error("The private API returned an invalid Topic-request response.");
      }

      return response;
    },
  };
}

/** Creates the BFF transport from server-only Vercel configuration. */
export function createTopicRequestBffTransportFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): TopicRequestTransport {
  const baseUrl = requiredEnvironmentValue(environment, "PRIVATE_API_BASE_URL");
  const serviceCredential = requiredEnvironmentValue(environment, "PRIVATE_API_SERVICE_CREDENTIAL");
  return createTopicRequestBffTransport(createPrivateApiClient({ baseUrl, serviceCredential }));
}

function isReceivedSubmission(value: unknown): value is TopicRequestSubmission {
  return (
    typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && Object.keys(value).length === 1
    && "status" in value
    && value.status === "received"
  );
}

function requiredEnvironmentValue(
  environment: Readonly<Record<string, string | undefined>>,
  name: "PRIVATE_API_BASE_URL" | "PRIVATE_API_SERVICE_CREDENTIAL",
): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be set for the Topic-request BFF.`);
  }
  return value;
}
