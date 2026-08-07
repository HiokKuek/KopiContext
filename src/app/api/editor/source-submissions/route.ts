import { requireEditorSession } from "@/modules/auth/editor-auth";
import { createEditorSourceSubmissionRouteHandler } from "@/platform/web/editor-source-submission-route-handler";
import { createSourceSubmissionBffFromEnvironment } from "@/platform/web/source-submission-bff";

export const runtime = "nodejs";

/** A same-origin editor BFF; private credentials never reach this route's caller. */
const handler = createEditorSourceSubmissionRouteHandler({
  requireEditor: requireEditorSession,
  sourceSubmissions: {
    queue(request) {
      // Resolve server-only runtime configuration only after strict form
      // validation and editor-session verification have completed.
      return createSourceSubmissionBffFromEnvironment().queue(request);
    },
  },
});

export function POST(request: Request): Promise<Response> {
  return handler(request);
}
