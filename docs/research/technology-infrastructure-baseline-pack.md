# Technology and infrastructure baseline research pack

**Prepared:** 2026-08-07

**For:** controlled-launch Topics 12–17 in the [launch catalogue](../product/launch-catalogue.md)
**Status:** research leads only — not accepted Sources, Claims, or publishable Briefings

This pack gives the editor a small, primary-source starting point for six
baseline Briefings. It is deliberately written as **claim candidates**, not
copy. Each candidate must be checked against the linked source at editorial
review, converted into a narrow Claim, and supported by an accepted Source
before it appears in a Briefing.

The proposed structures use [Briefing Template v1](../prd/0002-briefing-template-and-reader-experience.md): orient the reader first, explain the
system in plain English, make trade-offs visible, then offer questions for a
conversation. Time-sensitive statistics, targets, projects, company examples,
incident trends, and policy progress belong in a dated Current Update unless
the editor has freshly verified them for a revised baseline.

## Research method and source policy

- Singapore government agencies, statutory boards, legislation, and official
  framework owners are the first choice. NIST is used only for a general AI
  risk-management lens where Singapore-specific material does not define a
  technical concept.
- Official promotional pages can establish an agency's stated policy or a
  programme's scope. They do not by themselves establish a contested outcome,
  comparative ranking, or economic impact.
- Links were checked on 2026-08-07. Page “last updated” dates and the date of
  a downloaded document should be captured when a Source is accepted.
- The pack intentionally avoids model/provider comparisons, investment or
  security advice, exact capacity figures, and projections as evergreen facts.

## 1. Generative AI

### Reader mental model

```text
Instructions + data  →  generative model  →  generated text, image, audio, or code
                              │
                    can be useful but can be wrong,
                    biased, unsafe, or unsuitable
                              │
                       people and organisations
                    decide how to check and use it
```

### Durable claim candidates

| Candidate | Primary support | Editorial note |
| --- | --- | --- |
| Generative AI is a type of AI used to produce new content; its output should be treated as generated material, not automatically as evidence or an authority. | [IMDA: Artificial Intelligence in Singapore](https://www.imda.gov.sg/AI) | State the concept simply; do not imply that all systems work in the same way. Use a current technical source if explaining training or model architecture. |
| Responsible deployment is not only a technical question: Singapore's governance approach includes accountability, appropriate human involvement, operations management, and clear communication with stakeholders. | [PDPC: Singapore's Approach to AI Governance](https://www.pdpc.gov.sg/help-and-resources/2020/01/model-ai-governance-framework) | This describes guidance, not a guarantee that a system is safe, fair, or lawful. |
| IMDA's generative-AI governance work frames the area as evolving and calls for practices that support trust as well as innovation. | [IMDA: Model AI Governance Framework for Generative AI](https://www.imda.gov.sg/AI) | Verify the named edition and whether guidance is final before naming it. |
| A reader can distinguish a model's ability to generate plausible content from whether that content is accurate, suitable, or permitted to use. | [PDPC governance principles](https://www.pdpc.gov.sg/help-and-resources/2020/01/model-ai-governance-framework) | This is a pedagogical conclusion supported by principles such as transparency, safety, accountability, and human oversight; label it as a practical reading habit, not a finding about every model. |

### Template v1-oriented outline

1. **One-sentence answer:** Generative AI can make new content from a prompt or other input, but people still need to decide whether its output is accurate, appropriate, and safe to use.
2. **30-second overview:** input → model → output → human checking and organisational safeguards.
3. **Five-minute explanation:** what “generate” means; examples of output; why plausible output is not proof; where governance and human accountability fit.
4. **Why people care:** work, study, public services, creativity, privacy, and misinformation concerns.
5. **Key terms:** generative AI, model, prompt, output, evaluation, human oversight. Keep terms local to this Briefing rather than adding them to the product glossary.
6. **Singapore angle:** IMDA/PDPC governance guidance and the distinction between guidance and regulation.
7. **Questions / mistakes:** “What was the output checked against?”; avoid treating a confident answer as a cited answer.

**Freshness:** monthly. Model capabilities, governance materials, security advice,
and named tools change rapidly. Keep provider announcements and live policy
developments in Current Updates.

## 2. Semiconductors

### Reader mental model

```text
Design  →  make wafers  →  package and test  →  components in electronics
   │            │                 │
 specialised firms, equipment, materials, skills, and logistics connect the chain
```

### Durable claim candidates

| Candidate | Primary support | Editorial note |
| --- | --- | --- |
| A semiconductor is material whose electrical behaviour can be controlled, which makes it useful for electronic components commonly called chips. | [A*STAR Institute of Microelectronics](https://www.a-star.edu.sg/ime) | Retrieve an IME technical explainer or another educational primary institutional source before accepting the definition; its landing page establishes IME's role, not necessarily this definition verbatim. |
| The semiconductor value chain includes activities such as integrated-circuit design, wafer fabrication, packaging, and testing; one firm or country need not do every stage. | [EDB: Singapore's Semiconductor Industry](https://www.edb.gov.sg/en/our-industries/semiconductor.html) | This is a simplified map, not a complete manufacturing process. Avoid claims about a universal order or supply-chain ownership. |
| Singapore's official investment agency describes its local ecosystem as spanning design, wafer fabrication, packaging, and testing. | [EDB: Singapore's Semiconductor Industry](https://www.edb.gov.sg/en/our-industries/semiconductor.html) | Attribute this as EDB's description. Do not turn industry figures or company lists into evergreen claims. |
| Chips matter because electronics use components designed to process, store, sense, control, or communicate information and power. | [A*STAR Institute of Microelectronics](https://www.a-star.edu.sg/ime) | Support any detailed examples with an appropriate technical source. Do not infer that every device needs the same type of chip. |

### Template v1-oriented outline

1. **One-sentence answer:** Chips are small electronic components; making them is a long chain of specialised design, manufacturing, packaging, and testing work.
2. **30-second overview:** visual value-chain map, then the reason a disruption at one stage can affect products elsewhere.
3. **Five-minute explanation:** controlled electrical behaviour; design versus fabrication; wafer, packaging, and testing; why precision, equipment, materials, and skills matter.
4. **Why people care:** phones, vehicles, appliances, data infrastructure, jobs, trade, and supply-chain resilience.
5. **Singapore angle:** use the EDB ecosystem description without making changing output, investment, or employment figures baseline facts.
6. **Questions / mistakes:** “Which stage is being discussed?”; avoid using “chip shortage” as though it describes one single product or cause.

**Freshness:** quarterly. Refresh official ecosystem statistics and policy
programmes. Treat company investment, capacity, exports, shortages, and trade
restrictions as dated developments.

## 3. Cybersecurity

### Reader mental model

```text
People + devices + accounts + data
          │
 common controls: update • unique passwords/passkeys • MFA • verify requests • report
          │
 reduce risk and limit harm; they do not make risk disappear
```

### Durable claim candidates

| Candidate | Primary support | Editorial note |
| --- | --- | --- |
| Cybersecurity is a shared resilience problem involving individuals, organisations, and national systems, rather than a job for only IT specialists. | [CSA: About CSA](https://www.csa.gov.sg/about-csa/) | Phrase as an orientation model. The page establishes CSA's mission; avoid implying shared responsibility transfers an organisation's legal duties to individuals. |
| Cyber hygiene measures can reduce the likelihood or impact of some common cyber harms, but they cannot eliminate all risk. | [CSA: General-public resources](https://www.csa.gov.sg/information-for/general-public/) | Link to the exact current public guidance when accepting the Claim; advice changes with threats. |
| A data breach may involve unauthorised access to, collection, use, disclosure, copying, modification, or disposal of personal data, and can include loss of a device or storage medium in circumstances where unauthorised access is likely. | [CSA: Protecting yourself and your organisation from data breaches](https://www.csa.gov.sg/alerts-and-advisories/advisories/ad-2023-001/) | This is CSA's explanatory description. For legal duties or statutory definitions, source the relevant legislation/PDPC guidance separately. |
| SingCERT is a national incident-response capability that publishes alerts and provides an incident-reporting route. | [SingCERT](https://www.csa.gov.sg/singcert) | Verify current reporting instructions at publication; do not use a baseline as real-time incident advice. |

### Template v1-oriented outline

1. **One-sentence answer:** Cybersecurity is the ongoing work of protecting accounts, devices, networks, and data from harm—not a one-time product someone installs.
2. **30-second overview:** assets → common threats → practical controls → reporting/recovery.
3. **Five-minute explanation:** phishing/social engineering, credential theft, malware, vulnerabilities, and breach; explain that the exact technical cause differs by incident.
4. **Why people care:** money, privacy, essential services, trust, and business continuity.
5. **Singapore angle:** CSA's public role and SingCERT; point to live official advisories rather than reproduce them.
6. **Questions / mistakes:** “What is being protected and from what?”; avoid blaming victims or sharing unverified incident details.

**Freshness:** monthly and after material CSA/SingCERT guidance changes. Keep
active threats, vulnerability instructions, scam tactics, and incident reports
out of the evergreen Briefing unless rewritten as a dated Current Update.

## 4. Data Centres

### Reader mental model

```text
Apps and online services
          ↓
servers, storage, and networking in a data centre
          ↓
electricity + cooling + land + water/resource planning
          ↓
digital capability alongside sustainability and resilience trade-offs
```

### Durable claim candidates

| Candidate | Primary support | Editorial note |
| --- | --- | --- |
| Data centres are foundational digital infrastructure: they host computing, storage, networking, and the services that depend on them. | [IMDA: Green Data Centre Roadmap](https://www.imda.gov.sg/how-we-can-help/green-dc-roadmap) | Use a current operational/technical source if explaining individual hardware components. |
| Data centres are power- and resource-intensive, so Singapore's policy frames continued data-centre growth together with energy efficiency and green-energy considerations. | [IMDA: Green Data Centre Roadmap](https://www.imda.gov.sg/how-we-can-help/green-dc-roadmap) | Attribute the policy framing to IMDA. Do not imply that “green” removes all resource trade-offs. |
| Singapore's Green DC Roadmap describes a policy path for sustainable continued growth and the Digital Connectivity Blueprint as related infrastructure planning. | [IMDA: Green Data Centre Roadmap](https://www.imda.gov.sg/how-we-can-help/green-dc-roadmap) | Verify roadmap status, capacity, allocation conditions, and targets at every revision. |
| Energy efficiency can be discussed at more than one layer: facility operations and the IT equipment/workloads inside a data centre. | [IMDA: Green DC Roadmap](https://www.imda.gov.sg/how-we-can-help/green-dc-roadmap) | Do not quote a PUE benchmark or efficiency performance without its dated methodology and scope. |

### Template v1-oriented outline

1. **One-sentence answer:** A data centre is the physical infrastructure that runs digital services, which is why its growth raises both connectivity and resource questions.
2. **30-second overview:** service → computing equipment → facility → power/cooling and planning trade-offs.
3. **Five-minute explanation:** server, storage, network, redundancy, cooling, and energy efficiency; explain why location and connectivity matter.
4. **Why people care:** everyday cloud services, business activity, AI demand, power use, land, and national connectivity.
5. **Singapore angle:** Green DC Roadmap and the policy balancing digital growth with sustainability.
6. **Questions / mistakes:** “Which resource or system boundary is being measured?”; avoid equating cloud use with no physical infrastructure.

**Freshness:** quarterly. Capacity, allocation rounds, standards, technology, and
energy policy are changing information. Keep specific capacity figures and
announcements in Current Updates.

## 5. Energy Transition

### Reader mental model

```text
Generate / import electricity  →  transmit and operate the grid  →  homes and businesses
             │                           │
      security, affordability,          decarbonisation and demand management
      reliability, and emissions must be considered together
```

### Durable claim candidates

| Candidate | Primary support | Editorial note |
| --- | --- | --- |
| Singapore's electricity system has distinct generation, wholesale, retail, transmission, and market-support roles. | [EMA: Electricity market](https://www.ema.gov.sg/our-energy-story/energy-market-landscape/electricity) | This is a system map, not a guide to choosing a retailer. Check market-role names on revision. |
| The Power System Operator's role includes reliable electricity supply and stable power-system operation; it manages generation and transmission in real time. | [EMA: Power System Operator](https://www.ema.gov.sg/about-ema/who-we-are/our-role-as-a-power-system-operator) | Avoid implying that it owns every physical asset or sets every retail price. |
| EMA describes Singapore's energy-transition approach through four supply “switches”: solar, regional power grids, low-carbon alternatives, and natural gas, alongside demand management. | [EMA: Four Switches for Singapore's Energy Transition](https://www.ema.gov.sg/resources/corporate-publications/annual-sustainability-report-2024-2025/four-switches-for-sg-energy-transition) | Attribute the framing to EMA and check its current wording; do not treat targets or project approvals as settled outcomes. |
| Regional electricity connections can diversify supply and provide access to low-carbon electricity beyond Singapore's land constraints, but they also require reliable cross-border arrangements and system planning. | [EMA: Four Switches](https://www.ema.gov.sg/resources/corporate-publications/annual-sustainability-report-2024-2025/four-switches-for-sg-energy-transition) | The second half is an inference from EMA's emphasis on security and regional interconnectivity; label it as a trade-off, not a guarantee. |

### Template v1-oriented outline

1. **One-sentence answer:** Singapore's energy transition is the effort to keep electricity reliable and affordable while reducing its climate impact.
2. **30-second overview:** generation/imports → grid → users, with a balance among reliability, cost, security, and emissions.
3. **Five-minute explanation:** who generates, transmits, operates, and sells electricity; solar, imports, low-carbon alternatives, natural gas, and managing demand.
4. **Why people care:** household bills, business operations, emissions, air quality, land constraints, and regional links.
5. **Singapore angle:** the Four Switches are EMA's policy model, not a promise that every pathway will proceed at a fixed speed.
6. **Questions / mistakes:** “Which objective is a proposal trying to improve?”; avoid treating renewable capacity, electricity generation, and carbon emissions as interchangeable measures.

**Freshness:** quarterly. Electricity-import projects, fuel shares, technology
options, price conditions, and targets must be dated and revisited. This
Briefing is not personal energy-investment advice.

## 6. The Green Plan and Climate Adaptation

### Reader mental model

```text
Singapore Green Plan 2030: a national sustainability framework
  ├─ City in Nature       ├─ Sustainable Living     ├─ Energy Reset
  ├─ Green Economy        └─ Resilient Future

Climate action has two linked tracks:
reduce emissions (mitigation)  +  prepare for effects already expected (adaptation)
```

### Durable claim candidates

| Candidate | Primary support | Editorial note |
| --- | --- | --- |
| The Singapore Green Plan 2030 is organised around five pillars: City in Nature, Sustainable Living, Energy Reset, Green Economy, and Resilient Future. | [Singapore Green Plan: Our Vision](https://www.greenplan.gov.sg/vision/) | This is the core orientation Claim; check named pillars and programme ownership on refresh. |
| The Green Plan presents targets across multiple sectors and time horizons, so a target is an intended outcome rather than proof that it has already been achieved. | [Singapore Green Plan: Targets](https://www.greenplan.gov.sg/targets/) | Always show the target year, baseline, and latest official progress source separately. |
| Climate adaptation means preparing for climate effects and building resilience, while mitigation concerns reducing the drivers of climate change; both are relevant to Singapore's climate action. | [NCCS: Adaptation overview](https://www.nccs.gov.sg/singapores-climate-action/overview/adaptation-overview/) | Use an official mitigation page too if describing Singapore's national emissions commitments in detail. |
| Singapore's adaptation planning includes coastal and inland flood resilience; PUB leads and coordinates whole-of-government coastal-protection and flood-resilience efforts. | [NCCS: Coastal protection](https://www.nccs.gov.sg/singapores-climate-action/coastal-protection/) | Do not turn a projection, specific study, or proposed construction into a permanent fact without a date and status. |
| Coastal adaptation is a long-term, site-specific planning task rather than a single island-wide structure. | [PUB: Coastal protection](https://www.pub.gov.sg/Public/KeyInitiatives/Flood-Resilience/Coastal-Protection) | This is an editorially useful synthesis of PUB's approach; state it as a planning model. |

### Template v1-oriented outline

1. **One-sentence answer:** The Green Plan is Singapore's broad sustainability framework, while climate adaptation is the practical work of preparing for climate impacts such as heat, heavy rain, and sea-level rise.
2. **30-second overview:** five pillars, then mitigation + adaptation as complementary tracks.
3. **Five-minute explanation:** explain the five pillars; targets versus results; adaptation, resilience, coastal protection, and flood resilience; why plans need to adapt as science and conditions change.
4. **Why people care:** homes, health, food, water, transport, jobs, energy, public spending, and shared spaces.
5. **Singapore angle:** constraints of a dense, low-lying island and coordinated government roles; distinguish a national framework from individual projects.
6. **Questions / mistakes:** “Is this a target, a completed action, or a projected risk?”; avoid treating adaptation as an alternative to emissions reduction.

**Freshness:** quarterly, with an annual full framework check. Targets, progress
reports, climate studies, legislation, and specific coastal works are time
sensitive. Climate projections must retain their source, scenario/range, and
time horizon; project updates belong in Current Updates.

## Editorial hand-off checklist

Before creating a Source Submission from this pack, the editor should:

1. retrieve the exact official page, PDF, standard, or data release and record
   its title, publisher, URL, publication/last-updated date, and access date;
2. turn only the applicable row into one or more independently reviewable
   candidate Claims — do not accept the pack or a landing page as omnibus
   support;
3. obtain stronger or separate support for technical definitions, statistics,
   legal duties, contested effects, and claims of success;
4. test the proposed Briefing's opening with a lay reader: can they describe
   the model and its core trade-off without repeating jargon?; and
5. place time-stamped evidence, targets, announcements, and changing figures
   in a Current Update or visibly date them during the Editorial Workflow.

## Source register

| ID | Publisher and source | Why retained | Freshness risk |
| --- | --- | --- | --- |
| AI-1 | [IMDA — Artificial Intelligence in Singapore](https://www.imda.gov.sg/AI) | Singapore's AI governance and programme hub. | High: frameworks and editions evolve. |
| AI-2 | [PDPC — Singapore's Approach to AI Governance](https://www.pdpc.gov.sg/help-and-resources/2020/01/model-ai-governance-framework) | Official governance principles and implementation framing. | High: guidance and tool scope evolve. |
| SC-1 | [EDB — Singapore's Semiconductor Industry](https://www.edb.gov.sg/en/our-industries/semiconductor.html) | Official description of Singapore's semiconductor ecosystem. | Medium: figures, company examples, and programmes change. |
| SC-2 | [A*STAR IME](https://www.a-star.edu.sg/ime) | Official research-institute context and technical research lead. | Medium. |
| CY-1 | [CSA — General Public](https://www.csa.gov.sg/information-for/general-public/) | Official public cyber-hygiene resources. | High: threat guidance changes. |
| CY-2 | [CSA — data-breach advisory](https://www.csa.gov.sg/alerts-and-advisories/advisories/ad-2023-001/) | Defined public-facing breach and risk-reduction explanation. | High: consult current legal/incident guidance too. |
| CY-3 | [SingCERT](https://www.csa.gov.sg/singcert) | Official alerts and reporting lead. | High. |
| DC-1 | [IMDA — Green Data Centre Roadmap](https://www.imda.gov.sg/how-we-can-help/green-dc-roadmap) | Official policy framing for digital infrastructure and resource trade-offs. | High: roadmap, capacity, and standards can change. |
| EN-1 | [EMA — Electricity market](https://www.ema.gov.sg/our-energy-story/energy-market-landscape/electricity) | Official market and system-role overview. | Medium: roles/rules can change. |
| EN-2 | [EMA — Power System Operator](https://www.ema.gov.sg/about-ema/who-we-are/our-role-as-a-power-system-operator) | Official system-operation role. | Medium. |
| EN-3 | [EMA — Four Switches](https://www.ema.gov.sg/resources/corporate-publications/annual-sustainability-report-2024-2025/four-switches-for-sg-energy-transition) | Current official transition framing. | High: targets/projects/progress change. |
| GP-1 | [Singapore Green Plan — Our Vision](https://www.greenplan.gov.sg/vision/) | Official framework and five-pillar structure. | Medium. |
| GP-2 | [Singapore Green Plan — Targets](https://www.greenplan.gov.sg/targets/) | Official target and status lead. | High: status and target details change. |
| CA-1 | [NCCS — Adaptation overview](https://www.nccs.gov.sg/singapores-climate-action/overview/adaptation-overview/) | Official adaptation framework and climate-risk context. | High: science, studies, and plans evolve. |
| CA-2 | [NCCS — Coastal protection](https://www.nccs.gov.sg/singapores-climate-action/coastal-protection/) | Official coordination and planning context. | High: projects and legal framework evolve. |
| CA-3 | [PUB — Coastal protection](https://www.pub.gov.sg/Public/KeyInitiatives/Flood-Resilience/Coastal-Protection) | Official public explanation of long-term coastal work. | High. |
