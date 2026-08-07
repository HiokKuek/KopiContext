# Launch content inventory

This is the maintained editorial plan for the 25-Topic controlled launch in
[the launch catalogue](launch-catalogue.md). It makes the product promise
concrete: the controlled launch is not complete until every listed Topic has
one **Published** baseline Briefing.

It is not a publishing shortcut. A candidate link below is a research lead,
not an accepted Source; an editor must still assess rights, provenance,
freshness, and Claim support through the Editorial Workflow. Agents may use
the inventory to suggest Source Submissions and placement, but cannot update
status, accept Sources, or publish.

## Completion gate

For every row, the editorial lead must be able to point to one durable
Briefing record that is:

1. in the **Published** Editorial Workflow state, with an Editorial Approval
   audit record;
2. complete against [Briefing Template v1](../prd/0002-briefing-template-and-reader-experience.md), including a reader-friendly mental model where the Topic is a system or process;
3. made of Claims supported by editor-accepted Sources, with Sources and a
   review date visible to readers; and
4. reviewed against the row's freshness category, with changing developments
   kept in separate Current Updates.

The status below is a repository planning status as at **2026-08-07**, not a
query of a production database. `Review draft` means a source-linked editorial
working document exists, but it is still not proof of accepted evidence,
Editorial Approval, or publication. `Prototype fixture` means the repository has a
local-development visual fixture only; it is specifically not proof of
Editorial Approval, accepted evidence, or production publication. `Planned`
means no durable editorial artefact is recorded in this repository yet. The
editorial lead changes a row to `Published` only after the four checks above
are evidenced in the editorial system.

## Freshness categories

| Category | Review expectation | How changing information is handled |
| --- | --- | --- |
| Structural | Review at least yearly | Update the Briefing when the durable model changes; use a Current Update for a dated development. |
| Policy/service | Review at least quarterly | Check official rules, services, and programmes; put dated changes in a Current Update. |
| Data/industry | Review at least quarterly | Recheck definitions and statistics; date changing measures and developments. |
| Fast-moving risk/technology | Review at least monthly | Recheck authoritative guidance; use Current Updates for material changes. |
| Seasonal/event | Review annually and before the relevant season/event | Keep the baseline evergreen; place dates, schedules, and results in Current Updates. |

## Inventory

“Candidate source families” are deliberately small, primary or authoritative
starting points. Editors should retrieve the specific stable document or data
release that supports a Claim, record its own date and URL, and add independent
corroboration when a Claim is contested, interpretive, or current.

### Civic understanding

| Topic | Repository status | Baseline scope | Freshness | Candidate source families |
| --- | --- | --- | --- | --- |
| How Singapore's Government Works | Review draft — [open draft](../drafts/how-singapores-government-works-review-draft.md); not launch evidence | Three organs of state; how law and policy move; President, Prime Minister, Cabinet, ministries and courts. Exclude party/candidate or live-political analysis. | Structural | [PMO: The Government](https://www.pmo.gov.sg/about-us/the-government/); [Singapore Courts: legal system](https://www.judiciary.gov.sg/who-we-are/about-legal-system); [Parliament](https://www.parliament.gov.sg/); [Singapore Statutes Online](https://sso.agc.gov.sg/) |
| Parliament and Elections | Planned | Parliament's work, a Bill's path, constituencies and voting process. Exclude candidate/party comparison and live election coverage. | Policy/service | [Parliament: Bills](https://www.parliament.gov.sg/parliamentary-business/bills); [Elections Department](https://www.eld.gov.sg/); [Constitution on Singapore Statutes Online](https://sso.agc.gov.sg/Act/CONS1963); [PMO: The Government](https://www.pmo.gov.sg/about-us/the-government/) |
| HDB and Public Housing | Planned | What public housing is; HDB's role; flat types, home ownership and resale vocabulary; separate changing grants/prices/policies. | Policy/service | [HDB: public housing](https://www.hdb.gov.sg/residential); [HDB: buying a flat](https://www.hdb.gov.sg/residential/buying-a-flat); [HDB: resale](https://www.hdb.gov.sg/residential/buying-a-flat/resale); [SingStat](https://tablebuilder.singstat.gov.sg/) |
| CPF | Planned | The compulsory savings framework, account purposes, contribution basics and links to housing, healthcare and retirement. Not personal financial advice. | Policy/service | [CPF overview](https://www.cpf.gov.sg/member/cpf-overview); [CPF contributions](https://www.cpf.gov.sg/member/growing-your-savings/cpf-contributions); [CPF LIFE](https://www.cpf.gov.sg/member/plan-your-finances/retirement-income); [CPF statistics](https://www.cpf.gov.sg/member/infohub/reports-and-statistics/cpf-statistics) |
| Digital Government | Review draft — [open draft](../drafts/digital-government-review-draft.md); not launch evidence | Digital public services, national digital identity, service design and digital inclusion. Avoid exposing sensitive account-operation advice. | Policy/service | [GovTech digital services](https://www.tech.gov.sg/products-and-services/for-citizens/digital-services/); [GovTech digital identity](https://www.tech.gov.sg/about-us/what-we-do/our-digital-government-efforts/digital-identity/); [Smart Nation](https://www.smartnation.gov.sg/); [IMDA digital inclusion](https://www.imda.gov.sg/how-we-can-help/digital-inclusion) |

### Economy, business, and region

| Topic | Repository status | Baseline scope | Freshness | Candidate source families |
| --- | --- | --- | --- | --- |
| Singapore's Economy | Review draft — [open draft](../drafts/singapores-economy-review-draft.md); not launch evidence | Economic model, major sectors, core measures and why openness/productivity matter. Date all statistics. | Data/industry | [Ministry of Trade and Industry](https://www.mti.gov.sg/); [SingStat Table Builder](https://tablebuilder.singstat.gov.sg/); [Monetary Authority of Singapore](https://www.mas.gov.sg/); [Singapore Economic Survey](https://isomer-user-content.by.gov.sg/36/4b35edda-a313-4f15-a92a-ca241dc6d63d/singapore-economic-survey-2025.pdf) |
| Trade and the Port | Review draft — [open draft](../drafts/trade-and-the-port-review-draft.md); not launch evidence | The port's role, maritime services, transhipment and trade vocabulary; date throughput and rankings. | Data/industry | [Maritime and Port Authority: global hub port](https://www.mpa.gov.sg/maritime-singapore/what-maritime-singapore-offers/global-hub-port); [MPA port statistics](https://www.mpa.gov.sg/who-we-are/newsroom-resources/research-and-statistics/port-statistics); [Singapore Customs](https://www.customs.gov.sg/); [Enterprise Singapore trade](https://www.enterprisesg.gov.sg/) |
| Startups and Venture Capital | Review draft — [open draft](../drafts/startups-and-venture-capital-review-draft.md); not launch evidence | Startup ecosystem, funding-stage vocabulary, public support and the role of investors. Avoid investment recommendations. | Data/industry | [Enterprise Singapore: Startup SG](https://www.enterprisesg.gov.sg/grow-your-business/partner-with-singapore/innovation-and-startups/join-startup-sg); [Enterprise Singapore: Startup investment](https://www.enterprisesg.gov.sg/grow-your-business/partner-with-singapore/innovation-and-startups/invest-in-startups); [ACRA](https://www.acra.gov.sg/); [MAS fund-management statistics](https://www.mas.gov.sg/statistics/financial-institutions) |
| ASEAN | Planned | What ASEAN is, its institutions, consensus-based cooperation and relevance to Singapore. Separate live diplomatic developments. | Policy/service | [ASEAN Secretariat](https://asean.org/); [ASEAN Charter](https://asean.org/the-asean-charter/); [Singapore MFA: ASEAN](https://www.mfa.gov.sg/international-organisations/asean/); [ASEANstats](https://aseanstats.org/) |
| Global Supply Chains | Planned | How value chains, shipping, logistics, inventory and trade rules connect to everyday prices and businesses. | Data/industry | [WTO: trade facilitation](https://www.wto.org/english/tratop_e/dtt_e/dtt-tradfa_e.htm); [UNCTAD: global trade](https://unctad.org/topic/trade-analysis); [MPA](https://www.mpa.gov.sg/); [Singapore Customs](https://www.customs.gov.sg/) |
| Regional Geopolitics as Durable Background | Planned | Geography, regional institutions, strategic constraints and terms for understanding Southeast Asian discussions. Exclude live conflict/political analysis and predictions. | Policy/service | [Singapore MFA foreign policy](https://www.mfa.gov.sg/about-mfa/foreign-policy/); [ASEAN Secretariat](https://asean.org/); [UN Charter](https://www.un.org/en/about-us/un-charter); [MFA speeches and statements](https://www.mfa.gov.sg/newsroom/) |

### Technology and infrastructure

| Topic | Repository status | Baseline scope | Freshness | Candidate source families |
| --- | --- | --- | --- | --- |
| Generative AI | Review draft — [open draft](../drafts/generative-ai-review-draft.md); not launch evidence | Plain-language concepts, capabilities, limits, common risks and responsible-use vocabulary. Do not present model outputs as authoritative. | Fast-moving risk/technology | [IMDA AI](https://www.imda.gov.sg/AI); [AI Verify Foundation](https://aiverifyfoundation.sg/); [PDPC AI governance](https://www.pdpc.gov.sg/help-and-resources/2020/01/model-ai-governance-framework); [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) |
| Semiconductors | Review draft — [open draft](../drafts/semiconductors-review-draft.md); not launch evidence | What chips are, simplified value chain, why chips matter and Singapore's ecosystem. Date capacity/industry figures. | Data/industry | [EDB semiconductor industry](https://www.edb.gov.sg/en/our-industries/semiconductor.html); [A*STAR Institute of Microelectronics](https://www.a-star.edu.sg/ime); [Enterprise Singapore](https://www.enterprisesg.gov.sg/); [SingStat manufacturing data](https://tablebuilder.singstat.gov.sg/) |
| Cybersecurity | Review draft — [open draft](../drafts/cybersecurity-review-draft.md); not launch evidence | Everyday risk, defensive concepts, public/organisation roles and how to use authoritative guidance. Never give incident-specific security advice as a Briefing. | Fast-moving risk/technology | [Cyber Security Agency](https://www.csa.gov.sg/); [CSA public resources](https://www.csa.gov.sg/information-for/general-public/); [SingCERT](https://www.csa.gov.sg/singcert); [Cybersecurity Act](https://www.csa.gov.sg/legislation/cybersecurity-act/) |
| Data Centres | Review draft — [open draft](../drafts/data-centres-review-draft.md); not launch evidence | What data centres do, why Singapore hosts them, and energy/land/resource trade-offs. Date capacity and allocation details. | Data/industry | [IMDA Green DC Roadmap](https://www.imda.gov.sg/how-we-can-help/green-dc-roadmap); [IMDA Digital Connectivity Blueprint](https://www.imda.gov.sg/resources/press-releases-factsheets-and-speeches/factsheets/2023/singapore-to-strengthen-its-position-as-a-global-digital-hub); [BCA Green Mark](https://www1.bca.gov.sg/buildsg/sustainability/green-mark-certification-scheme); [EMA](https://www.ema.gov.sg/) |
| Energy Transition | Review draft — [open draft](../drafts/energy-transition-review-draft.md); not launch evidence | Electricity system, energy security, decarbonisation choices and regional connections. Avoid advice about individual energy investments. | Policy/service | [Energy Market Authority](https://www.ema.gov.sg/); [EMA energy transition](https://www.ema.gov.sg/news-events/news/feature-stories/2026/singapore-energy-transition-progress-security-and-preparation); [National Climate Change Secretariat](https://www.nccs.gov.sg/); [Singapore Green Plan](https://www.greenplan.gov.sg/) |
| The Green Plan and Climate Adaptation | Review draft — [open draft](../drafts/green-plan-and-climate-adaptation-review-draft.md); not launch evidence | The Green Plan's framework, climate risks, adaptation, mitigation and relevant everyday trade-offs. Date targets and progress. | Policy/service | [Singapore Green Plan](https://www.greenplan.gov.sg/); [Green Plan targets](https://www.greenplan.gov.sg/targets/); [National Climate Change Secretariat](https://www.nccs.gov.sg/); [PUB coastal protection](https://www.pub.gov.sg/coastal-protection) |

### Everyday Singapore

| Topic | Repository status | Baseline scope | Freshness | Candidate source families |
| --- | --- | --- | --- | --- |
| Public Transport | Review draft — [open draft](../drafts/public-transport-review-draft.md); not launch evidence | Rail, bus and active-mobility roles; network/service vocabulary; policy trade-offs. Date fares, routes and disruptions separately. | Policy/service | [Land Transport Authority](https://www.lta.gov.sg/); [LTA public transport](https://www.lta.gov.sg/content/ltagov/en/who_we_are/our_work/land_transport_master_plan_2040.html); [Public Transport Council](https://www.ptc.gov.sg/); [Ministry of Transport](https://www.mot.gov.sg/) |
| COE and Road Pricing | Review draft — [open draft](../drafts/coe-and-road-pricing-review-draft.md); not launch evidence | Why vehicle controls and road pricing exist, how COE and ERP work at a high level, and their trade-offs. Date quota, premiums and rates separately. | Policy/service | [LTA: Certificate of Entitlement](https://onemotoring.lta.gov.sg/content/onemotoring/home/buying/upfront-vehicle-costs/certificate-of-entitlement--coe-.html); [LTA: ERP](https://onemotoring.lta.gov.sg/content/onemotoring/home/driving/road-usage/erp.html); [Ministry of Transport](https://www.mot.gov.sg/); [Singapore Statutes Online](https://sso.agc.gov.sg/) |
| Ageing in Singapore | Review draft — [open draft](../drafts/ageing-in-singapore-review-draft.md); not launch evidence | Demographic change, care, work, housing and community implications. Avoid individual medical, legal or financial advice. | Data/industry | [MOH: Ageing Well](https://www.moh.gov.sg/ageing-well/); [MOH population statistics](https://www.moh.gov.sg/others/resources-and-statistics/population-and-vital-statistics/); [Agency for Integrated Care](https://www.aic.sg/); [SingStat population data](https://tablebuilder.singstat.gov.sg/) |
| Hawker Culture | Review draft — [open draft](../drafts/hawker-culture-review-draft.md); not launch evidence | Hawker centres as food, work and community spaces; heritage and sustainability questions. Keep individual stall reviews out of scope. | Structural | [NEA hawker culture](https://www.nea.gov.sg/our-services/hawker-management/programmes-and-grants/hawker-culture); [National Heritage Board Roots](https://www.roots.gov.sg/); [UNESCO intangible heritage](https://ich.unesco.org/en/RL/hawker-culture-in-singapore-community-dining-and-culinary-practices-in-a-multicultural-urban-context-01539); [NEA hawker management](https://www.nea.gov.sg/our-services/hawker-management) |
| Singapore's Multicultural Festivals | Review draft — [open draft](../drafts/singapores-multicultural-festivals-review-draft.md); not launch evidence | Respectful overview of selected major traditions, observances and public-holiday context; distinguish faith from public celebration. | Seasonal/event | [National Heritage Board: festivals](https://www.roots.gov.sg/stories-landing/stories/festivals-in-singapore/festivals-in-singapore); [Roots intangible cultural heritage](https://www.roots.gov.sg/ich-landing); [Ministry of Manpower public holidays](https://www.mom.gov.sg/employment-practices/public-holidays); [National Library Board](https://www.nlb.gov.sg/) |
| Local Arts | Review draft — [open draft](../drafts/local-arts-review-draft.md); not launch evidence | Local arts ecosystem, institutions, funding and ways audiences/artists participate. Date event line-ups and funding calls separately. | Data/industry | [National Arts Council](https://www.nac.gov.sg/); [Singapore Cultural Statistics](https://www.nac.gov.sg/resources/research/others/singapore-cultural-statistics); [National Heritage Board](https://www.nhb.gov.sg/); [Esplanade](https://www.esplanade.com/) |

### Sport and shared culture

| Topic | Repository status | Baseline scope | Freshness | Candidate source families |
| --- | --- | --- | --- | --- |
| Formula 1 Singapore | Review draft — [open draft](../drafts/formula-1-singapore.md); not launch evidence | What the Singapore Grand Prix is, its event vocabulary, local significance and public trade-offs. Do not embed schedules, results or ticket guidance in the baseline. | Seasonal/event | [Singapore Grand Prix](https://singaporegp.sg/en); [Singapore Tourism Board](https://www.stb.gov.sg/); [FIA Formula One regulations](https://www.fia.com/regulation/category/110); [Land Transport Authority](https://www.lta.gov.sg/) |
| Football in Singapore | Review draft — [open draft](../drafts/football-in-singapore.md); not launch evidence | Local football's governing structure, leagues/pathways, regional links and spectator vocabulary. Keep live results, transfers and squad selections separate. | Seasonal/event | [Football Association of Singapore](https://www.fas.org.sg/); [Sport Singapore](https://www.sportsingapore.gov.sg/); [Asian Football Confederation](https://www.the-afc.com/); [FIFA](https://inside.fifa.com/) |

## Editorial use and maintenance

1. Start a Topic only after the editorial lead chooses a row and identifies a
   concrete, rights-appropriate Source Submission or official document to
   retrieve.
2. Keep the Briefing's Claims narrow enough that each can be supported by the
   accepted Sources; do not treat this inventory as a pre-approved outline.
3. Update the row's status only from an editorial-system record. Suggested
   values are `Planned`, `Preparing`, `In editorial review`, `Published`, and
   `Needs refresh`; retain a short link or identifier to the published
   Briefing once it exists.
4. At the review cadence, check whether the durable mental model remains true.
   Put dated changes into a Current Update, and return a Briefing to the
   Editorial Workflow when its baseline needs revision.

The product-research agent uses reader demand, no-result searches, and
freshness signals to recommend work within this list. The editorial lead alone
decides the sequence and publication. See the [product-team operating loop](../teams/product-team.md#weekly-operating-loop).
