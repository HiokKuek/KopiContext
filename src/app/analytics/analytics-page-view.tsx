"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createBrowserAnalyticsClient } from "@/modules/analytics/browser-analytics-client";

/** Isolated client island so the rest of the application remains server-rendered. */
export function AnalyticsPageView() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) {
      createBrowserAnalyticsClient().record({ type: "page-view", path: pathname });
    }
  }, [pathname]);

  return null;
}
