"use client";

import { useEffect } from "react";
import { createBrowserAnalyticsClient } from "@/modules/analytics/browser-analytics-client";

type AnalyticsSearchProps = Readonly<{
  query: string;
  hasResult: boolean;
}>;

/** Records only the normalised query already used to render this search result. */
export function AnalyticsSearch({ query, hasResult }: AnalyticsSearchProps) {
  useEffect(() => {
    if (!query) return;

    const analytics = createBrowserAnalyticsClient();
    analytics.record({ type: "search", query });
    if (!hasResult) analytics.record({ type: "no-result-search", query });
  }, [hasResult, query]);

  return null;
}
