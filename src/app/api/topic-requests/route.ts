import { createTopicRequestBffTransportFromEnvironment } from "@/platform/web/topic-request-bff";
import { createTopicRequestRouteHandler } from "@/platform/web/topic-request-route-handler";

// The BFF holds a private service credential and must not run in an Edge
// environment where the deployment contract differs from the private runtime.
export const runtime = "nodejs";

/** Same-origin browser endpoint; private API credentials stay server-side. */
const handler = createTopicRequestRouteHandler({
  topicRequests: {
    submit(request) {
      // Resolve configuration only after the public payload has passed strict
      // validation. The reusable handler maps configuration/private failures
      // to the same safe unavailable response.
      return createTopicRequestBffTransportFromEnvironment().submit(request);
    },
  },
});

export function POST(request: Request): Promise<Response> {
  return handler(request);
}
