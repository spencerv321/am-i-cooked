// Test decomposition scoring v2 — fixes sub-score rounding + low-end compression
// Runs 30 diverse jobs through both approaches, compares distributions
// Usage: ANTHROPIC_API_KEY=... node scripts/test-decomposition.js

import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT as OLD_PROMPT } from '../../server/prompt.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-sonnet-4-20250514'

// ── New decomposition prompt (v2 — fixes from round 1) ──

const DECOMPOSITION_PROMPT = `You are an AI job disruption analyst. Given a job title, you assess how vulnerable that role is to AI automation based on current and near-future AI capabilities (as of early 2026).

You must respond ONLY with valid JSON matching this exact schema:

{
  "dimensions": {
    "routine_data_text": <integer 0-100>,
    "structured_rule_analysis": <integer 0-100>,
    "content_creation": <integer 0-100>,
    "novel_problem_solving": <integer 0-100>,
    "physical_and_environmental": <integer 0-100>,
    "interpersonal_emotional": <integer 0-100>
  },
  "holistic_score": <number 0-100>,
  "status": "<string: one of 'Fully Cooked', 'Well Done', 'Medium', 'Medium Rare', 'Raw'>",
  "status_emoji": "<single emoji matching the status>",
  "timeline": "<string: estimated time until significant disruption>",
  "hot_take": "<string: one punchy, slightly irreverent sentence about this role's AI future>",
  "vulnerable_tasks": [
    {"task": "<specific task AI can already do or will soon>", "risk": "<high/medium/low>"}
  ],
  "safe_tasks": [
    {"task": "<specific task that remains hard for AI>", "reason": "<brief why>"}
  ],
  "tldr": "<2-3 sentence summary>"
}

DIMENSION DEFINITIONS — estimate what percentage of this role's ACTUAL DAILY WORK falls into each category. These must sum to approximately 100:

1. routine_data_text: Repetitive data processing, form-filling, record-keeping, scheduling, boilerplate emails, file management, basic lookups, copying data between systems. Work that follows fixed patterns with clear inputs and outputs.

2. structured_rule_analysis: Applying established rules, frameworks, or methodologies to information — BUT ONLY when this work can be done at a desk/computer without physical presence. Tax code interpretation, regulatory compliance review, financial modeling, code review following style guides, grading against a rubric, insurance claim assessment, legal document review.

3. content_creation: Generating written or visual content. Marketing copy, articles, reports, translations, summaries, graphic design from briefs, presentation decks, social media posts. The primary output is a content artifact.

4. novel_problem_solving: Cognitive work with NO established playbook. True creative direction, research hypothesis generation, architectural decisions under deep uncertainty, courtroom strategy adaptation, complex medical diagnosis where textbooks don't cover it, inventing new approaches, entrepreneurial judgment. NOT following protocols — that's structured_rule_analysis.

5. physical_and_environmental: ALL tasks requiring a human body in a physical space — INCLUDING cognitive work inseparable from physical presence. A surgeon's intraoperative decisions count here because you can't automate the judgment without also automating the hands. A firefighter's scene assessment counts here because it requires being IN the burning building. Also: manual repairs, patient physical care, construction, equipment operation, driving, emergency response, cooking, physical examinations, athletic performance.

6. interpersonal_emotional: Work that depends fundamentally on human trust, empathy, or rapport. Therapy sessions, mentoring relationships, bedside manner with frightened patients, building long-term client trust, conflict mediation, team leadership through crisis, sales relationships where the human bond IS the product. NOT transactional human interaction (that's routine_data_text).

PRECISION RULES:
- Use PRECISE percentages reflecting the specific role. Values like 7, 13, 22, 31, 48, 63 are expected. Do NOT default to round multiples of 5 — 15, 20, 25, 30 are suspiciously neat and usually wrong. Think about the actual hour-by-hour breakdown.
- Example — Registered Nurse: routine_data_text: 18 (charting, med logging), structured_rule_analysis: 8 (medication protocols, vitals interpretation), content_creation: 2 (care reports), novel_problem_solving: 7 (unusual symptoms, patient-specific judgment calls), physical_and_environmental: 42 (wound care, turning patients, physical exams, administering IVs), interpersonal_emotional: 23 (comforting patients, family communication, team coordination). Sum = 100.
- Example — Marketing Manager: routine_data_text: 19 (scheduling, budget tracking, email), structured_rule_analysis: 12 (analytics reporting, A/B test evaluation), content_creation: 38 (campaigns, copy, decks), novel_problem_solving: 14 (brand strategy, market positioning), physical_and_environmental: 2 (event oversight), interpersonal_emotional: 15 (team management, client relationships). Sum = 100.

The holistic_score field is your independent gut-feel score 0-100 for how AI-disrupted this role is. This is separate from the dimensions.

SCORING CONTEXT (for holistic_score):
- 81-100: "Fully Cooked" 💀 — AI can already handle most core tasks
- 61-80: "Well Done" 🔥 — Major disruption within 1-2 years
- 41-60: "Medium" 🍳 — Mixed picture, some tasks automated but core resists
- 21-40: "Medium Rare" 🥩 — Mostly safe, AI nibbling at edges
- 0-20: "Raw" 🧊 — Physical or deeply human work AI can't touch

Be honest and data-driven. Reference specific AI tools where relevant.`

// ── Scoring formulas (testing multiple) ──

const WEIGHTS_V2 = {
  routine_data_text: 0.93,
  structured_rule_analysis: 0.65,
  content_creation: 0.83,
  novel_problem_solving: 0.20,
  physical_and_environmental: 0.03,
  interpersonal_emotional: 0.08,
}

function computeRaw(dims, weights) {
  let raw = 0
  for (const [key, weight] of Object.entries(weights)) {
    raw += (dims[key] || 0) * weight
  }
  return raw
}

// Formula A: Linear scaling (simple)
function formulaLinear(dims) {
  const raw = computeRaw(dims, WEIGHTS_V2)
  const maxRaw = Math.max(...Object.values(WEIGHTS_V2)) * 100 // 93
  return Math.max(0, Math.min(100, Math.round(raw * (100 / maxRaw))))
}

// Formula B: Power curve — stretches the extremes, compresses the middle
function formulaPower(dims) {
  const raw = computeRaw(dims, WEIGHTS_V2)
  const maxRaw = Math.max(...Object.values(WEIGHTS_V2)) * 100
  const normalized = raw / maxRaw // 0-1
  const curved = Math.pow(normalized, 1.08) // gentle power curve
  return Math.max(0, Math.min(100, Math.round(curved * 100)))
}

// Formula C: Piecewise linear — different slopes for different ranges
function formulaPiecewise(dims) {
  const raw = computeRaw(dims, WEIGHTS_V2)
  // Empirical breakpoints based on round 1 data:
  // raw 0-15 → score 0-12   (physical jobs)
  // raw 15-35 → score 12-40  (mixed physical/cognitive)
  // raw 35-60 → score 40-65  (medium range)
  // raw 60-93 → score 65-100 (knowledge/data jobs)
  let score
  if (raw <= 15) {
    score = raw * (12 / 15)
  } else if (raw <= 35) {
    score = 12 + (raw - 15) * (28 / 20)
  } else if (raw <= 60) {
    score = 40 + (raw - 35) * (25 / 25)
  } else {
    score = 65 + (raw - 60) * (35 / 33)
  }
  return Math.max(0, Math.min(100, Math.round(score)))
}

// Formula D: Anchor-calibrated — tune weights to match known anchor expectations
const WEIGHTS_CALIBRATED = {
  routine_data_text: 0.95,
  structured_rule_analysis: 0.62,
  content_creation: 0.85,
  novel_problem_solving: 0.15,
  physical_and_environmental: 0.02,
  interpersonal_emotional: 0.06,
}

function formulaCalibrated(dims) {
  const raw = computeRaw(dims, WEIGHTS_CALIBRATED)
  const maxRaw = Math.max(...Object.values(WEIGHTS_CALIBRATED)) * 100 // 95
  return Math.max(0, Math.min(100, Math.round(raw * (100 / maxRaw))))
}

const FORMULAS = {
  linear: formulaLinear,
  power: formulaPower,
  piecewise: formulaPiecewise,
  calibrated: formulaCalibrated,
}

// ── Test jobs (30, spanning full spectrum) ──

const TEST_JOBS = [
  // Expected Raw (0-20)
  'firefighter', 'plumber', 'surgeon', 'electrician', 'construction worker',
  'mechanic', 'dentist',
  // Expected Medium Rare (21-40)
  'nurse', 'police officer', 'chef', 'teacher', 'pilot',
  'physical therapist', 'veterinarian',
  // Expected Medium (41-60)
  'architect', 'product manager', 'mechanical engineer', 'psychologist', 'civil engineer',
  // Expected Well Done (61-80)
  'software developer', 'journalist', 'real estate agent', 'marketing manager',
  'lawyer', 'graphic designer', 'UX researcher', 'accountant',
  // Expected Fully Cooked (81-100)
  'data entry clerk', 'copywriter', 'translator',
]

// Expected score ranges for anchor validation
const EXPECTED_RANGES = {
  'firefighter': [3, 15], 'plumber': [10, 22], 'surgeon': [8, 20],
  'electrician': [12, 25], 'construction worker': [8, 20], 'mechanic': [12, 25], 'dentist': [12, 25],
  'nurse': [22, 35], 'police officer': [18, 32], 'chef': [22, 38], 'teacher': [28, 42],
  'pilot': [25, 40], 'physical therapist': [20, 35], 'veterinarian': [20, 35],
  'architect': [40, 58], 'product manager': [45, 62], 'mechanical engineer': [38, 55],
  'psychologist': [28, 45], 'civil engineer': [38, 55],
  'software developer': [60, 75], 'journalist': [62, 78], 'real estate agent': [55, 72],
  'marketing manager': [62, 78], 'lawyer': [62, 78], 'graphic designer': [50, 68],
  'UX researcher': [55, 72], 'accountant': [68, 80],
  'data entry clerk': [88, 98], 'copywriter': [80, 92], 'translator': [75, 88],
}

// ── Run tests ──

async function analyzeJob(prompt, jobTitle) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: prompt,
    messages: [{ role: 'user', content: `Job title: ${jobTitle}` }],
  })
  let text = message.content[0].text
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
  return JSON.parse(text)
}

async function runOldPrompt(jobTitle) {
  const data = await analyzeJob(OLD_PROMPT, jobTitle)
  return { score: data.score, status: data.status }
}

async function runNewPrompt(jobTitle) {
  const data = await analyzeJob(DECOMPOSITION_PROMPT, jobTitle)
  return {
    dimensions: data.dimensions,
    holistic_score: data.holistic_score,
    status: data.status,
  }
}

function distributionStats(scores) {
  const sorted = [...scores].sort((a, b) => a - b)
  const n = sorted.length
  const mean = scores.reduce((a, b) => a + b, 0) / n
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / n
  const stddev = Math.sqrt(variance)
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)]
  const uniqueScores = new Set(scores).size

  const freq = new Map()
  for (const s of scores) freq.set(s, (freq.get(s) || 0) + 1)
  const maxFreqEntry = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]

  const sortedFreq = [...freq.entries()].sort((a, b) => b[1] - a[1])
  let cumulative = 0
  let scoresFor50 = 0
  for (const [, count] of sortedFreq) {
    cumulative += count
    scoresFor50++
    if (cumulative >= n * 0.5) break
  }

  const buckets = { 'Raw (0-20)': 0, 'Med Rare (21-40)': 0, 'Medium (41-60)': 0, 'Well Done (61-80)': 0, 'Fully Cooked (81-100)': 0 }
  for (const s of scores) {
    if (s <= 20) buckets['Raw (0-20)']++
    else if (s <= 40) buckets['Med Rare (21-40)']++
    else if (s <= 60) buckets['Medium (41-60)']++
    else if (s <= 80) buckets['Well Done (61-80)']++
    else buckets['Fully Cooked (81-100)']++
  }

  return { mean: mean.toFixed(1), median, stddev: stddev.toFixed(1), min: sorted[0], max: sorted[n - 1], uniqueScores, totalScores: n, mostCommon: `${maxFreqEntry[0]} (${maxFreqEntry[1]}x)`, scoresFor50pct: scoresFor50, buckets }
}

async function main() {
  console.log('=== DECOMPOSITION SCORING v2 TEST ===')
  console.log(`Model: ${MODEL}`)
  console.log(`Jobs: ${TEST_JOBS.length}`)
  console.log(`Fixes: anti-rounding instruction, physical-context cognition, calibrated weights\n`)

  const results = []
  let completed = 0

  for (const job of TEST_JOBS) {
    process.stdout.write(`  [${completed + 1}/${TEST_JOBS.length}] ${job}...`)

    try {
      const [oldResult, newResult] = await Promise.all([
        runOldPrompt(job),
        runNewPrompt(job),
      ])
      results.push({ job, old: oldResult, new: newResult })
      const comp = formulaPiecewise(newResult.dimensions)
      console.log(` old=${oldResult.score}, holistic=${newResult.holistic_score}, computed=${comp}`)
    } catch (err) {
      console.log(` ERROR: ${err.message}`)
      await new Promise(r => setTimeout(r, 3000))
      try {
        const [oldResult, newResult] = await Promise.all([
          runOldPrompt(job),
          runNewPrompt(job),
        ])
        results.push({ job, old: oldResult, new: newResult })
        console.log(` (retry ok)`)
      } catch (err2) {
        console.log(` FAILED: ${err2.message}`)
      }
    }

    completed++
    if (completed < TEST_JOBS.length) await new Promise(r => setTimeout(r, 500))
  }

  // ── Detailed results table ──
  console.log('\n' + '='.repeat(140))
  console.log('\n--- DETAILED RESULTS ---\n')

  const hdr = 'Job'.padEnd(22) + '| Old|  Hol| LinR| Powr| Pwis| Calb| routine|struct|contnt|novel |physic|interp| Sum|InRange'
  console.log(hdr)
  console.log('-'.repeat(hdr.length))

  for (const r of results) {
    const d = r.new.dimensions
    const dimSum = Object.values(d).reduce((a, b) => a + b, 0)
    const scores = {}
    for (const [name, fn] of Object.entries(FORMULAS)) {
      scores[name] = fn(d)
    }
    const expected = EXPECTED_RANGES[r.job]
    const piecewiseInRange = expected ? (scores.piecewise >= expected[0] && scores.piecewise <= expected[1] ? '  ✓' : ` ✗ [${expected[0]}-${expected[1]}]`) : '  ?'

    const line = r.job.padEnd(22)
      + `| ${String(r.old.score).padStart(3)}`
      + `| ${String(r.new.holistic_score).padStart(4)}`
      + `| ${String(scores.linear).padStart(4)}`
      + `| ${String(scores.power).padStart(4)}`
      + `| ${String(scores.piecewise).padStart(4)}`
      + `| ${String(scores.calibrated).padStart(4)}`
      + `| ${String(d.routine_data_text || 0).padStart(7)}`
      + `| ${String(d.structured_rule_analysis || 0).padStart(5)}`
      + `| ${String(d.content_creation || 0).padStart(5)}`
      + `| ${String(d.novel_problem_solving || 0).padStart(5)}`
      + `| ${String(d.physical_and_environmental || 0).padStart(5)}`
      + `| ${String(d.interpersonal_emotional || 0).padStart(5)}`
      + `| ${String(dimSum).padStart(3)}`
      + `|${piecewiseInRange}`
    console.log(line)
  }

  // ── Distribution comparison across all formulas ──
  console.log('\n' + '='.repeat(110))
  console.log('\n--- DISTRIBUTION COMPARISON ---\n')

  const oldScores = results.map(r => r.old.score)
  const holisticScores = results.map(r => r.new.holistic_score)
  const formulaScores = {}
  for (const [name, fn] of Object.entries(FORMULAS)) {
    formulaScores[name] = results.map(r => fn(r.new.dimensions))
  }

  const allSets = [
    ['Old Prompt', oldScores],
    ['Holistic', holisticScores],
    ...Object.entries(formulaScores).map(([n, s]) => [`Formula: ${n}`, s]),
  ]

  const header = 'Metric'.padEnd(28) + allSets.map(([n]) => `| ${n.padEnd(16)}`).join('')
  console.log(header)
  console.log('-'.repeat(header.length))

  const metricLabels = [
    ['Mean', s => distributionStats(s).mean],
    ['Median', s => distributionStats(s).median],
    ['Std Dev', s => distributionStats(s).stddev],
    ['Min', s => distributionStats(s).min],
    ['Max', s => distributionStats(s).max],
    ['Unique Scores (/30)', s => distributionStats(s).uniqueScores],
    ['Most Common', s => distributionStats(s).mostCommon],
    ['Scores for 50%', s => distributionStats(s).scoresFor50pct],
  ]

  for (const [label, fn] of metricLabels) {
    const row = label.padEnd(28) + allSets.map(([, s]) => `| ${String(fn(s)).padEnd(16)}`).join('')
    console.log(row)
  }

  // ── Bucket distribution ──
  console.log('\n--- BUCKET DISTRIBUTION ---\n')
  const bucketNames = ['Raw (0-20)', 'Med Rare (21-40)', 'Medium (41-60)', 'Well Done (61-80)', 'Fully Cooked (81-100)']
  const bHeader = 'Bucket'.padEnd(22) + allSets.map(([n]) => `| ${n.padEnd(16)}`).join('')
  console.log(bHeader)
  console.log('-'.repeat(bHeader.length))
  for (const bucket of bucketNames) {
    const row = bucket.padEnd(22) + allSets.map(([, s]) => {
      const stats = distributionStats(s)
      return `| ${String(stats.buckets[bucket]).padEnd(16)}`
    }).join('')
    console.log(row)
  }

  // ── Sorted scores ──
  console.log('\n--- ALL SCORES (sorted) ---\n')
  for (const [label, scores] of allSets) {
    console.log(`  ${label.padEnd(20)}: ${[...scores].sort((a, b) => a - b).join(', ')}`)
  }

  // ── Repeat analysis ──
  console.log('\n--- REPEAT SCORE ANALYSIS ---\n')
  for (const [label, scores] of allSets) {
    const freq = new Map()
    for (const s of scores) freq.set(s, (freq.get(s) || 0) + 1)
    const repeats = [...freq.entries()].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1])
    if (repeats.length > 0) {
      console.log(`  ${label.padEnd(20)}: ${repeats.map(([s, c]) => `${s}×${c}`).join(', ')}`)
    } else {
      console.log(`  ${label.padEnd(20)}: NO repeated scores! 🎉`)
    }
  }

  // ── Sub-score clustering ──
  console.log('\n--- SUB-SCORE CLUSTERING (do dimensions still round to 5s?) ---\n')
  const dimNames = Object.keys(WEIGHTS_V2)
  let totalMultOf5 = 0
  let totalValues = 0
  for (const dim of dimNames) {
    const values = results.map(r => r.new.dimensions[dim] || 0)
    const multOf5 = values.filter(v => v % 5 === 0 && v !== 0).length
    totalMultOf5 += multOf5
    totalValues += values.length
    const unique = new Set(values).size
    const freq = new Map()
    for (const v of values) freq.set(v, (freq.get(v) || 0) + 1)
    const top3 = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    console.log(`  ${dim.padEnd(30)}: ${unique} unique values, ${multOf5}/30 are mult of 5. Top: ${top3.map(([v, c]) => `${v}(${c}x)`).join(', ')}`)
  }
  console.log(`\n  Overall mult-of-5 rate: ${totalMultOf5}/${totalValues} (${(totalMultOf5 / totalValues * 100).toFixed(1)}%) — target: <30%`)

  // ── Anchor validation ──
  console.log('\n--- ANCHOR VALIDATION (piecewise formula vs expected ranges) ---\n')
  let inRange = 0
  let total = 0
  for (const r of results) {
    const expected = EXPECTED_RANGES[r.job]
    if (!expected) continue
    total++
    const score = formulaPiecewise(r.new.dimensions)
    const ok = score >= expected[0] && score <= expected[1]
    if (ok) inRange++
    if (!ok) {
      console.log(`  ✗ ${r.job.padEnd(22)}: got ${score}, expected ${expected[0]}-${expected[1]}`)
    }
  }
  console.log(`\n  ${inRange}/${total} jobs in expected range (${(inRange / total * 100).toFixed(0)}%)`)

  console.log('\n=== TEST COMPLETE ===')
}

main().catch(err => { console.error(err); process.exit(1) })
