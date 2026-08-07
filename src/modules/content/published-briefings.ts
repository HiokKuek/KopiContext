export type BriefingStatus = "draft" | "published";

export type BriefingSource = {
  title: string;
  publisher: string;
  url: string;
};

export type PublishedBriefing = {
  slug: string;
  title: string;
  status: BriefingStatus;
  templateVersion: "v1";
  oneSentenceExplanation: string;
  thirtySecondOverview: string;
  fiveMinuteExplanation: string;
  whyPeopleCare: string;
  keyTerms: ReadonlyArray<{ term: string; definition: string }>;
  entities: ReadonlyArray<string>;
  debates: ReadonlyArray<string>;
  singaporeSeaAngle: string;
  questionsToAsk: ReadonlyArray<string>;
  mistakesToAvoid: ReadonlyArray<string>;
  sources: ReadonlyArray<BriefingSource>;
  lastReviewedAt: string;
};

const briefings: readonly PublishedBriefing[] = [
  {
    slug: "how-singapores-government-works",
    title: "How Singapore's Government Works",
    status: "published",
    templateVersion: "v1",
    oneSentenceExplanation:
      "Singapore is a parliamentary democracy: voters elect Members of Parliament, and the Prime Minister leads the government with a Cabinet drawn mainly from Parliament.",
    thirtySecondOverview:
      "Singapore has three branches of government. Parliament makes laws and holds the government to account. The Cabinet, led by the Prime Minister, sets policy and runs ministries. The courts interpret and apply the law independently.",
    fiveMinuteExplanation:
      "At a General Election, citizens vote for Members of Parliament (MPs). The President appoints as Prime Minister the MP who is likely to command the confidence of most MPs. The Prime Minister selects a Cabinet, which is formally appointed by the President. Cabinet ministers lead ministries that develop and carry out public policy. Parliament debates Bills, which become law after they have passed Parliament and received the President's assent. The Judiciary decides cases and safeguards the rule of law.",
    whyPeopleCare:
      "Knowing which institution does what makes it easier to follow public policy, understand who is accountable, and ask more useful questions about issues that affect daily life.",
    keyTerms: [
      {
        term: "Parliament",
        definition: "The legislature, made up of elected and other MPs, which debates and passes laws.",
      },
      {
        term: "Cabinet",
        definition: "The group of ministers led by the Prime Minister that directs the government's policies.",
      },
      {
        term: "President",
        definition: "Singapore's head of state, with constitutional roles and specific custodial powers.",
      },
    ],
    entities: ["Parliament of Singapore", "Cabinet", "President of Singapore", "Judiciary"],
    debates: [
      "How should Parliament scrutinise government policy?",
      "Which decisions should require wider public consultation?",
    ],
    singaporeSeaAngle:
      "Singapore's small size and open economy mean that government decisions often connect domestic priorities with regional and global conditions.",
    questionsToAsk: [
      "Which institution is responsible for this decision?",
      "What process must happen before this proposal can become law?",
      "What evidence or trade-offs did the government set out?",
    ],
    mistakesToAvoid: [
      "Do not treat the President and the Prime Minister as the same role.",
      "Do not assume every government announcement is already a law.",
    ],
    sources: [
      {
        title: "The Singapore Constitution",
        publisher: "Singapore Statutes Online",
        url: "https://sso.agc.gov.sg/Act/CONS1963",
      },
      {
        title: "About Parliament",
        publisher: "Parliament of Singapore",
        url: "https://www.parliament.gov.sg/about-us",
      },
    ],
    lastReviewedAt: "2026-08-07",
  },
  {
    slug: "draft-government-briefing",
    title: "Draft government Briefing",
    status: "draft",
    templateVersion: "v1",
    oneSentenceExplanation: "This draft must not be available to readers.",
    thirtySecondOverview: "This draft must not be available to readers.",
    fiveMinuteExplanation: "This draft must not be available to readers.",
    whyPeopleCare: "This draft must not be available to readers.",
    keyTerms: [],
    entities: [],
    debates: [],
    singaporeSeaAngle: "This draft must not be available to readers.",
    questionsToAsk: [],
    mistakesToAvoid: [],
    sources: [],
    lastReviewedAt: "2026-08-07",
  },
];

/**
 * The public content seam. It intentionally exposes only Briefings that have
 * completed Editorial Approval and are available for readers.
 */
export function getPublishedBriefingBySlug(slug: string): PublishedBriefing | undefined {
  return briefings.find((briefing) => briefing.slug === slug && briefing.status === "published");
}
