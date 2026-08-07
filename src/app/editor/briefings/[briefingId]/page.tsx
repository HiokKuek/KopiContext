import { notFound, redirect } from "next/navigation";

import { EditorAccessDeniedError, EditorAuthenticationRequiredError, requireEditorSession } from "@/modules/auth/editor-auth";
import { loadEditorialBriefingReview } from "@/platform/web/editorial-review-bff";

import { BriefingReview } from "./briefing-review";
import { transitionBriefingAction, acceptEditorialSourceAction, createEditorialClaimAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function BriefingReviewPage({
  params,
}: Readonly<{ params: Promise<{ briefingId: string }> }>) {
  const { briefingId } = await params;
  const editor = await requireEditorForRoute();
  const state = await loadEditorialBriefingReview(editor, briefingId);
  if (state.kind === "not-found") notFound();
  if (state.kind === "unavailable") {
    return <p className="editor-route-unavailable">The review service is unavailable. No editorial content was loaded.</p>;
  }
  return <BriefingReview editor={editor} review={state.review} transitionAction={transitionBriefingAction.bind(null, briefingId)} sourceAction={acceptEditorialSourceAction.bind(null, briefingId)} claimAction={(sourceId) => createEditorialClaimAction.bind(null, briefingId, state.review.revision.id, sourceId)} />;
}

async function requireEditorForRoute() {
  try {
    return await requireEditorSession();
  } catch (error) {
    if (error instanceof EditorAuthenticationRequiredError) redirect("/api/auth/signin?callbackUrl=/editor");
    if (error instanceof EditorAccessDeniedError) redirect("/api/auth/error?error=AccessDenied");
    throw error;
  }
}
