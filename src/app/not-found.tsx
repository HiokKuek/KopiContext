import Link from "next/link";

export default function NotFound() {
  return (
    <main className="empty-page" id="main-content">
      <p className="eyebrow">Topic not found</p>
      <h1>We do not have that Briefing yet.</h1>
      <p>
        This Topic may still be in editorial review, or the link may be out of date.
      </p>
      <Link className="text-link" href="/topics/how-singapores-government-works">
        Read how Singapore&apos;s Government Works
      </Link>
    </main>
  );
}
