import { redirect } from "next/navigation";
import { EditorAccessDeniedError, EditorAuthenticationRequiredError, requireEditorSession } from "@/modules/auth/editor-auth";
import { NewBriefingForm } from "./new-briefing-form";

export const dynamic = "force-dynamic";
export default async function NewBriefingPage() { await requireEditor(); return <NewBriefingForm />; }
async function requireEditor() { try { await requireEditorSession(); } catch (error) { if (error instanceof EditorAuthenticationRequiredError) redirect("/api/auth/signin?callbackUrl=/editor/briefings/new"); if (error instanceof EditorAccessDeniedError) redirect("/api/auth/error?error=AccessDenied"); throw error; } }
