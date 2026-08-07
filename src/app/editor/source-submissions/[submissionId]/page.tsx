import { notFound, redirect } from "next/navigation";
import { EditorAccessDeniedError, EditorAuthenticationRequiredError, requireEditorSession } from "@/modules/auth/editor-auth";
import { loadSourceSubmissionReview } from "@/platform/web/source-submission-review-bff";
import { SourceSubmissionReviewPageContent } from "./source-submission-review";
export const dynamic = "force-dynamic";
export default async function SourceSubmissionReviewRoute({ params }: Readonly<{ params: Promise<{ submissionId: string }> }>) { const { submissionId } = await params; const editor = await editorSession(); const state = await loadSourceSubmissionReview(editor, submissionId); if (state.kind === "not-found") notFound(); if (state.kind === "unavailable") return <p className="editor-route-unavailable">The preparation review service is unavailable. No proposal was loaded.</p>; return <SourceSubmissionReviewPageContent editor={editor} submission={state.submission} />; }
async function editorSession() { try { return await requireEditorSession(); } catch (error) { if (error instanceof EditorAuthenticationRequiredError) redirect("/api/auth/signin?callbackUrl=/editor"); if (error instanceof EditorAccessDeniedError) redirect("/api/auth/error?error=AccessDenied"); throw error; } }
