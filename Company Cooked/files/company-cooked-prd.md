# Is My Company Cooked? — Product Requirements Document

## Vision

"Is My Company Cooked?" is a multi-dimensional AI disruption analysis tool for any company. Users type a company name and instantly receive a structured assessment across five dimensions of AI risk — because there are fundamentally different ways a company can be "cooked" by AI, and most people (and most analysts) only think about one.

This is not a single score. It's a diagnostic. A company can have a safe product but a dying business model. A lean team but an eroding moat. A growing market but a vulnerable pricing structure. The five-dimension framework surfaces these tensions in a way that's genuinely insightful, immediately shareable, and — at higher enrichment tiers — approaching the quality of analysis that management consultants charge five or six figures for.

### The Five Dimensions of AI Risk

1. **Product Disruption** — Can AI replicate or replace what this company sells?
2. **Headcount Vulnerability** — How much of the workforce becomes redundant with AI?
3. **Moat Erosion** — Are the company's competitive defenses weakening because of AI?
4. **Business Model Risk** — Is the revenue/pricing model directly threatened by AI?
5. **Market Viability** — Is the overall market this company serves growing or shrinking due to AI?

Each dimension is scored independently (0–100) with both a **current state** score and a **2028 projected** score. The gap between now and 2028 is often more revealing than either score alone — it identifies companies that look safe today but are sitting on a time bomb.

### Where This Lives

This ships as a **second mode on amicooked.io** — a tab or toggle between "My Job" and "My Company." Same brand, same design system, same audience. If it gets significant traction and the audience diverges (investors, founders wanting deeper analysis), it can be spun out to its own domain later. But V1 lives on amicooked.io to leverage existing traffic and brand recognition.

---

## Build Phases Overview

| Phase | What | Enrichment Level | Timeline |
|---|---|---|---|
| V1 | Company name input → 5-dimension analysis | Claude's training knowledge only | Ship this week |
| V1.5 | Add optional URL input | Website scrape (homepage, pricing page, careers page) | Same week or next |
| V2 | Add Crunchbase/LinkedIn data + "refine" input | Headcount, funding data + user-provided insider context | If V1 gets traction |
| V3 | Public company financial data + earnings analysis | Yahoo Finance, earnings call transcripts | If it becomes a real product |
| V4 | Comparative mode + tracking/alerts | Side-by-side analysis, change detection over time | Dream state |

**Architecture principle for V1**: Build it so that adding enrichment layers later is trivial. The Claude API call should accept an optional `context` object that starts empty in V1 and gets populated with scraped/enriched data in later versions. Don't hardcode the prompt to only work with a company name — structure it so additional context slots into the same prompt cleanly.

---

## V1 — BUILD THIS NOW

### User Flow

1. User is on amicooked.io
2. User sees two modes: "My Job" (existing) and "My Company" (new)
3. User selects "My Company" tab/toggle
4. User types a company name (e.g., "Salesforce", "PDQ", "Walmart")
5. App sends the company name to Claude via the Anthropic API
6. Claude returns a structured five-dimension analysis
7. App renders a dramatic, scannable, shareable result card
8. User screenshots and shares

### V1 Input

A single text field: "Enter a company name..."

That's it for V1. No URL field, no dropdowns, no optional fields. One input, one button, one result. Keep the Am I Cooked simplicity.

### V1 API Integration

#### System Prompt

```
You are an AI disruption analyst. Given a company name, you assess how vulnerable that company is to AI-driven disruption across five distinct dimensions. You understand that there are fundamentally different ways a company can be "cooked" by AI — product replacement is only one of them.

You must respond ONLY with valid JSON matching this exact schema:

{
  "company_name": "<string: full company name>",
  "ticker": "<string: stock ticker if publicly traded, null if private>",
  "sector": "<string: brief sector/industry, e.g. 'Enterprise SaaS — CRM', 'Retail — Grocery & General Merchandise'>",
  "employee_estimate": "<string: rough estimate if known, e.g. '~73,000' or '~300' or 'Unknown'>",
  "overall_score": <number 0-100>,
  "overall_status": "<string: one of 'Fully Cooked', 'Well Done', 'Medium', 'Medium Rare', 'Raw'>",
  "hot_take": "<string: one punchy, specific, quotable sentence about this company's AI future. Must reference their actual business, actual product, or actual business model. Never generic. This is the line people screenshot.>",
  "summary": "<string: 3-4 sentences. The narrative arc for this company in an AI world. What's the story? Where are they strong, where are they exposed, and what's the likely trajectory?>",

  "dimensions": {
    "product_disruption": {
      "score_now": <number 0-100>,
      "score_2028": <number 0-100>,
      "label": "<string: 3-6 word status>",
      "analysis": "<string: 3-4 sentences. Can AI replicate or replace what this company sells? Be specific about WHICH capabilities are threatened and which aren't. Don't anchor to what AI can do today — project forward 2-3 years based on current trajectory. Consider: could a small team with AI tools build a credible competitor to this product?>"
    },
    "headcount_vulnerability": {
      "score_now": <number 0-100>,
      "score_2028": <number 0-100>,
      "label": "<string: 3-6 word status>",
      "analysis": "<string: 3-4 sentences. How much of this company's workforce could be reduced by AI within 2-3 years? Be specific about which functions are most exposed: sales/SDR teams, customer support, engineering, marketing/content, operations, finance, legal. Consider the company's current size — a 300-person lean company has different headcount risk than a 73,000-person bloated one.>"
    },
    "moat_erosion": {
      "score_now": <number 0-100>,
      "score_2028": <number 0-100>,
      "label": "<string: 3-6 word status>",
      "analysis": "<string: 3-4 sentences. What has historically protected this company? Assess each moat specifically: proprietary data, technical complexity, switching costs, network effects, regulatory barriers, brand trust, physical infrastructure, ecosystem lock-in. Which moats are holding? Which are crumbling? AI doesn't just compete with products — it lowers the barrier to building competitors, which erodes moats indirectly.>"
    },
    "business_model_risk": {
      "score_now": <number 0-100>,
      "score_2028": <number 0-100>,
      "label": "<string: 3-6 word status>",
      "analysis": "<string: 3-4 sentences. Is the revenue model threatened? Per-seat SaaS pricing is ground zero for AI disruption (fewer humans = fewer seats). Per-usage, per-endpoint, per-transaction, and platform/marketplace models are more resilient. Advertising models face mixed effects. Services/consulting models are highly exposed. Be specific about THIS company's pricing structure and how AI changes their customers' willingness to pay.>"
    },
    "market_viability": {
      "score_now": <number 0-100>,
      "score_2028": <number 0-100>,
      "label": "<string: 3-6 word status>",
      "analysis": "<string: 3-4 sentences. Is the overall market growing, stable, or shrinking due to AI? A company can execute perfectly and still be cooked if the market itself is disappearing. Distinguish between the NEED persisting (people always need to file taxes) and the MARKET persisting (the market for paid tax prep software may not). Also consider: does AI expand this market or contract it?>"
    }
  },

  "what_would_kill_it": "<string: 2-3 sentences. The specific, realistic scenario that would be existential. Be concrete: name the type of competitor, the specific product capability, the price point, the timeline. Not 'AI gets better' but 'A 10-person startup builds X that does Y at Z% of the cost, targeting their most vulnerable customer segment.'>",

  "what_keeps_it_alive": "<string: 2-3 sentences. The specific, realistic advantages that protect this company. Be honest about durability — a moat that lasts 2 years is different from one that lasts 10. Distinguish between 'safe because AI can't do this' and 'safe because switching costs buy time even though AI can do this.'>",

  "ai_adaptation_signals": "<string: 2-3 sentences. What evidence exists that this company is or isn't adapting? AI product launches, AI hiring, executive statements about AI strategy, partnerships with AI companies. If you don't have specific knowledge, say what signals you'd look for rather than guessing.>",

  "timeline": "<string: e.g. '6-12 months', '12-24 months', '2-4 years', '5+ years'>",
  "timeline_detail": "<string: 1 sentence clarifying what happens at that timeline — revenue impact? headcount reduction? competitive pressure? Be specific.>"
}

SCORING GUIDELINES:

Overall scoring:
- 90-100 "Fully Cooked": Core business is actively being replaced by AI today. Existential threat is present tense.
- 70-89 "Well Done": Major disruption within 1-2 years across multiple dimensions.
- 40-69 "Medium": Mixed picture — some dimensions high-risk, others well-defended. Company has time but must adapt.
- 20-39 "Medium Rare": Mostly protected. AI is a factor but not existential in the medium term.
- 0-19 "Raw": AI-resistant business. Physical, deeply human, or structurally protected.

Per-dimension scoring:
- Score each dimension independently. A company can be 30 on product disruption but 85 on business model risk.
- The score_now and score_2028 should differ meaningfully when the trajectory is clear. A company whose product is safe today (25) but vulnerable in 2 years (60) has a very different risk profile than one that's stable (25 → 30).
- Don't cluster everything in the 40-60 range. Have the courage to give a 12 or a 92 when warranted. Walmart's product disruption is a 12. Intuit's is an 82. Don't hedge.
- The overall score is NOT a simple average. It's a weighted judgment. Product disruption and business model risk matter more for company survival than headcount vulnerability.

CRITICAL RULES:
- The hot_take MUST be specific to the company. Reference their actual product, business model, customers, or competitive position. "AI is coming for this industry" is banned. "TurboTax's entire business model is that tax code is too complicated for normal people. Claude just read the entire tax code in 3 seconds." is the standard.
- When assessing product disruption, DON'T anchor to what AI can do today. Project forward 2-3 years. Six months ago AI couldn't reliably execute code on live servers. Now developers run it in production. The trajectory matters more than the snapshot.
- For private companies where you have limited data, be honest about what you don't know rather than guessing. Say "headcount unknown — analysis assumes typical SaaS staffing ratios" rather than fabricating a number.
- Distinguish between "AI replaces the product" and "AI collapses the complexity that makes the product necessary." These are different threats. A device management tool might not be replaced by an AI chatbot, but AI might make device management simple enough that dedicated tooling isn't needed.
- The what_would_kill_it scenario should be specific enough that a founder reading it would feel a chill of recognition. Not vague doom — a concrete, buildable threat.
- NEVER punch down at employees who might lose jobs. Punch at business models, pricing strategies, and executive decisions.
```

#### User Message (V1)
```
Company: {user_input}
```

#### User Message (V1.5 — when URL is provided)
```
Company: {user_input}

Additional context scraped from their website:

HOMEPAGE:
{homepage_text}

PRICING PAGE:
{pricing_text}

CAREERS PAGE — CURRENT OPEN ROLES:
{careers_text}

Use this additional context to make your analysis more specific and accurate. Pay special attention to:
- Their pricing model (per-seat, per-endpoint, per-usage, flat fee, etc.)
- What they're hiring for (AI/ML roles = adapting; lots of manual/traditional roles = not adapting)
- How they describe their product and customers
- Any AI-related messaging on their site
```

#### User Message (V2 — when enrichment data is available)
```
Company: {user_input}

COMPANY DATA:
- Employee count: {employee_count}
- Employee count 1 year ago: {employee_count_prev} (if available)
- Founded: {year}
- Funding: {funding_info} (if private)
- Revenue estimate: {revenue} (if available)
- Market cap: {market_cap} (if public)

WEBSITE CONTEXT:
{website_scrape}

CURRENT JOB OPENINGS:
{careers_data}

USER-PROVIDED CONTEXT:
{user_context}

Use all available data to produce the most specific, accurate analysis possible. When company data is available, reference actual numbers rather than estimates. When the user has provided insider context, incorporate it — they know their company better than public sources do.
```

---

### V1 Output / UI Design

The company result card should feel like a sibling of the Am I Cooked job result — same dark aesthetic, same dramatic score reveal — but with more structure to accommodate the five dimensions.

#### Layout

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  ← My Job    [  MY COMPANY  ]                    │
│                                                  │
│  ┌──────────────────────────────────────┐        │
│  │  Enter a company name...             │        │
│  └──────────────────────────────────────┘        │
│              [ Analyze → ]                       │
│                                                  │
└──────────────────────────────────────────────────┘

         ↓ (after submission, smooth reveal)

┌──────────────────────────────────────────────────┐
│                                                  │
│  SALESFORCE (CRM)                                │
│  Enterprise SaaS — CRM · ~73,000 employees       │
│                                                  │
│                  62                               │
│             ████████░░░                           │
│              MEDIUM                               │
│                                                  │
│  "Salesforce spent $27B on Slack and Tableau     │
│   to build a moat. AI just built a bridge        │
│   over it for $20/month."                        │
│                                                  │
│  ⏱ Timeline: 12-24 months before revenue         │
│    pressure; 3-5 years before existential        │
│    questions                                     │
│                                                  │
│ ── FIVE DIMENSIONS ──────────────────────        │
│                                                  │
│  Product Disruption          NOW  2028           │
│  Core CRM is replicable       72 → 85            │
│  ████████░░  ██████████░                         │
│  [tap to expand analysis]                        │
│                                                  │
│  Headcount Vulnerability     NOW  2028           │
│  Bloated and exposed          68 → 78            │
│  ███████░░░  █████████░                          │
│  [tap to expand analysis]                        │
│                                                  │
│  Moat Erosion                NOW  2028           │
│  Ecosystem holding — for now  48 → 62            │
│  █████░░░░░  ██████░░░░                          │
│  [tap to expand analysis]                        │
│                                                  │
│  Business Model Risk         NOW  2028           │
│  Per-seat is the bullseye     75 → 88            │
│  ████████░░  █████████░                          │
│  [tap to expand analysis]                        │
│                                                  │
│  Market Viability            NOW  2028           │
│  CRM need persists            40 → 50            │
│  ████░░░░░░  █████░░░░░                          │
│  [tap to expand analysis]                        │
│                                                  │
│ ── THE VERDICT ──────────────────────────        │
│                                                  │
│  💀 WHAT WOULD KILL IT:                          │
│  An AI-native anti-CRM that requires zero        │
│  manual data entry, sold at 20% of               │
│  Salesforce's per-seat price...                  │
│                                                  │
│  🛡️ WHAT KEEPS IT ALIVE:                         │
│  The installed base. Enterprise switching        │
│  costs. The ecosystem of partners and admins...  │
│                                                  │
│  📡 AI ADAPTATION SIGNALS:                        │
│  Agentforce launch, Einstein AI features,        │
│  aggressive AI marketing...                      │
│                                                  │
│ ── SUMMARY ──────────────────────────────        │
│                                                  │
│  Salesforce is the most interesting case study   │
│  in AI disruption because it's simultaneously    │
│  the most threatened and the most resourced      │
│  to adapt...                                     │
│                                                  │
│  ┌──────────┐  ┌──────────────────┐             │
│  │ Try Again │  │ Share on 𝕏      │             │
│  └──────────┘  └──────────────────┘             │
│                                                  │
│  Also: Is YOUR job cooked? → Check now           │
│                                                  │
│  Built by @spencervail · Powered by Claude       │
│  AI-generated analysis · Not financial advice    │
│                                                  │
└──────────────────────────────────────────────────┘
```

#### Key UI Details

**The Now → 2028 progression is the visual signature.** Each dimension shows two bars or two numbers with an arrow between them. The gap between now and 2028 is color-coded: small gap (green, stable), medium gap (amber, shifting), large gap (red, accelerating risk). This visual of risk *accelerating* or *stable* communicates more than any single number could.

**Dimension cards expand on tap.** Default state shows score, label, and the two bars. Tapped state reveals the full 3-4 sentence analysis. This keeps the initial result scannable and screenshot-friendly while rewarding curiosity with depth.

**The hot take gets premium placement.** Big, italic, visually distinct — same as Am I Cooked. This is the single most important line for shareability. It should be visible in any screenshot of the result.

**Cross-link to job mode.** After the company result, prompt: "Also: Is YOUR job cooked? → Check now." This drives traffic between the two modes and increases time on site.

**"Not financial advice" disclaimer must be more prominent than on the job mode.** Company analysis has financial implications. The disclaimer should be visible without scrolling, not buried in the footer. Something like a subtle but always-visible tag near the score: "AI-generated analysis · Not financial advice · Not a research report."

#### Share Mechanics

**Twitter/X share:** "My company scored [score]/100 on the AI disruption index. [status]. The hot take: '[hot_take]' Check yours: amicooked.io"

**LinkedIn share:** Should include more context — LinkedIn audiences want substance. "I ran [company] through an AI disruption analysis tool. It scored [score]/100 across five dimensions: Product Risk: [x], Headcount Vulnerability: [y], Moat Erosion: [z], Business Model Risk: [a], Market Viability: [b]. The insight that hit hardest: [hot_take]. Try it: amicooked.io"

**Individual dimension sharing:** Each dimension card should have its own share button. "Salesforce's business model risk scored 75/100 (now) → 88/100 (by 2028). Per-seat pricing is the bullseye. amicooked.io"

---

## V1.5 — WEBSITE ENRICHMENT (Build When V1 Is Live)

### What Changes
- Add an optional URL input field below the company name: "Company website (optional — improves accuracy)"
- When URL is provided, server-side scrape three pages:
  1. Homepage (what the company does, positioning, customer segments)
  2. /pricing or /plans page (pricing model — this was the #1 accuracy gap in validation)
  3. /careers or /jobs page (hiring signals — AI roles vs. traditional roles)
- Feed scraped text to Claude as additional context in the prompt
- Show a subtle "Enhanced analysis" badge on results that used website data

### Technical Notes
- Use a server-side fetch (Vercel serverless function) to scrape — don't expose the scraping in the client
- Strip HTML, extract text content only, truncate to ~2000 tokens per page to stay within context limits
- Cache scraped data for 24 hours to avoid re-scraping on repeat queries
- Handle gracefully when pages don't exist (many companies don't have /pricing) or when scraping is blocked

### What This Fixes
Based on validation testing, website scraping specifically fixes:
- **Pricing model accuracy**: The #1 error in V1 validation was assuming per-seat when a company uses per-endpoint or usage-based pricing. The pricing page resolves this instantly.
- **AI adaptation signals**: The careers page reveals whether a company is hiring AI talent (adapting) or traditional roles (not adapting). This was the weakest dimension in V1 analysis.
- **Product specificity**: The homepage gives Claude much better information about what the company actually sells, especially for private companies not well-represented in training data.

---

## V2 — ENRICHMENT + REFINEMENT (Build If V1 Gets Traction)

### New Features

**1. Third-party data enrichment**
For companies where data is available, automatically pull:
- Employee count and growth trend (Crunchbase free tier or LinkedIn)
- Funding history and last valuation (Crunchbase, for private companies)
- Market cap, revenue, margins (Yahoo Finance, for public companies)
- Revenue per employee calculation (strong signal for operational efficiency)

This data gets fed to Claude as structured context, producing much more specific analysis. "~73,000 employees" becomes "72,682 employees, down from 79,390 in 2023 — already cutting 8.5% of workforce."

**2. "Refine This Analysis" — insider context input**
After receiving the initial result, users see a prompt:
"Know something we don't? Add context to sharpen the analysis."

Free-text input (500 char max) where someone can type things like:
- "We're 300 people on $110M revenue, pricing is per-endpoint not per-seat"
- "We just hired a Head of AI and are rebuilding our core product"
- "Half our revenue comes from legacy products that are being sunset"

Claude re-runs the analysis with this additional context and produces a revised, more specific result. Show both the original and refined results so the user can see how their context changed the analysis.

**3. Public company earnings analysis**
For publicly traded companies, pull the most recent earnings call transcript and have Claude assess AI-related strategy signals:
- How often did the CEO mention AI?
- What specific AI initiatives were described?
- What's the tone — defensive ("we're adapting") or offensive ("AI is our advantage")?
- Any headcount guidance that implies AI-driven restructuring?

---

## V3+ — FUTURE VISION (Don't Build Yet, But Think About)

### Comparative Mode
"How does Salesforce compare to HubSpot, Zoho, and Pipedrive on AI disruption risk?"

Side-by-side radar charts showing how competitors score across the five dimensions. This is the analysis that VCs, PE firms, and strategy teams would pay real money for. It's also the content that business journalists would embed in articles.

### Industry Scan
Instead of one company, analyze an entire industry: "Is the legal industry cooked?" with a breakdown across major players, common vulnerabilities, and industry-wide trajectory.

### Tracking & Alerts
Users save companies to a watchlist. When new data changes the analysis (earnings call, layoff announcement, AI product launch, major model release), the user gets an update. This is where the tool becomes a product with retention, not just a viral toy.

### Weekly "Cooked Report"
A curated weekly analysis of 5-10 companies in the news, published as content on the site and distributed via newsletter/Twitter. This is the recurring content engine — every week, new companies get analyzed, new hot takes get generated, new screenshots get shared. This is the Killed by Claude cross-pollination: when a new AI capability drops, run the affected companies through the analysis and publish the results.

### API / Embed
Let other tools, newsletters, and analysts embed the company analysis or pull data via API. Newsletters like Morning Brew or The Hustle could embed live disruption scores for companies they write about. This is the platform play.

### Premium Tier (Revenue)
- Free: company name analysis (V1 quality)
- Premium ($15-30/month): enriched analysis with financial data, earnings call analysis, comparative mode, tracking/alerts, PDF export for presentations
- Enterprise ($200+/month): API access, custom company lists, white-label reports

---

## Edge Cases to Handle

- **Empty input**: Disable button, show placeholder
- **Nonsense input**: Claude should return a fun error: "We couldn't find a company called 'asdfasdf.' If this is your company, you might have bigger problems than AI."
- **Very small companies / startups**: The analysis should acknowledge when a company is too small or new for meaningful disruption analysis. Headcount vulnerability for a 5-person startup is a meaningless dimension.
- **AI companies themselves**: "Is OpenAI cooked?" or "Is Anthropic cooked?" — Claude should handle this with self-awareness and humor. These are valid queries and the recursive irony should be part of the hot take.
- **Non-companies**: "Is the US Government cooked?" or "Is Harvard cooked?" — Claude should stretch to accommodate these if possible (governments and universities DO have AI disruption risk) or gracefully decline.
- **Duplicate/variant names**: "Microsoft" vs "MSFT" vs "Microsoft Corporation" should all produce the same result. Claude handles this naturally.
- **Controversial/sensitive companies**: No special treatment. The analysis should be factual and even-handed regardless of the company's political or cultural associations.

---

## Disclaimer / Legal

More prominent than Am I Cooked's disclaimer because company analysis has potential financial implications:

**On every result card (visible without scrolling):**
"AI-generated analysis based on publicly available information. Not a research report. Not financial advice. Not investment guidance. Do your own due diligence."

**In the footer:**
"Company analysis is generated by Claude (Anthropic) based on training data and any additional context provided. Scores represent one AI model's assessment of AI disruption risk and should not be used as the sole basis for investment, employment, or business decisions. All information is provided 'as is' without warranty. [Your name/company] is not a registered investment advisor, broker-dealer, or financial planner."

---

## Metrics to Watch Post-Launch

- **Queries per day**: How many companies are people checking?
- **Repeat usage**: Do people check one company and leave, or check multiple?
- **Share rate**: What % of results get shared (via share button clicks)?
- **Job mode → Company mode crossover**: Are people using both modes?
- **Most-checked companies**: This becomes content ("Most Analyzed Companies This Week")
- **Enrichment usage** (V1.5+): What % of users provide a URL?
- **Refinement usage** (V2+): What % of users add insider context?

---

## Connection to Portfolio

| Project | Lens | Audience |
|---|---|---|
| Am I Cooked? (Job mode) | "Is MY role at risk?" | Individual knowledge workers |
| Am I Cooked? (Company mode) | "Is MY employer at risk?" | Employees, investors, founders, strategists |
| Killed by Claude | "Which companies ALREADY got hit?" | Tech Twitter, investors |
| The Crisis Index | "Why does everything feel like it's breaking?" | Macro Twitter, generalists |

The job mode and company mode together create a complete personal risk assessment: "My job scored 45, but my company scored 72 — I might survive AI but my employer might not." That one-two punch is unique. Nobody else offers both lenses in one place.

---

## Cost Estimate

- **Claude API (V1)**: Same model and similar token usage as job mode. Slightly more output tokens due to five dimensions. ~$0.015 per query. 10,000 queries = ~$150.
- **Website scraping (V1.5)**: Free (server-side fetch). Minimal compute cost on Vercel serverless.
- **Crunchbase/LinkedIn (V2)**: Crunchbase free tier = 200 requests/month. May need basic paid tier ($29/month) if volume justifies.
- **Yahoo Finance (V3)**: Free API via yfinance. No cost.

---

## Summary

**For Claude Code — V1 Build Instructions:**

Build the "My Company" mode as a new tab/section on the existing amicooked.io app. The user flow is identical to the job mode: single text input → Claude API call → dramatic result reveal. The key differences:

1. The input is a company name, not a job title
2. The output uses the five-dimension framework with NOW and 2028 scores for each dimension
3. Each dimension card is expandable (collapsed by default, tap to reveal full analysis)
4. The Now → 2028 score progression is visually prominent (two bars with an arrow, color-coded by gap size)
5. The disclaimer is more prominent than on the job mode
6. Cross-links between job mode and company mode ("Also check: Is YOUR job cooked?")

Use the system prompt provided in this document for the Claude API call. Structure the API integration so that additional context (website scrape, financial data, user-provided context) can be added to the prompt later without restructuring — use an optional context object in the API call function.

The design should match the existing amicooked.io aesthetic — dark theme, dramatic score reveal with animation, monospace data typography, shareable result cards. The five dimensions should feel like a report card or diagnostic panel, not a wall of text.

Prioritize mobile layout. Most traffic will come from Twitter on phones. The result card — especially the overall score, hot take, and five dimension summary bars — must be scannable and screenshot-worthy at 375px width without expanding any cards.
