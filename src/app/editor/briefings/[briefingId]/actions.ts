"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  EditorAccessDeniedError,
  EditorAuthenticationRequiredError,
  requireEditorSession,
} from "@/modules/auth/editor-auth";
import { submitEditorialTransition, type EditorialTransitionSubmission } from "@/platform/web/editorial-review-bff";
import { createHumanRevision, type HumanRevisionSubmission } from "@/platform/web/human-revision-bff";
import type { TemplateV1RevisionContent } from "@/modules/editorial/create-human-revision-command";
import { acceptEditorialSource } from "@/platform/web/editorial-source-bff";
import type { EditorialSource } from "@/modules/evidence/accept-editorial-source-command";

export type EditorialTransitionActionState =
  | Readonly<{ kind: "idle"; message: "" }>
  | EditorialTransitionSubmission;
export type HumanRevisionActionState = Readonly<{ kind: "idle"; message: "" }> | HumanRevisionSubmission;
export type EditorialSourceActionState = Readonly<{kind:"idle"|"invalid"|"rejected"|"unavailable";message:string}>;
export async function acceptEditorialSourceAction(briefingId:string,_:EditorialSourceActionState,form:FormData):Promise<EditorialSourceActionState>{const editor=await requireEditorForAction();if(form.get("confirm")!=="accept")return{kind:"invalid",message:"Confirm that you reviewed this Source."};const source=sourceOf(form);if(!source)return{kind:"invalid",message:"Complete all Source metadata."};const result=await acceptEditorialSource(editor,source);if(result.kind==="success"){revalidatePath(`/editor/briefings/${briefingId}`);return{kind:"idle",message:"Source accepted."}}return result;}
function sourceOf(f:FormData):EditorialSource|undefined{const get=(n:string)=>text(f.get(n));const title=get("title"),publisher=get("publisher"),sourceType=get("sourceType"),canonicalUrl=get("canonicalUrl"),retrievedAt=get("retrievedAt"),relation=get("relation"),rightsNote=get("rightsNote");return title&&publisher&&sourceType&&canonicalUrl&&retrievedAt&&relation&&rightsNote?{title,publisher,sourceType,canonicalUrl,retrievedAt:new Date(retrievedAt).toISOString(),relation,rightsNote}:undefined}

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

export async function createHumanRevisionAction(
  briefingId: string,
  expectedRevisionId: string,
  _previousState: HumanRevisionActionState,
  formData: FormData,
): Promise<HumanRevisionActionState> {
  const editor = await requireEditorForAction();
  const content = contentFromForm(formData);
  if (!content) return { kind: "invalid", message: "Check the structured fields. Each list needs one plain-text item per line, and key terms use “Term :: definition”." };
  const result = await createHumanRevision(editor, { briefingId, expectedRevisionId, content, note: text(formData.get("note")) });
  if (result.kind === "success") {
    revalidatePath(`/editor/briefings/${encodeURIComponent(briefingId)}`);
    revalidatePath("/editor");
  }
  return result;
}

function contentFromForm(formData: FormData): TemplateV1RevisionContent | undefined {
  const required = ["oneSentenceExplanation", "thirtySecondOverview", "fiveMinuteExplanation", "whyPeopleCare", "singaporeSeaAngle"] as const;
  const fields = Object.fromEntries(required.map((name) => [name, text(formData.get(name))]));
  if (required.some((name) => fields[name] === undefined)) return undefined;
  const keyTerms = lines(formData.get("keyTerms")).map((line) => {
    const [term, ...definition] = line.split("::");
    return { term: term?.trim(), definition: definition.join("::").trim() };
  });
  if (keyTerms.some((term) => !term.term || !term.definition)) return undefined;
  const visualExplainers = optionalJson(formData.get("visualExplainers"));
  if (visualExplainers === "invalid") return undefined;
  return {
    ...fields as Record<(typeof required)[number], string>, keyTerms: keyTerms as Array<{ term: string; definition: string }>,
    entities: lines(formData.get("entities")), debates: lines(formData.get("debates")), questionsToAsk: lines(formData.get("questionsToAsk")), mistakesToAvoid: lines(formData.get("mistakesToAvoid")),
    ...(visualExplainers === undefined ? {} : { visualExplainers: visualExplainers as TemplateV1RevisionContent["visualExplainers"] }),
  };
}
function text(value: FormDataEntryValue | null): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function lines(value: FormDataEntryValue | null): string[] { return typeof value === "string" ? value.split("\n").map((line) => line.trim()).filter(Boolean) : []; }
function optionalJson(value: FormDataEntryValue | null): unknown | "invalid" | undefined { if (typeof value !== "string" || !value.trim()) return undefined; try { return JSON.parse(value); } catch { return "invalid"; } }

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
