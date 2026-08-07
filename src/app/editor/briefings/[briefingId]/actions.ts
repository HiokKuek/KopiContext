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
import {
  createEditorialClaim,
  type EditorialClaimSubmission,
} from "@/platform/web/editorial-claim-bff";
import {
  createCurrentUpdateWithSupport,
  type CurrentUpdateSubmission,
} from "@/platform/web/current-update-bff";

export type EditorialTransitionActionState =
  | Readonly<{ kind: "idle"; message: "" }>
  | EditorialTransitionSubmission;
export type HumanRevisionActionState = Readonly<{ kind: "idle"; message: "" }> | HumanRevisionSubmission;
export type EditorialSourceActionState =
  | Readonly<{ kind: "idle" | "invalid" | "rejected" | "unavailable"; message: string }>
  | Readonly<{ kind: "success"; message: string; acceptedSourceId: string }>;
export type EditorialClaimActionState = Readonly<{ kind: "idle"; message: "" }> | EditorialClaimSubmission;
export type CurrentUpdateActionState = Readonly<{ kind: "idle"; message: "" }> | CurrentUpdateSubmission;

export async function acceptEditorialSourceAction(
  briefingId: string,
  _previous: EditorialSourceActionState,
  form: FormData,
): Promise<EditorialSourceActionState> {
  const editor = await requireEditorForAction();
  if (form.get("confirm") !== "accept") {
    return { kind: "invalid", message: "Confirm that you reviewed this Source." };
  }

  const source = sourceOf(form);
  if (!source) return { kind: "invalid", message: "Complete all Source metadata." };

  const result = await acceptEditorialSource(editor, source);
  if (result.kind !== "success") return result;

  revalidatePath(`/editor/briefings/${briefingId}`);
  return {
    kind: "success",
    message: "Source accepted. Add a supported Claim below.",
    acceptedSourceId: result.acceptedSourceId,
  };
}

export async function createEditorialClaimAction(
  briefingId: string,
  briefingRevisionId: string,
  acceptedSourceId: string,
  _previous: EditorialClaimActionState,
  form: FormData,
): Promise<EditorialClaimActionState> {
  const editor = await requireEditorForAction();
  if (form.get("confirm-claim") !== "create") {
    return { kind: "invalid", message: "Confirm that you checked this statement against the Source." };
  }

  const statement = text(form.get("statement"));
  const excerpt = text(form.get("excerpt"));
  const rationale = text(form.get("rationale"));
  if (!statement || !excerpt || !rationale) {
    return { kind: "invalid", message: "Add a statement, its exact supporting excerpt, and a rationale." };
  }

  const result = await createEditorialClaim(editor, {
    briefingId,
    briefingRevisionId,
    acceptedSourceId,
    claim: { statement, excerpt, rationale },
  });
  if (result.kind === "success") {
    revalidatePath(`/editor/briefings/${briefingId}`);
    revalidatePath("/editor");
  }
  return result;
}

export async function createCurrentUpdateAction(
  briefingId: string,
  _previous: CurrentUpdateActionState,
  form: FormData,
): Promise<CurrentUpdateActionState> {
  const editor = await requireEditorForAction();
  if (form.get("confirm-current-update") !== "create") {
    return { kind: "invalid", message: "Confirm that you have checked this update against the accepted Source." };
  }

  const title = text(form.get("title"));
  const body = text(form.get("body"));
  const effectiveAt = toIso(text(form.get("effectiveAt")));
  const acceptedSourceId = text(form.get("acceptedSourceId"));
  const excerpt = text(form.get("excerpt"));
  const rationale = text(form.get("rationale"));
  if (!title || !body || !effectiveAt || !acceptedSourceId || !excerpt || !rationale) {
    return { kind: "invalid", message: "Complete the update, effective date, Source, exact excerpt, and rationale." };
  }

  const result = await createCurrentUpdateWithSupport(editor, {
    briefingId,
    title,
    body,
    effectiveAt,
    acceptedSourceId,
    excerpt,
    rationale,
  });
  if (result.kind === "success") {
    revalidatePath(`/editor/briefings/${briefingId}`);
    revalidatePath("/editor");
  }
  return result;
}

function sourceOf(form: FormData): EditorialSource | undefined {
  const get = (name: string) => text(form.get(name));
  const title = get("title");
  const publisher = get("publisher");
  const sourceType = get("sourceType");
  const canonicalUrl = get("canonicalUrl");
  const retrievedAt = toIso(get("retrievedAt"));
  const relation = get("relation");
  const rightsNote = get("rightsNote");
  if (!title || !publisher || !sourceType || !canonicalUrl || !retrievedAt || !relation || !rightsNote) return undefined;

  return { title, publisher, sourceType, canonicalUrl, retrievedAt, relation, rightsNote };
}

function toIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

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
