# Research scripts (historical)

One-off scripts from the March 2026 scoring redesign that produced Formula J
(`server/scoring.js`). Kept for provenance — they reference the old
`claude-sonnet-4-20250514` model and the pre-decomposition prompt, so their
output no longer matches production. Don't run them expecting current numbers.

- `test-decomposition.js` — ran 30 jobs through the holistic prompt vs. the
  6-dimension decomposition prompt and compared distributions.
- `tune-formula.js` — offline formula tuning against the dimension data from
  that run (no API calls). This is where the `^1.4` exponent and `0.95` ceiling
  came from.

For current score-distribution checks use `scripts/test-scores.js` (live API)
or `scripts/analyze-scores.js` (from the DB).
