"use client";

import { useEffect } from "react";
import { createBrowserAnalyticsClient } from "@/modules/analytics/browser-analytics-client";

type AnalyticsTopicViewProps = Readonly<{
  topicSlug: string;
}>;

/** Records a published Topic identifier, never article text or reader data. */
export function AnalyticsTopicView({ topicSlug }: AnalyticsTopicViewProps) {
  useEffect(() => {
    createBrowserAnalyticsClient().record({ type: "topic-view", topicSlug });
  }, [topicSlug]);

  return null;
}
