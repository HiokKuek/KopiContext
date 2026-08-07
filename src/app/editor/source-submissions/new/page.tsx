import Link from "next/link";
import { redirect } from "next/navigation";

import {
  EditorAccessDeniedError,
  EditorAuthenticationRequiredError,
  requireEditorSession,
} from "@/modules/auth/editor-auth";

import { SourceSubmissionForm } from "./source-submission-form";

export const dynamic = "force-dynamic";

/** Private entry point for material that may later be prepared by a worker. */
export default async function NewSourceSubmissionPage() {
  let editor;
  try {
    editor = await requireEditorSession();
  } catch (error) {
    if (error instanceof EditorAuthenticationRequiredError) {
      redirect("/api/auth/signin?callbackUrl=/editor/source-submissions/new");
    }
    if (error instanceof EditorAccessDeniedError) {
      redirect("/api/auth/error?error=AccessDenied");
    }
    throw error;
  }

  return (
    <>
      <header className="editor-header">
        <Link className="wordmark" href="/editor" aria-label="KopiContext editor home">
          Kopi<span>Context</span> <small>editor</small>
        </Link>
        <nav aria-label="Editor account">
          <span className="editor-identity">{editor.email}</span>
          <Link href="/api/auth/signout?callbackUrl=/">Sign out</Link>
        </nav>
      </header>

      <main id="main-content" className="editor-shell editor-material-page">
        <header className="editor-intro material-intro">
          <Link className="editor-back-link" href="/editor">← Review queue</Link>
          <p className="eyebrow">Source Submission</p>
          <ol className="review-path" aria-label="Material review path">
            <li aria-current="step">Material</li>
            <li>Preparation</li>
            <li>Evidence</li>
            <li>Decision</li>
          </ol>
          <h1>Hand over material for review</h1>
          <p>
            Record where it came from and any rights context. It stays a submission until you later review the evidence.
          </p>
        </header>

        <SourceSubmissionForm editorEmail={editor.email} />
      </main>
    </>
  );
}
