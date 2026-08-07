import type { PublishedBriefing } from "@/modules/content/published-briefings";

export type HomeEntryPaths = Readonly<{
  featured?: PublishedBriefing;
  additional: ReadonlyArray<PublishedBriefing>;
}>;

/**
 * Gives an undecided reader one clear first read without inventing popularity
 * or recency. The editorially chosen civic map is preferred when published;
 * otherwise the catalogue's deliberate order supplies the fallback.
 */
export function homeEntryPaths(briefings: ReadonlyArray<PublishedBriefing>): HomeEntryPaths {
  const featured = briefings.find((briefing) => briefing.slug === "how-singapores-government-works") ?? briefings[0];
  return {
    ...(featured ? { featured } : {}),
    additional: featured ? briefings.filter((briefing) => briefing.slug !== featured.slug) : [],
  };
}
