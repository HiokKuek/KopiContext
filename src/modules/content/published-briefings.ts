export type BriefingStatus = "draft" | "published";

export type BriefingSource = {
  /** A stable local key when structured Briefing sections cite this source. */
  id?: string;
  title: string;
  publisher: string;
  url: string;
};

/** A separately dated, source-backed development associated with a Topic. */
export type PublishedCurrentUpdate = {
  id: string;
  title: string;
  body: string;
  effectiveAt: string;
  sources: ReadonlyArray<BriefingSource>;
};

type SourceBacked = {
  sourceIds: ReadonlyArray<string>;
};

/** A source-backed visual explainer that can be used by any Briefing Topic. */
export type ConceptMapExplainer = SourceBacked & {
  kind: "concept-map";
  id: string;
  title: string;
  introduction: string;
  centralLabel: string;
  nodes: ReadonlyArray<
    SourceBacked & {
      id: string;
      label: string;
      summary: string;
      details: ReadonlyArray<string>;
      note?: string;
      example?: string;
      learnMoreLabel?: string;
    }
  >;
};

export type ComparisonExplainer = SourceBacked & {
  kind: "comparison";
  id: string;
  title: string;
  introduction?: string;
  question?: string;
  answer?: string;
  columns: { label: string; valueLabel: string };
  rows: ReadonlyArray<
    SourceBacked & {
      label: string;
      value: string;
    }
  >;
};

export type ProcessFlowExplainer = SourceBacked & {
  kind: "process-flow";
  id: string;
  title: string;
  introduction: string;
  steps: ReadonlyArray<
    SourceBacked & {
      title: string;
      explanation: string;
    }
  >;
};

export type ContextualCalloutExplainer = SourceBacked & {
  kind: "contextual-callout";
  id: string;
  title: string;
  body: string;
};

export type BriefingVisualExplainer =
  | ConceptMapExplainer
  | ComparisonExplainer
  | ProcessFlowExplainer
  | ContextualCalloutExplainer;

export type PublishedBriefing = {
  slug: string;
  title: string;
  status: BriefingStatus;
  templateVersion: "v1";
  oneSentenceExplanation: string;
  thirtySecondOverview: string;
  fiveMinuteExplanation: string;
  whyPeopleCare: string;
  /** Ordered explainers that establish the Topic's mental model before detail. */
  visualExplainers?: ReadonlyArray<BriefingVisualExplainer>;
  keyTerms: ReadonlyArray<{ term: string; definition: string }>;
  entities: ReadonlyArray<string>;
  debates: ReadonlyArray<string>;
  singaporeSeaAngle: string;
  questionsToAsk: ReadonlyArray<string>;
  mistakesToAvoid: ReadonlyArray<string>;
  sources: ReadonlyArray<BriefingSource>;
  currentUpdates?: ReadonlyArray<PublishedCurrentUpdate>;
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
      "Start with the map: Singapore has three organs of state. The Legislature makes laws, the Executive gives direction to the government and puts policy into action, and the Judiciary independently administers justice.",
    fiveMinuteExplanation:
      "The three organs have different jobs, but they connect. People elect MPs. Parliament considers Bills and passes laws. The Prime Minister chairs Cabinet, which gives the government its general direction; ministries and statutory boards then deliver policies and public services. The President is the head of state and has specific constitutional roles. The courts independently decide cases by applying the law. This is a useful map, not three sealed boxes: a proposed law can move from policy work to Cabinet, Parliament, presidential assent, implementation and, where a dispute reaches court, judicial interpretation.",
    whyPeopleCare:
      "Knowing which institution does what makes it easier to follow public policy, understand who is accountable, and ask more useful questions about issues that affect daily life.",
    visualExplainers: [
      {
        kind: "concept-map",
        id: "government-branches",
        title: "The big picture",
        introduction:
          "Singapore's Constitution sets out three organs of state: the Legislature, the Executive and the Judiciary. Think of them as a map for understanding who makes laws, who directs and carries out government policy, and who applies the law in court.",
        centralLabel: "Singapore Government",
        sourceIds: ["pmo-government", "constitution", "judiciary-legal-system"],
        nodes: [
        {
          id: "legislature",
          label: "Legislature",
          summary:
            "Makes laws. Parliament considers Bills, debates public issues and approves public spending.",
          details: ["Parliament"],
          note:
            "The President is not a member of the three branches, but the President's authority is required at the final stage of passing legislation.",
          example:
            "If a policy needs a new law, Parliament considers and votes on the Bill before it can become law.",
          learnMoreLabel: "Learn how Parliament works",
          sourceIds: ["parliament-about", "constitution"],
        },
        {
          id: "executive",
          label: "Executive",
          summary:
            "Gives the government its direction and puts policy into action through the Cabinet, ministries and public agencies.",
          details: ["Prime Minister", "Cabinet", "Ministries", "Statutory boards"],
          example:
            "A ministry can develop a policy proposal, while the Cabinet considers major government decisions.",
          learnMoreLabel: "Learn about the Executive",
          sourceIds: ["pmo-government", "constitution"],
        },
        {
          id: "judiciary",
          label: "Judiciary",
          summary:
            "Independently administers justice by interpreting and applying the law when courts decide cases.",
          details: ["Courts"],
          example:
            "When a legal dispute reaches court, judges apply the relevant law to the facts of that case.",
          learnMoreLabel: "Learn how Singapore's courts work",
          sourceIds: ["judiciary-legal-system", "pmo-government"],
        },
        ],
      },
      {
        kind: "comparison",
        id: "government-roles",
        title: "President, Prime Minister and Cabinet",
        question: "Who runs Singapore day to day?",
        answer:
          "The Prime Minister chairs the Cabinet. The Cabinet is the central decision-making body of the executive government and gives the government its general direction.",
        columns: { label: "Role", valueLabel: "Main purpose" },
        sourceIds: ["pmo-government", "constitution", "istana-presidency"],
        rows: [
          {
            label: "President",
            value:
              "Singapore's head of state, with constitutional roles and specific discretionary powers in defined areas.",
            sourceIds: ["istana-presidency", "pmo-government", "constitution"],
          },
          {
            label: "Prime Minister",
            value:
              "The effective head of the Executive who chairs the Cabinet and leads its general policy direction.",
            sourceIds: ["pmo-government", "constitution"],
          },
          {
            label: "Cabinet",
            value:
              "The central decision-making body of the executive government, responsible for the government's general direction and accountable to Parliament.",
            sourceIds: ["pmo-government", "constitution"],
          },
        ],
      },
      {
        kind: "process-flow",
        id: "government-policy-flow",
        title: "How the branches work together",
        introduction:
          "A public-housing example shows how the roles can connect. The exact route depends on the proposal; not every policy change needs a new law.",
        sourceIds: ["pmo-government", "parliament-about", "constitution", "judiciary-legal-system"],
        steps: [
          {
            title: "A ministry develops a proposal",
            explanation:
              "The relevant ministry studies the issue and develops policy options for the government to consider.",
            sourceIds: ["pmo-government"],
          },
          {
            title: "Cabinet considers the policy",
            explanation:
              "The Cabinet discusses and collectively agrees significant decisions and actions of the Executive.",
            sourceIds: ["pmo-government"],
          },
          {
            title: "Parliament considers a Bill when a new law is needed",
            explanation:
              "MPs debate and vote on proposed legislation through Parliament's law-making process.",
            sourceIds: ["parliament-about", "constitution"],
          },
          {
            title: "The President gives assent after a Bill has passed Parliament",
            explanation:
              "A Bill becomes law after it has passed Parliament and received the President's assent.",
            sourceIds: ["constitution", "parliament-about"],
          },
          {
            title: "Public bodies implement the policy or law",
            explanation:
              "Ministries and agencies carry the approved policy into public services and administration.",
            sourceIds: ["pmo-government"],
          },
          {
            title: "Courts apply the law when a case comes before them",
            explanation:
              "The Judiciary independently administers justice by deciding cases under the law.",
            sourceIds: ["judiciary-legal-system", "pmo-government"],
          },
        ],
      },
      {
        kind: "contextual-callout",
        id: "government-policy-example",
        title: "Example: a public-housing policy change",
        body:
          "A policy idea can be developed by the relevant ministry, considered by Cabinet, turned into a Bill when legislation is needed, implemented by public bodies, and interpreted by courts if a legal dispute arises.",
        sourceIds: ["pmo-government", "parliament-about", "constitution", "judiciary-legal-system"],
      },
    ],
    keyTerms: [
      {
        term: "Legislature",
        definition:
          "The organ of state responsible for making laws. Parliament is Singapore's law-making body; the President's authority is required at the final stage of passing legislation.",
      },
      {
        term: "Executive",
        definition:
          "The organ of state that gives the government direction and carries out government policy. The Cabinet is at its centre.",
      },
      {
        term: "Judiciary",
        definition:
          "The courts, which independently administer justice by interpreting and applying the law in cases before them.",
      },
      {
        term: "Parliament",
        definition:
          "Singapore's law-making body. MPs debate and pass laws, scrutinise government policies and approve public spending.",
      },
      {
        term: "Bill",
        definition:
          "A proposed law. It must pass Parliament and receive the President's assent before it becomes law.",
      },
      {
        term: "Cabinet",
        definition:
          "The central decision-making body of the executive government, chaired by the Prime Minister.",
      },
      {
        term: "Prime Minister",
        definition:
          "The effective head of the Executive who chairs the Cabinet and leads the government's general policy direction.",
      },
      {
        term: "President",
        definition:
          "Singapore's head of state, with constitutional roles and specific discretionary powers in defined areas.",
      },
      {
        term: "Ministry",
        definition:
          "A part of the Executive led by a minister. Ministries develop and carry out policy in their areas of responsibility.",
      },
      {
        term: "Statutory board",
        definition:
          "A public body established by law to carry out particular public functions. It commonly works with a ministry.",
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
        id: "pmo-government",
        title: "The Government",
        publisher: "Prime Minister's Office Singapore",
        url: "https://www.pmo.gov.sg/about-us/the-government/",
      },
      {
        id: "judiciary-legal-system",
        title: "About the legal system",
        publisher: "Singapore Judiciary",
        url: "https://www.judiciary.gov.sg/who-we-are/about-legal-system",
      },
      {
        id: "istana-presidency",
        title: "Constitutional",
        publisher: "Office of the President of the Republic of Singapore",
        url: "https://www.istana.gov.sg/the-president/presidents-duties/constitutional/",
      },
      {
        id: "constitution",
        title: "The Singapore Constitution",
        publisher: "Singapore Statutes Online",
        url: "https://sso.agc.gov.sg/Act/CONS1963",
      },
      {
        id: "parliament-about",
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

/** Explicit fixture catalogue for local-development composition only. */
export function listPublishedBriefings(): ReadonlyArray<PublishedBriefing> {
  return briefings.filter((briefing) => briefing.status === "published");
}
