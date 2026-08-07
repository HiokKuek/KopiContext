import { notFound, redirect } from "next/navigation";

import { EditorAccessDeniedError, EditorAuthenticationRequiredError, requireEditorSession } from "@/modules/auth/editor-auth";
import { loadEditorialBriefingReview } from "@/platform/web/editorial-review-bff";

import { RevisionForm } from "./revision-form";
import { createHumanRevisionAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ReviseBriefingPage({ params }: Readonly<{ params: Promise<{ briefingId: string }> }>) {
  const { briefingId } = await params;
  const editor = await editorForRoute();
  const state = await loadEditorialBriefingReview(editor, briefingId);
  if (state.kind === "not-found") notFound();
  if (state.kind === "unavailable") return <p className="editor-route-unavailable">The review service is unavailable. No Briefing content was loaded.</p>;
  if (state.review.briefing.status !== "draft") return <p className="editor-route-unavailable">Return this Briefing to Draft before creating a new revision.</p>;
  return <RevisionForm briefing={state.review.briefing} revision={state.review.revision} action={createHumanRevisionAction.bind(null, briefingId, state.review.revision.id)} />;
}

async function editorForRoute() {
  try { return await requireEditorSession(); } catch (error) {
    if (error instanceof EditorAuthenticationRequiredError) redirect("/api/auth/signin?callbackUrl=/editor");
    if (error instanceof EditorAccessDeniedError) redirect("/api/auth/error?error=AccessDenied");
    throw error;
  }
}
