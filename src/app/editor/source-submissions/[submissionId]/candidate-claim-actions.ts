"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EditorAccessDeniedError, EditorAuthenticationRequiredError, requireEditorSession } from "@/modules/auth/editor-auth";
import { acceptCandidateClaim, type CandidateClaimAcceptanceResult } from "@/platform/web/candidate-claim-acceptance-bff";

export type CandidateClaimAcceptanceActionState = Readonly<{ kind: "idle"; message: "" }> | CandidateClaimAcceptanceResult;

export async function acceptCandidateClaimAction(submissionId: string, fingerprint: string, candidateIndex: number, _previous: CandidateClaimAcceptanceActionState, formData: FormData): Promise<CandidateClaimAcceptanceActionState> {
  const editor = await session();
  const result = await acceptCandidateClaim(editor, {
    submissionId,
    expectedOutputFingerprint: fingerprint,
    candidateIndex,
    briefingRevisionId: formData.get("briefing-revision-id"),
    acceptedSourceId: formData.get("accepted-source-id"),
    confirmed: formData.get("confirm-candidate-claim"),
  });
  if (result.kind === "success") revalidatePath(`/editor/source-submissions/${encodeURIComponent(submissionId)}`);
  return result;
}

async function session() {
  try { return await requireEditorSession(); }
  catch (error) {
    if (error instanceof EditorAuthenticationRequiredError) redirect("/api/auth/signin?callbackUrl=/editor");
    if (error instanceof EditorAccessDeniedError) redirect("/api/auth/error?error=AccessDenied");
    throw error;
  }
}
