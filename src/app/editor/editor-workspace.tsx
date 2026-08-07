import Link from "next/link";

import type { EditorIdentity } from "@/modules/auth/editor-auth";
import type { EditorialWorkQueue } from "@/modules/editorial/editorial-read-model";
import type { EditorWorkspaceQueueState } from "@/platform/web/editor-workspace-bff";

export function EditorWorkspace({
  editor,
  queueState,
}: Readonly<{
  editor: EditorIdentity;
  queueState: EditorWorkspaceQueueState;
}>) {
  return (
    <>
      <EditorHeader editor={editor} />

      <main id="main-content" className="editor-shell">
        <header className="editor-intro">
          <p className="eyebrow">Review path</p>
          <ol className="review-path" aria-label="Editorial review path">
            <li aria-current="step">Queue</li>
            <li>Evidence</li>
            <li>Decision</li>
            <li>Record</li>
          </ol>
          <h1>Your review queue</h1>
          <p>
            Review the evidence first. Publishing remains a deliberate, recorded decision.
          </p>
        </header>

        {queueState.kind === "available" ? <EditorialQueue queue={queueState.queue} /> : <UnavailableQueue />}
      </main>
    </>
  );
}

export function EditorHeader({ editor }: Readonly<{ editor: EditorIdentity }>) {
  return <header className="editor-header">
    <Link className="wordmark" href="/editor" aria-label="KopiContext editor home">
      Kopi<span>Context</span> <small>editor</small>
    </Link>
    <nav aria-label="Editor account">
      <span className="editor-identity">{editor.email}</span>
      <Link href="/api/auth/signout?callbackUrl=/">Sign out</Link>
    </nav>
  </header>;
}

function UnavailableQueue() {
  return (
    <section className="editor-unavailable" aria-labelledby="queue-unavailable-heading">
      <p className="section-kicker">Review queue</p>
      <h2 id="queue-unavailable-heading">The review queue is not connected yet.</h2>
      <p>
        Your editor session is active, but the private read service is not available for this workspace yet.
        No editorial items are shown until the server can load an authoritative queue.
      </p>
      <Link className="text-link" href="/editor">Try the queue again</Link>
    </section>
  );
}

function EditorialQueue({ queue }: Readonly<{ queue: EditorialWorkQueue }>) {
  const total = queue.items.length;
  return (
    <section className="editor-queue" aria-labelledby="queue-heading">
      <div className="queue-heading">
        <div>
          <p className="section-kicker">Review queue</p>
          <h2 id="queue-heading">{total === 1 ? "1 Briefing needs attention" : `${total} Briefings need attention`}</h2>
        </div>
        <p aria-label={`${queue.countsByStatus.published} published Briefings`}>
          {queue.countsByStatus.published} published
        </p>
      </div>
      {total === 0 ? (
        <p className="editor-empty">Nothing needs your judgement right now.</p>
      ) : (
        <ol className="editor-queue-list">
          {queue.items.map((item) => (
            <li key={item.briefingId}>
              <Link href={`/editor/briefings/${encodeURIComponent(item.briefingId)}`}>
                <p className="queue-topic">{item.topicTitle}</p>
                <h3>{item.title}</h3>
                <p>
                  <span className="status-token">{formatStatus(item.status)}</span>
                  {item.completeness.missingSectionCount > 0
                    ? ` ${item.completeness.missingSectionCount} template sections missing.`
                    : " Template complete."}
                  {item.completeness.unsupportedClaimCount > 0
                    ? ` ${item.completeness.unsupportedClaimCount} Claims need support.`
                    : ""}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function formatStatus(status: string): string {
  return status.replaceAll("-", " ");
}
