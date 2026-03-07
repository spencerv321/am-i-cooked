// Shared scoring formula — used by api.js, seo.js, rescore.js, seed-seo.js
// Computes a final AI disruption score from 6 factual dimension percentages.
//
// Why decomposition? LLMs are bad at generating well-distributed single numbers
// (score 67 alone accounted for 25% of all analyses). By asking for factual task
// breakdowns and computing the score server-side, we get smooth distributions
// with 24+ unique scores per 30 jobs and populated Medium bucket.
//
// Formula J — 93% anchor accuracy in testing (28/30 jobs in target range)

const DIMENSION_KEYS = [
  'routine_data_text',
  'structured_rule_analysis',
  'content_creation',
  'novel_problem_solving',
  'physical_and_environmental',
  'interpersonal_emotional',
]

// Cognitive vulnerability weights — how much each cognitive dimension
// contributes to AI disruption risk
const COG_WEIGHTS = {
  routine_data_text: 0.95,       // Most automatable — data entry, scheduling, form-filling
  structured_rule_analysis: 0.62, // Rule-following analysis (tax, compliance, code review)
  content_creation: 0.85,         // Writing, design, translation — AI generates at scale
  novel_problem_solving: 0.18,    // True creative/strategic work — hardest for AI
}

/**
 * Compute AI disruption score from 6 dimension percentages.
 *
 * Architecture: "Physical Protection" model
 * 1. Sum cognitive vulnerability (4 dimensions × weights)
 * 2. Compute protection factor from physical + interpersonal work
 * 3. Apply non-linear dampening (power 1.4) so low physical barely protects,
 *    high physical strongly protects
 * 4. Scale to 0-100
 *
 * @param {Object} dimensions - 6 integer percentages summing to ~100
 * @returns {number} Score 0-100
 */
export function computeScore(dimensions) {
  // Step 1: Cognitive vulnerability (weighted sum of AI-vulnerable dimensions)
  let cogVulnerability = 0
  for (const [key, weight] of Object.entries(COG_WEIGHTS)) {
    cogVulnerability += (dimensions[key] || 0) * weight
  }

  // Step 2: Protection factor from physical + interpersonal work
  const physPct = (dimensions.physical_and_environmental || 0) / 100
  const intPct = (dimensions.interpersonal_emotional || 0) / 100
  const rawProtection = physPct + intPct * 0.65

  // Step 3: Non-linear dampening — power 1.4
  // 19% physical → effective 10.5% dampening (real estate agent barely protected)
  // 53% physical → effective 39% dampening (firefighter strongly protected)
  const effectiveProtection = Math.pow(rawProtection, 1.4)
  const dampened = cogVulnerability * (1 - effectiveProtection * 0.95)

  // Step 4: Scale to 0-100 (max theoretical cogVulnerability ≈ 95)
  return Math.max(0, Math.min(100, Math.round(dampened * (100 / 95))))
}

/**
 * Map a numeric score to its status label.
 * @param {number} score - Score 0-100
 * @returns {string} Status label
 */
export function scoreToStatus(score) {
  if (score <= 20) return 'Raw'
  if (score <= 40) return 'Medium Rare'
  if (score <= 60) return 'Medium'
  if (score <= 80) return 'Well Done'
  return 'Fully Cooked'
}

/**
 * Map a numeric score to its emoji.
 * @param {number} score - Score 0-100
 * @returns {string} Emoji
 */
export function scoreToEmoji(score) {
  if (score <= 20) return '🧊'
  if (score <= 40) return '🥩'
  if (score <= 60) return '🍳'
  if (score <= 80) return '🔥'
  return '💀'
}

/**
 * Validate that dimensions object has all required keys with valid integer values.
 * @param {Object} dims - Dimensions object from Claude's response
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateDimensions(dims) {
  if (!dims || typeof dims !== 'object') {
    return { valid: false, error: 'Missing dimensions object' }
  }

  for (const key of DIMENSION_KEYS) {
    const val = dims[key]
    if (val === undefined || val === null) {
      return { valid: false, error: `Missing dimension: ${key}` }
    }
    if (typeof val !== 'number' || !Number.isInteger(val)) {
      return { valid: false, error: `Dimension ${key} must be an integer, got ${typeof val}: ${val}` }
    }
    if (val < 0 || val > 100) {
      return { valid: false, error: `Dimension ${key} out of range: ${val}` }
    }
  }

  return { valid: true }
}
