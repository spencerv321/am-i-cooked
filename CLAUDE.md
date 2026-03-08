# Am I Cooked? — Project Reference

## Project Overview

**Am I Cooked?** is a viral web app that scores how likely AI is to disrupt any job or company. Users enter a job title or company name, and Claude analyzes it to produce a score from 0 (Raw — AI can't touch you) to 100 (Fully Cooked — AI is already doing your job), plus a timeline, task breakdown, hot take, and TLDR.

- **Live at:** https://amicooked.io
- **Built by:** @spencervail
- **Current state:** v2.0 — core app complete and stable, analytics + leaderboard + live feed all working, deployed on Railway. Company analysis mode shipped. Decomposition scoring system shipped.
- **Traffic profile:** Viral spikes from social sharing; baseline traffic between spikes. Record day: 2,823 analyses.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Tailwind CSS 4 (PostCSS plugin) |
| Backend | Node.js, Express 5 |
| Database | PostgreSQL (Railway-hosted) |
| AI | Anthropic Claude API (Sonnet 4 primary, Opus 4 fallback) |
| OG Images | Satori + @resvg/resvg-js (server-side SVG → PNG) |
| Fonts | Inter (Bold/Black) for OG images, Google Fonts for web (Inter + JetBrains Mono) |
| Deployment | Railway (auto-deploys from `main` branch) |
| Package Manager | npm |
| Module System | ESM (`"type": "module"` in package.json) |

## Architecture Decisions

### Why Prompt Extraction (`server/prompt.js`)
The `SYSTEM_PROMPT` lives in its own module rather than inline in `api.js`. This is because `api.js` has side effects (a `setInterval` for rate limit pruning) that execute on import. The rescore script and any future scripts need the prompt without triggering those side effects.

### Decomposition Scoring System (`server/scoring.js`)
Job scoring no longer asks Claude for a single holistic number. Instead:
1. Claude returns 6 task-dimension percentages (must sum to ~100%)
2. `server/scoring.js` computes the final score using Formula J (non-linear dampening)

**6 dimensions:**
- `routine_data_text` — weight 0.95
- `structured_rule_analysis` — weight 0.62
- `content_creation` — weight 0.85
- `novel_problem_solving` — weight 0.18
- `physical_and_environmental` — protection factor
- `interpersonal_emotional` — protection factor × 0.65

**Formula J:**
```
cog_vulnerability = weighted sum of first 4 dims
protection_factor = physical + interpersonal × 0.65
effective_protection = protection_factor ^ 1.4   (non-linear)
final_score = cog_vulnerability × (1 - effective_protection × 0.95), scaled 0–100
```

This replaced holistic scoring because LLMs were clustering scores — score 67 alone accounted for 25% of all analyses. Decomposition forces differentiation.

**Critical vehicle operation rule:** Driving/vehicle operation is NOT `physical_and_environmental`. It's `routine_data_text` + `structured_rule_analysis` because autonomous vehicles make driving an AI-vulnerable skill.

### Company Analysis Mode (`server/companyApi.js` + `server/companyPrompt.js`)
A second analysis type — users can enter a company name instead of a job title. Companies get a 5-dimensional disruption score with now/2028 projections:

1. **Product Disruption** — `score_now`, `score_2028`
2. **Headcount Vulnerability** — `score_now`, `score_2028`
3. **Moat Erosion** — `score_now`, `score_2028`
4. **Business Model Risk** — `score_now`, `score_2028`
5. **Market Viability** — `score_now`, `score_2028`

Response also includes: `overall_score`, `overall_status`, `hot_take`, `summary`, `what_would_kill_it`, `what_keeps_it_alive`, `ai_adaptation_signals`, `timeline`, `timeline_detail`.

Company analyses are stored in the `analyses` table with `type='company'`.

### App Mode System
`App.jsx` now has a `mode` state: `'job' | 'compare' | 'company'`. App states expanded to include `'company-loading'` and `'company-result'`. URL params: `?job=` (job mode), `?company=` (company mode), `?compare=` (compare mode).

A dismissible launch banner ("Is your company cooked?") appears at the top for the Company Cooked feature launch.

### Leaderboard Blended Formula
Leaderboard doesn't use plain `AVG(score)`. It uses a 70/30 blend:
- **Most Cooked:** `AVG(score) * 0.7 + MAX(score) * 0.3` — rewards high outlier scores
- **Least Cooked:** `AVG(score) * 0.7 + MIN(score) * 0.3` — rewards low outlier scores
- Minimum 3 analyses required for leaderboard eligibility

### Score Distribution Design
The SYSTEM_PROMPT has carefully aligned score ranges, 10 calibration anchors (firefighter ~8 through data entry clerk ~93), and 5 anti-clustering rules to prevent Claude from bunching scores around the middle. The decomposition model further enforces differentiation by computing scores from 6 independent dimensions rather than asking Claude to name a number.

**Score → Status mapping (used everywhere):**
| Range | Status | Emoji |
|-------|--------|-------|
| 0-20 | Raw | 🧊 |
| 21-40 | Medium Rare | 🥩 |
| 41-60 | Medium | 🍳 |
| 61-80 | Well Done | 🔥 |
| 81-100 | Fully Cooked | 💀 |

### Share Flow (OG Cards)
Share URLs:
- Jobs: `/r/:title/:score/:status` — bots get OG HTML, humans get 302 to `/?job=title`
- Companies: `/company/:name/:score/:status` — bots get OG HTML, humans get 302 to `/?company=name`
- Compare: `/c/:t1/:s1/:st1/vs/:t2/:s2/:st2` — same bot/human split

### Analytics Architecture
Analytics uses a dual-mode system: PostgreSQL when `DATABASE_URL` is set, in-memory fallback when it's not (local dev). All DB writes are fire-and-forget (`.catch()` only) to avoid blocking the request. Active visitors are always tracked in-memory with a 5-minute TTL.

### Rate Limiting
Three layers of protection:
1. **Per-IP:** 10 requests per 60-second window (in-memory Map)
2. **Global per-minute:** 120 API calls/minute (configurable via `API_MINUTE_CAP`)
3. **Global daily:** 25,000 API calls/day (configurable via `API_DAILY_CAP`)

Rate limiting applies to both `/api/analyze` and `/api/analyze-company`.

### Share Link Attribution (`?ref=`)
Share URLs include a `?ref=` query parameter to cut through "dark social" — when users paste links in DMs, texts, or group chats, the browser's Referer header is stripped, making everything look like "direct" traffic. The `?ref=` param survives and tells us where the share originated.

**Ref values → source names:**
| `?ref=` value | Mapped source | Origin |
|---------------|--------------|--------|
| `twitter` | `twitter/x` | X/Twitter share button |
| `linkedin` | `linkedin` | LinkedIn share button |
| `copy` | `shared-link` | Copy link button |
| `native` | `shared-link` | Native OS share |

The `refSource` from `?ref=` takes priority over the Referer header in `middleware.js`. Unknown ref values are stored as `ref:<value>`.

### Model Fallback
API calls try Sonnet 4 first (`claude-sonnet-4-20250514`). On 529/503 (overloaded), retry once after 2s, then fall back to Opus 4 (`claude-opus-4-20250514`).

## File Structure

```
am-i-cooked/
├── CLAUDE.md                    # This file — project reference
├── package.json                 # ESM, scripts: dev/build/start
├── vite.config.js               # Dev port 5173, proxy /api → localhost:3001
├── postcss.config.js            # Tailwind v4 PostCSS plugin
├── eslint.config.js             # Flat config, React hooks/refresh plugins
├── index.html                   # SPA entry, full SEO/OG tags, schema.org markup
├── .env.example                 # Template for env vars
├── .gitignore
│
├── public/
│   ├── og-image.png             # Static fallback OG image
│   ├── robots.txt               # Allow all, points to sitemap
│   ├── sitemap.xml              # Static sitemap fallback (overridden by dynamic /sitemap.xml route in production)
│   └── llms.txt                 # LLM-readable project description for AI discovery
│
├── server/
│   ├── index.js                 # Express app, route wiring, DB init, SSE endpoint
│   ├── api.js                   # POST /api/analyze — rate limiting, model fallback, tone modifiers
│   ├── prompt.js                # SYSTEM_PROMPT for jobs (shared, side-effect-free)
│   ├── scoring.js               # Formula J — computes job score from 6 dimension percentages
│   ├── companyApi.js            # POST /api/analyze-company — company analysis endpoint
│   ├── companyPrompt.js         # COMPANY_SYSTEM_PROMPT — 5-dimensional company scoring
│   ├── share.js                 # OG image generation (satori+resvg), share page handler, bot detection
│   ├── seo.js                   # SEO job pages — server-rendered /jobs/:slug, sitemap, loading page
│   ├── dashboard.html           # Self-contained analytics dashboard (standalone HTML with login)
│   ├── fonts/
│   │   ├── Inter-Bold.ttf       # For OG image rendering
│   │   └── Inter-Black.ttf      # For OG image rendering
│   └── analytics/
│       ├── db.js                # createPool, initDb (schema creation + migrations)
│       ├── tracker.js           # Analytics class — recording + querying (all analytics logic)
│       ├── middleware.js         # Page view tracking middleware (skips bots, static, excluded IPs)
│       ├── routes.js            # Stats API endpoints (auth-protected + public)
│       └── livefeed.js          # SSE broadcast system for live analysis feed
│
├── scripts/
│   ├── rescore.js               # One-time rescore of leaderboard entries (dry-run by default)
│   ├── seed-seo.js              # Seed SEO job pages with ~100 common titles (dry-run by default)
│   ├── stats.js                 # CLI analytics viewer (dashboard/live/jobs/watch)
│   ├── analyze-scores.js        # Analyze score distribution (histograms, clustering, magnet numbers)
│   ├── test-decomposition.js    # Test decomposition prompt vs old prompt on 30 sample jobs
│   ├── test-models.js           # Quick API availability test for Sonnet/Opus/Haiku
│   ├── test-tones.js            # QA test for all three tone modifiers
│   └── tune-formula.js          # Formula tuning — tests Formula J-N with 30 jobs
│
├── src/
│   ├── main.jsx                 # React entry point (StrictMode)
│   ├── App.jsx                  # Root component, mode ('job'|'compare'|'company') + state machine
│   ├── index.css                # Tailwind imports, custom theme, animations, score effects
│   ├── components/
│   │   ├── InputSection.jsx     # Job/company input, tone selector, JobCounter, leaderboard button
│   │   ├── LoadingState.jsx     # Rotating quips with cooking animation
│   │   ├── ResultCard.jsx       # Staggered reveal of all job result sections
│   │   ├── CompareResult.jsx    # Side-by-side job comparison result
│   │   ├── CompanyResultCard.jsx # Company analysis result with 5-dimension breakdown
│   │   ├── DimensionCard.jsx    # One company dimension — now/2028 scores, expandable analysis
│   │   ├── ScoreDisplay.jsx     # Animated score counter, confetti (≥90), shake (≥70), frost (≤19)
│   │   ├── StatusBadge.jsx      # Colored status pill (e.g., "🔥 WELL DONE")
│   │   ├── HotTake.jsx          # Blockquote with the AI's punchy one-liner
│   │   ├── TaskBreakdown.jsx    # At-risk and safe tasks with risk badges
│   │   ├── TldrSection.jsx      # Summary card
│   │   ├── ActionButtons.jsx    # Share (clipboard/native), X, LinkedIn, try again, leaderboard link
│   │   ├── CompanyActionButtons.jsx # Share buttons for company analysis
│   │   ├── StickyShareCTA.jsx   # Fixed-bottom share bar (slides in after score animation, auto-dismisses 8s)
│   │   ├── Leaderboard.jsx      # 3-tab leaderboard (Most Cooked, Least Cooked, Most Popular)
│   │   ├── LiveFeed.jsx         # SSE-powered real-time analysis ticker
│   │   ├── EmailCapture.jsx     # Email capture card (adaptive: full form → compact one-click)
│   │   └── Footer.jsx           # "Powered by Claude · Built by @spencervail"
│   ├── hooks/
│   │   └── useScoreAnimation.js # requestAnimationFrame counter with cubic-out easing (2s)
│   ├── lib/
│   │   ├── api.js               # trackEvent, fetchLeaderboard, analyzeJob, analyzeCompany
│   │   └── shareText.js         # Share URL builders, clipboard, native share (jobs + companies + challenge)
│   └── constants/
│       └── loadingQuips.js      # 12 rotating loading messages
│
├── Company Cooked/              # Planning/research material (not deployed code)
│   └── files/
│       ├── company-cooked-prd.md
│       ├── company-cooked-validation.md
│       └── company-cooked-prompt-draft.md
│
└── am-i-cooked-prd.md           # Original PRD (v1/v1.5/v2/v3+ feature plans, historical reference)
```

## API Endpoints

### Public (no auth)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/analyze` | Analyze a job title. Body: `{ jobTitle, tone? }`. Returns full analysis JSON. |
| POST | `/api/analyze-company` | Analyze a company. Body: `{ companyName }`. Returns 5-dimension company analysis JSON. |
| GET | `/api/count` | Total analyses count (30s cache). Returns `{ count }`. |
| GET | `/api/leaderboard` | Job leaderboard (5min cache). Returns `{ most_cooked, least_cooked, most_popular }`. |
| GET | `/api/company-leaderboard` | Company leaderboard (5min cache). Returns `{ most_disrupted, most_resilient, most_analyzed }`. |
| POST | `/api/event` | Fire-and-forget click tracking. Body: `{ action }`. Returns 204. |
| POST | `/api/subscribe` | Email capture. Body: `{ email, jobTitle, score, type?, source? }`. Returns `{ success }`. |
| GET | `/api/live-feed` | SSE stream. Events: `seed` (recent jobs + companies on connect), `analysis` (real-time new analyses). |
| GET | `/r/:title/:score/:status` | Job share page — bots get OG HTML, humans get 302 redirect. |
| GET | `/company/:name/:score/:status` | Company share page — bots get OG HTML, humans get 302 redirect. |
| GET | `/c/:t1/:s1/:st1/vs/:t2/:s2/:st2` | Compare share page — bots get OG HTML, humans get 302 redirect. |
| GET | `/api/og?title=&score=&status=` | Dynamic OG image PNG for jobs (7-day cache). |
| GET | `/api/og/compare?title1=&score1=&...` | Compare OG image PNG (7-day cache). |
| GET | `/api/og/company?name=&score=&status=` | Company OG image PNG (7-day cache). |
| GET | `/jobs/:slug` | SEO job page — full server-rendered HTML with analysis (cached). Loading page if not yet generated. |
| GET | `/api/seo-status/:slug` | Polling endpoint for SEO loading page. Returns `{ ready: true/false }`. |
| GET | `/sitemap.xml` | Dynamic sitemap with all SEO job pages (1-hour cache). Overrides static file. |

### Auth-Protected (Bearer token via `ANALYTICS_TOKEN`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stats` | Full analytics dashboard data |
| GET | `/api/stats/live` | Active visitor count + peak |
| GET | `/api/stats/jobs` | Top job titles (`?period=today\|all&limit=20`) |
| GET | `/api/stats/referrers` | Referrer sources (`?period=today\|all`) |
| GET | `/api/stats/visitors` | Per-visitor engagement stats |
| GET | `/api/stats/hourly` | Hour-by-hour analysis trend (`?hours=24`) |
| GET | `/api/stats/tones` | Tone/vibe usage distribution |
| GET | `/api/stats/events` | Button click event stats (`?period=today\|all`) |
| GET | `/api/stats/scores` | Score distribution histogram + avg/median |
| GET | `/api/stats/score-trend` | Daily average score over last 14 days |
| GET | `/api/stats/day/:date` | Single-day drill-down (referrers, jobs, events, stats) |
| GET | `/api/stats/referrer-trend` | Top referrer sources over last 14 days |
| GET | `/api/stats/companies` | Top company searches (`?period=today\|all&limit=20`) |
| GET | `/api/stats/subscribers` | Email subscriber stats (total, today, top titles) |
| GET | `/api/stats/geo` | Visitor geography — countries + US states (`?period=today\|all`) |

### Dashboard
| Path | Description |
|------|-------------|
| `/dash` | Self-contained analytics dashboard HTML (login with ANALYTICS_TOKEN) |

## Database Schema

**Tables:**
- `daily_stats` — date (PK), page_views, unique_ips (TEXT[]), api_calls, peak_active
- `job_titles` — id, date, title, count (UNIQUE: date+title)
- `analyses` — id, created_at, date, title, score, tone, visitor_hash, **type** ('job'|'company'), **scoring_version**
- `referrers` — id, date, source, count (UNIQUE: date+source)
- `events` — id, date, action, count (UNIQUE: date+action)
- `analytics_meta` — key (PK), value (stores tracking_since)
- `seo_pages` — id, slug (UNIQUE), title, analysis_json, score, status, generated_at
- `geo_stats` — id, date, country, region, count (UNIQUE: date+country+region)
- `email_subscribers` — id, email, job_title, score, type, source, subscribed_at (UNIQUE: email+job_title)

**Indexes:**
- `idx_referrers_date` on referrers(date)
- `idx_analyses_created_at` on analyses(created_at)
- `idx_seo_pages_slug` on seo_pages(slug)
- `idx_geo_stats_date` on geo_stats(date)
- `idx_email_subscribers_email` on email_subscribers(email)

**Notable:** The `analyses` table stores both job and company analyses, distinguished by the `type` column. Analytics queries filter by type. Rescore entries use `tone='rescore'` and `visitor_hash='rescore-script'` for traceability.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes (prod) | Claude API key for job/company analysis |
| `DATABASE_URL` | Yes (prod) | PostgreSQL connection string. Set automatically on Railway. |
| `PORT` | No | Server port (default: 3001) |
| `ANALYTICS_TOKEN` | Yes (prod) | Bearer token for /api/stats endpoints and /dash login |
| `ANALYTICS_URL` | No | Base URL for stats CLI script (default: https://amicooked.io) |
| `ANALYTICS_SALT` | No | Salt for IP hashing (default: 'am-i-cooked-default-salt') |
| `ANALYTICS_EXCLUDE_IPS` | No | Comma-separated IPs to exclude from analytics (owner traffic) |
| `API_DAILY_CAP` | No | Max API calls per day (default: 25000) |
| `API_MINUTE_CAP` | No | Max API calls per minute (default: 120) |
| `NODE_ENV` | No | Set to 'production' on Railway (restricts CORS origins) |

**Important:** The local `.env` file does NOT contain `DATABASE_URL` — that's only set on Railway. When running scripts locally that need DB access, you must pass the **public** DATABASE_URL inline:
```bash
DATABASE_URL=postgresql://postgres:PASSWORD@crossover.proxy.rlwy.net:27209/railway node scripts/rescore.js
```

The **internal** Railway URL (`postgres.railway.internal:5432`) does NOT resolve outside Railway's network.

## Development

### Local Setup
```bash
npm install
cp .env.example .env    # Add your ANTHROPIC_API_KEY and ANALYTICS_TOKEN
npm run dev             # Starts both Vite (5173) and Express (3001) via concurrently
```

Vite proxies `/api` requests to `localhost:3001` automatically.

### Scripts
```bash
# Analytics CLI
node scripts/stats.js                    # Full dashboard
node scripts/stats.js live               # Active visitors
node scripts/stats.js jobs --period all  # All-time top jobs
node scripts/stats.js watch              # Live polling (5s interval)

# Rescore leaderboard entries
node scripts/rescore.js                              # Dry run
node scripts/rescore.js --execute                    # Actually rescore
node scripts/rescore.js --execute --limit 5          # Rescore first 5 only
# Note: requires DATABASE_URL and ANTHROPIC_API_KEY

# Seed SEO job pages
node scripts/seed-seo.js                             # Dry run (shows what would be generated)
node scripts/seed-seo.js --execute                   # Generate all ~100 pages
node scripts/seed-seo.js --execute --limit 10        # Generate first 10 only
# Note: requires DATABASE_URL and ANTHROPIC_API_KEY

# Score analysis / tuning (dev/research only)
node scripts/analyze-scores.js           # Analyze score distribution from DB
node scripts/test-decomposition.js       # Compare decomposition vs old prompt on 30 jobs
node scripts/test-models.js              # Check Sonnet/Opus/Haiku API availability
node scripts/test-tones.js              # QA test all tone modifiers
node scripts/tune-formula.js            # Test Formula J-N on 30 job anchors
```

### Build & Deploy
```bash
npm run build    # Vite builds to dist/
npm start        # Runs server/index.js (serves dist/ in production)
```
Railway auto-deploys on push to `main`. The build command is `npm run build` and the start command is `npm start`.

## Tone System

Three optional tone modifiers append to the user message:
- `chaos_agent` — Unhinged doomposting energy
- `corporate_shill` — McKinsey consultant euphemisms
- `michael_scott` — Michael Scott from The Office

**Critical rule:** Tones affect ONLY the writing style (hot_take, tldr, task descriptions). The numeric score must be identical regardless of tone. This is enforced by an explicit clause in each tone modifier.

Tone usage is <1% of all analyses (stored in `analyses.tone` column). Tones only apply to job analysis, not company analysis.

## Valid Event Actions

The event tracking system only accepts these actions (anything else is silently dropped):
```
share_primary, share_twitter, share_linkedin, try_again,
view_leaderboard, leaderboard_tab, leaderboard_job_click,
compare_submit, compare_share_primary, compare_share_twitter, compare_share_linkedin,
sticky_cta_impression, sticky_cta_dismiss, sticky_cta_autodismiss,
sticky_cta_share, sticky_cta_twitter, sticky_cta_linkedin,
seo_page_view, seo_page_cta_click, seo_page_related_click,
email_capture_submit,
company_analyze, company_share_primary, company_share_twitter, company_share_linkedin,
company_try_again, company_dimension_expand, company_crosslink_job,
launch_banner_click,
personalized_analyze
```

## New Feature Analytics Checklist

Every new user-facing feature must ship with analytics instrumentation. This is standard operating procedure — don't merge a feature without completing all four items:

1. **Frontend event tracking** — Add `trackEvent()` calls in the relevant React components for key user interactions (clicks, submissions, tab switches, etc.)

2. **Backend action whitelist** — Add the new action string(s) to the `validActions` Set in `server/analytics/tracker.js`. Actions not in the whitelist are silently dropped.

3. **Dashboard section** — Add a dedicated section in `server/dashboard.html` with stat cards and/or a funnel visualization. Follow the existing pattern: fetch data in `refreshAll()`, render in a dedicated `render*()` function.

4. **Day breakdown labels** — Add human-readable labels for the new event actions in both the events table and the day detail panel in `dashboard.html` (search for `EVENT_LABELS` or the event label mappings).

**Example:** When Company Mode shipped, it added `company_analyze`, `company_share_*`, `company_dimension_expand`, etc. → whitelist → Company Stats section → day breakdown labels.

## Known Bugs / Tech Debt

1. **Bot pattern lists duplicated.** `middleware.js` and `share.js` both maintain separate BOT_PATTERNS arrays. Should be consolidated into a shared module.

2. **In-memory rate limiting doesn't survive restarts.** Rate limit counters reset on deploy. Not a real problem at current scale but would need Redis or similar for a multi-instance setup.

3. **No error boundary in React.** If a component crashes, the whole app white-screens. Should add a top-level ErrorBoundary.

4. **`unique_ips` stored as TEXT array in PostgreSQL.** This doesn't scale well — `array_append` with `ANY()` check is O(n). At high traffic, should switch to HyperLogLog or a separate table.

5. **Dashboard HTML is read once at startup.** Changes to `dashboard.html` require a server restart to take effect. Not hot-reloaded.

6. **Share URL encoding edge cases.** Job titles with special characters (slashes, hashes) could produce malformed share URLs. The `encodeURIComponent` calls handle most cases but haven't been exhaustively tested.

7. **No retry logic for DB writes.** All analytics DB writes are fire-and-forget with `.catch()`. If the DB has a momentary hiccup, those data points are silently lost.

8. **OG image cache is unbounded in practice.** The LRU cache has a MAX_CACHE of 500 entries, but there's no TTL. The same images are cached forever until evicted.

## What NOT to Do

1. **Do NOT import from `server/api.js` in scripts.** Use `server/prompt.js` instead. Importing `api.js` triggers side effects (setInterval for rate limit pruning, client initialization).

2. **Do NOT use the internal Railway DATABASE_URL locally.** `postgres.railway.internal` doesn't resolve outside Railway. Always use the public URL (`crossover.proxy.rlwy.net:27209`) when running scripts from your machine.

3. **Do NOT change the score ranges without updating ALL of these locations:**
   - `server/prompt.js` — SYSTEM_PROMPT scoring guidelines
   - `server/scoring.js` — Formula J computation and `scoreToStatus()` / `scoreToEmoji()`
   - `server/analytics/tracker.js` — `_scoreToStatus()` and `_scoreToEmoji()` methods
   - `server/share.js` — `scoreColor()` and `scoreEmoji()` functions
   - `src/components/Leaderboard.jsx` — `scoreColor()` and `statusPillColor()`
   - `src/components/LiveFeed.jsx` — `scoreColor()`
   - `src/components/StatusBadge.jsx` — `getStatusColor()`
   - `src/components/ScoreDisplay.jsx` — `getScoreColor()` (HSL-based, not lookup table)

   The prompt ranges, code boundaries, and colors must all stay aligned or scores will look wrong.

4. **Do NOT add a state management library.** The app uses simple `useState` in App.jsx with a string state machine and a `mode` field. This is intentional and sufficient.

5. **Do NOT modify or delete existing `analyses` rows.** The leaderboard and scoring system relies on the full history. If you need to re-score, insert NEW rows (like the rescore script does) so old and new scores blend naturally via AVG.

6. **Do NOT skip the `--execute` flag on `rescore.js`.** It defaults to dry-run mode for safety. Always preview first.

7. **Do NOT use `import 'dotenv/config'` in scripts.** It doesn't reliably load all env vars. Either use `source .env && ...` or manually parse .env like `stats.js` does.

8. **Do NOT register routes after the static file catch-all in `server/index.js`.** Share routes and API routes must come BEFORE `app.use(express.static(distPath))` and the `/{*splat}` catch-all, or they'll never match.

9. **Do NOT ask Claude to return a single job score number directly.** The decomposition model requires Claude to return 6 dimension percentages. `server/scoring.js` computes the final score. Bypassing this would re-introduce clustering.

## V3 Plan (Next Up)

Previously planned V2 features are now complete: Compare Mode ✓, Sticky Share CTA ✓, SEO Job Pages ✓, Company Analysis ✓.

Remaining deferred items:
- **Trending Now on Landing Page** — Horizontal scrollable chips showing today's most-searched jobs with scores. 5-minute cache. New `/api/trending` endpoint.
- V1.5 advanced inputs (years, education, day-to-day) — tone selectors already get <1% usage, more optional fields = more friction
- LinkedIn PDF import — enormous friction, PDF parsing complexity, minimal shareability gain
- Embed widget — niche audience, screenshots already serve the purpose

## Session Notes

- **Node version:** v25.6.1 on dev machine
- **Bash tool double output:** The Claude Code Bash tool sometimes displays command output twice. This is a display artifact, not a real code issue. Ignore it.
- **Railway deploy:** Push to `main` triggers auto-deploy. No manual steps needed.
- **OG image testing:** Use `curl` with a bot user-agent to test share pages: `curl -A "Twitterbot" https://amicooked.io/r/plumber/8/raw`
