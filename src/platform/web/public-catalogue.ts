import "server-only";

import {
  getPublishedBriefingBySlug,
  listPublishedBriefings,
  type PublishedBriefing,
} from "@/modules/content/published-briefings";

import {
  PrivateApiClientError,
  createPrivateApiClient,
  type PrivateApiClient,
} from "./private-api-client";

export type PublicCatalogue = Readonly<{
  findPublishedBriefingBySlug(slug: string): Promise<PublishedBriefing | undefined>;
  listPublishedBriefings(): Promise<ReadonlyArray<PublishedBriefing>>;
}>;

export type PublicCatalogueRuntimeMode = "production" | "local-development";

/**
 * Server-only reader catalogue composition. Production data is always read
 * through the private application API; checked-in Briefings are deliberately
 * available only when local-development is named explicitly.
 */
export function createPublicCatalogueFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): PublicCatalogue {
  const mode = readRuntimeMode(environment.PUBLIC_CATALOGUE_RUNTIME_MODE);
  if (mode === "local-development") {
    return fixtureCatalogue();
  }

  const slugs = readPublishedSlugs(environment.PUBLIC_CATALOGUE_SLUGS);
  const privateApi = createPrivateApiClient({
    baseUrl: requiredEnvironmentValue(environment, "PRIVATE_API_BASE_URL"),
    serviceCredential: requiredEnvironmentValue(environment, "PRIVATE_API_SERVICE_CREDENTIAL"),
  });
  return privateApiCatalogue(privateApi, slugs);
}

export function fixtureCatalogue(): PublicCatalogue {
  return {
    async findPublishedBriefingBySlug(slug) {
      return getPublishedBriefingBySlug(slug);
    },
    async listPublishedBriefings() {
      return listPublishedBriefings();
    },
  };
}

export function privateApiCatalogue(
  privateApi: Pick<PrivateApiClient, "getPublishedBriefing">,
  publishedSlugs: ReadonlyArray<string>,
): PublicCatalogue {
  const configuredSlugs = [...publishedSlugs];
  return {
    async findPublishedBriefingBySlug(slug) {
      if (!configuredSlugs.includes(slug)) return undefined;
      return fetchPublishedBriefing(privateApi, slug);
    },
    async listPublishedBriefings() {
      const results = await Promise.all(configuredSlugs.map((slug) => fetchPublishedBriefing(privateApi, slug)));
      return results.filter((briefing): briefing is PublishedBriefing => briefing !== undefined);
    },
  };
}

async function fetchPublishedBriefing(
  privateApi: Pick<PrivateApiClient, "getPublishedBriefing">,
  slug: string,
): Promise<PublishedBriefing | undefined> {
  try {
    const briefing = await privateApi.getPublishedBriefing(slug);
    return isPublishedBriefing(briefing) ? briefing : undefined;
  } catch (error) {
    // A stale catalogue manifest must never turn an absent/depublished item
    // into an application error or an unpublished reader result.
    if (error instanceof PrivateApiClientError && error.code === "not_found") return undefined;
    throw error;
  }
}

function readRuntimeMode(value: string | undefined): PublicCatalogueRuntimeMode {
  const mode = value?.trim() || "production";
  if (mode === "production" || mode === "local-development") return mode;
  throw new Error("PUBLIC_CATALOGUE_RUNTIME_MODE must be either production or local-development.");
}

function readPublishedSlugs(value: string | undefined): ReadonlyArray<string> {
  const slugs = value?.split(",").map((slug) => slug.trim()).filter(Boolean) ?? [];
  if (slugs.length === 0) {
    throw new Error("PUBLIC_CATALOGUE_SLUGS must list one or more published Briefing slugs in production mode.");
  }
  if (new Set(slugs).size !== slugs.length || slugs.some((slug) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) {
    throw new Error("PUBLIC_CATALOGUE_SLUGS must contain unique, lowercase URL slugs.");
  }
  return slugs;
}

function requiredEnvironmentValue(
  environment: Readonly<Record<string, string | undefined>>,
  name: "PRIVATE_API_BASE_URL" | "PRIVATE_API_SERVICE_CREDENTIAL",
): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} must be configured for the production public catalogue.`);
  return value;
}

function isPublishedBriefing(value: unknown): value is PublishedBriefing {
  if (!isRecord(value) || value.status !== "published" || value.templateVersion !== "v1") return false;
  return (
    isNonEmptyString(value.slug)
    && isNonEmptyString(value.title)
    && isNonEmptyString(value.oneSentenceExplanation)
    && isNonEmptyString(value.thirtySecondOverview)
    && isNonEmptyString(value.fiveMinuteExplanation)
    && isNonEmptyString(value.whyPeopleCare)
    && isNonEmptyString(value.singaporeSeaAngle)
    && isNonEmptyString(value.lastReviewedAt)
    && Array.isArray(value.keyTerms)
    && Array.isArray(value.entities)
    && Array.isArray(value.debates)
    && Array.isArray(value.questionsToAsk)
    && Array.isArray(value.mistakesToAvoid)
    && Array.isArray(value.sources)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
