import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { AnalyticsPageView } from "./analytics/analytics-page-view";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "KopiContext",
    template: "%s | KopiContext",
  },
  description:
    "Concise, source-backed context for joining conversations thoughtfully.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-SG">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to briefing
        </a>
        <Suspense fallback={null}>
          <AnalyticsPageView />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
