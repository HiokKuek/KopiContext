"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  EditorAccessDeniedError,
  EditorAuthenticationRequiredError,
  requireEditorSession,
} from "@/modules/auth/editor-auth";
import { submitEditorialTransition, type EditorialTransitionSubmission } from "@/platform/web/editorial-review-bff";

export type EditorialTransitionActionState =
  | Readonly<{ kind: "idle"; message: "" }>
  | EditorialTransitionSubmission;

/**
 * Same-origin Server Action for the review decision panel. It authenticates on
 * every POST, derives the audit actor from that session, and accepts no actor
 * or credential from rendered form fields.
 */
export async function transitionBriefingAction(
  briefingId: string,
  _previousState: EditorialTransitionActionState,
  formData: FormData,
): Promise<EditorialTransitionActionState> {
  const editor = await requireEditorForAction();
  const result = await submitEditorialTransition(
    editor,
    briefingId,
    formData.get("action"),
    formData.get("reason"),
    formData.get("confirm-publication"),
  );
  if (result.kind === "success") {
    revalidatePath(`/editor/briefings/${encodeURIComponent(briefingId)}`);
    revalidatePath("/editor");
  }
  return result;
}

async function requireEditorForAction() {
  try {
    return await requireEditorSession();
  } catch (error) {
    if (error instanceof EditorAuthenticationRequiredError) {
      redirect("/api/auth/signin?callbackUrl=/editor");
    }
    if (error instanceof EditorAccessDeniedError) {
      redirect("/api/auth/error?error=AccessDenied");
    }
    throw error;
  }
}
