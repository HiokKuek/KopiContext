"use server";
import { redirect } from "next/navigation";
import { EditorAccessDeniedError, EditorAuthenticationRequiredError, requireEditorSession } from "@/modules/auth/editor-auth";
import { acceptPreparedProposal, type PreparedProposalAcceptanceResult } from "@/platform/web/prepared-proposal-acceptance-bff";
export type ProposalAcceptanceActionState=Readonly<{kind:"idle";message:""}>|PreparedProposalAcceptanceResult;
export async function acceptProposalAction(submissionId:string,outputFingerprint:string,_previous:ProposalAcceptanceActionState,formData:FormData):Promise<ProposalAcceptanceActionState>{const editor=await session();const result=await acceptPreparedProposal(editor,{submissionId,expectedOutputFingerprint:outputFingerprint,topicSlug:formData.get("topic-slug"),topicDescription:formData.get("topic-description"),confirmed:formData.get("confirm-acceptance")});if(result.kind==="success") redirect(`/editor/briefings/${encodeURIComponent(result.briefingId)}`);return result;}
async function session(){try{return await requireEditorSession();}catch(error){if(error instanceof EditorAuthenticationRequiredError)redirect("/api/auth/signin?callbackUrl=/editor");if(error instanceof EditorAccessDeniedError)redirect("/api/auth/error?error=AccessDenied");throw error;}}
