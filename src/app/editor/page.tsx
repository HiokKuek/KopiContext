import { redirect } from "next/navigation";

import {
  EditorAccessDeniedError,
  EditorAuthenticationRequiredError,
  requireEditorSession,
} from "@/modules/auth/editor-auth";
import { loadEditorWorkspaceQueue } from "@/platform/web/editor-workspace-bff";

import { EditorWorkspace } from "./editor-workspace";

/** Auth is request-time state, therefore this private route is never statically rendered. */
export const dynamic = "force-dynamic";

export default async function EditorQueuePage() {
  let editor;
  try {
    editor = await requireEditorSession();
  } catch (error) {
    if (error instanceof EditorAuthenticationRequiredError) {
      redirect("/api/auth/signin?callbackUrl=/editor");
    }
    if (error instanceof EditorAccessDeniedError) {
      redirect("/api/auth/error?error=AccessDenied");
    }
    throw error;
  }

  const queueState = await loadEditorWorkspaceQueue(editor);
  return <EditorWorkspace editor={editor} queueState={queueState} />;
}
