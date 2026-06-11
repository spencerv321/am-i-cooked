# HANDOFF — Sonnet 4.6 Migration Branch (June 11, 2026)

> For the next working session (human or Claude Code) picking up this branch.
> Branch: `claude/blissful-gauss-2w3oax` · PR: https://github.com/spencerv321/am-i-cooked/pull/1
> Read CLAUDE.md first for project context — it was resynced in this session and is accurate.

## Why this work happened

The production models (`claude-sonnet-4-20250514`, `claude-opus-4-20250514`) **retire June 15, 2026**.
After that date every `/api/analyze`, `/api/analyze-company`, and SEO-page generation call 404s
and the live site dies. This branch is the migration plus agreed hardening/growth work.

**⏰ HARD DEADLINE: merge to `main` before June 15** (Railway auto-deploys from `main`).

## What was done (one commit per stage)

| Commit | Stage |
|---|---|
| `323e003` | Sonnet 4.6 primary + Haiku 4.5 fallback; `thinking: disabled` + `effort: low` everywhere (effort omitted on Haiku — would 400); `cache_control` on both system prompts; scripts updated to identical params; dead tone system deleted |
| `fc58466` | Top-level React ErrorBoundary; Vitest harness (`npm test`, 43 tests); EmailCapture card removed (2 subscribers in 3.5 months — endpoint/table/data kept) |
| `c5abf24` | Trending Now: `GET /api/trending` + `TrendingChips` on idle job view + full analytics instrumentation (whitelist, dashboard section, labels) |
| `09be5e9` | CLAUDE.md resynced with reality (~3 months of drift corrected) |

All verified in-session: 43/43 tests pass, build clean, server boots, `/api/trending` responds,
no new lint issues (6 pre-existing problems in untouched files were deliberately left alone).

## ⚠️ THE ONE BLOCKING TASK: score validation gate

Could not run in the remote session (no `ANTHROPIC_API_KEY` there). **Must run before merging:**

```bash
git checkout claude/blissful-gauss-2w3oax && npm install && npm test   # sanity: 43/43
source .env && node scripts/test-scores.js                             # ~20 API calls, pennies
```

Decision rule (locked in planning):
- **Median shift ≤3 points vs the old Sonnet 4 distribution AND calibration anchors in band**
  (firefighter ~8, data entry clerk ~93, no clustering warnings)
  → **merge PR #1 as-is, keep `scoring_version=2`.**
- **Larger shift** → DO NOT merge yet. Bump writes to `scoring_version=3`
  (`server/api.js` → `recordApiCall` → `scoringVersion`), and update
  `getPercentile()` + leaderboard queries in `server/analytics/tracker.js` to prefer v3
  with v2 fallback — same pattern as the v1→v2 transition in commit `c8268f6`.
  Never modify existing `analyses` rows (CLAUDE.md rule 5).

## Post-deploy checks (same evening, non-blocking)

1. Run one job + one company analysis on amicooked.io — confirm responses and sane scores.
2. Railway logs: check `usage.cache_read_input_tokens` after a few requests.
   **Known risk:** the job prompt is ~1.7K tokens vs Sonnet 4.6's 2,048-token minimum
   cacheable prefix — the marker may be silently ignored. If reads stay 0 on `/api/analyze`,
   pad `server/prompt.js` past 2,048 tokens (or accept no cache on the job path).
   The company prompt (~2K tokens) is borderline too.
3. `/dash` → new "Trending Now" section renders (zeros until a day has 3+ repeated titles — expected).

## Decisions locked in planning (don't re-litigate without new evidence)

- F1: Sonnet 4.6 primary / Haiku 4.5 fallback (not Opus — cheaper, less correlated overload)
- F5: scoring_version bump is **conditional** on the gate above, not automatic
- S3: tone system deleted (UI was removed months ago at <1% usage; modifiers live in git history)
- S5: EmailCapture removed; no sending integration; `/api/subscribe` + data retained
- G3: response streaming deliberately skipped — revisit only if post-migration p95 latency
  exceeds ~8–10s during a viral spike

## Deferred / known-open items

- Pre-existing lint errors in `Leaderboard.jsx`, `LiveFeed.jsx`, `StickyShareCTA.jsx`, `App.jsx` (out of scope)
- SEO page regeneration on the new model (`node scripts/seed-seo.js`) — optional, only if you
  want existing pages re-scored under 4.6; new/uncached slugs already use the new model
- Frontend score-color functions still need manual sync on any boundary change
  (server-side trio is now test-enforced by `tests/status-alignment.test.js`)

## After merge

Delete this file (it's a point-in-time handoff, not living documentation — CLAUDE.md is).
