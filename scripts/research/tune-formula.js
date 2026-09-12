// Formula tuning script — uses dimension data from v2 test run
// Tests different scoring formulas WITHOUT making API calls

// Dimension data from v2 test (30 jobs)
const DATA = [
  { job: 'firefighter',        old: 8,  dims: { routine_data_text: 12, structured_rule_analysis: 8,  content_creation: 3,  novel_problem_solving: 15, physical_and_environmental: 53, interpersonal_emotional: 9 }},
  { job: 'plumber',             old: 8,  dims: { routine_data_text: 8,  structured_rule_analysis: 12, content_creation: 3,  novel_problem_solving: 19, physical_and_environmental: 53, interpersonal_emotional: 5 }},
  { job: 'surgeon',             old: 12, dims: { routine_data_text: 12, structured_rule_analysis: 18, content_creation: 8,  novel_problem_solving: 17, physical_and_environmental: 38, interpersonal_emotional: 7 }},
  { job: 'electrician',         old: 18, dims: { routine_data_text: 12, structured_rule_analysis: 23, content_creation: 3,  novel_problem_solving: 18, physical_and_environmental: 37, interpersonal_emotional: 7 }},
  { job: 'construction worker', old: 14, dims: { routine_data_text: 8,  structured_rule_analysis: 12, content_creation: 3,  novel_problem_solving: 11, physical_and_environmental: 61, interpersonal_emotional: 5 }},
  { job: 'mechanic',            old: 19, dims: { routine_data_text: 12, structured_rule_analysis: 18, content_creation: 3,  novel_problem_solving: 19, physical_and_environmental: 43, interpersonal_emotional: 5 }},
  { job: 'dentist',             old: 18, dims: { routine_data_text: 12, structured_rule_analysis: 19, content_creation: 3,  novel_problem_solving: 8,  physical_and_environmental: 47, interpersonal_emotional: 11 }},
  { job: 'nurse',               old: 28, dims: { routine_data_text: 22, structured_rule_analysis: 18, content_creation: 3,  novel_problem_solving: 12, physical_and_environmental: 31, interpersonal_emotional: 14 }},
  { job: 'police officer',      old: 23, dims: { routine_data_text: 22, structured_rule_analysis: 18, content_creation: 8,  novel_problem_solving: 12, physical_and_environmental: 31, interpersonal_emotional: 9 }},
  { job: 'chef',                old: 34, dims: { routine_data_text: 12, structured_rule_analysis: 8,  content_creation: 7,  novel_problem_solving: 18, physical_and_environmental: 47, interpersonal_emotional: 8 }},
  { job: 'teacher',             old: 34, dims: { routine_data_text: 22, structured_rule_analysis: 18, content_creation: 17, novel_problem_solving: 12, physical_and_environmental: 13, interpersonal_emotional: 18 }},
  { job: 'pilot',               old: 34, dims: { routine_data_text: 22, structured_rule_analysis: 31, content_creation: 3,  novel_problem_solving: 18, physical_and_environmental: 24, interpersonal_emotional: 2 }},
  { job: 'physical therapist',  old: 24, dims: { routine_data_text: 22, structured_rule_analysis: 19, content_creation: 8,  novel_problem_solving: 12, physical_and_environmental: 26, interpersonal_emotional: 13 }},
  { job: 'veterinarian',        old: 27, dims: { routine_data_text: 18, structured_rule_analysis: 23, content_creation: 7,  novel_problem_solving: 12, physical_and_environmental: 32, interpersonal_emotional: 8 }},
  { job: 'architect',           old: 67, dims: { routine_data_text: 14, structured_rule_analysis: 26, content_creation: 31, novel_problem_solving: 23, physical_and_environmental: 4,  interpersonal_emotional: 2 }},
  { job: 'product manager',     old: 67, dims: { routine_data_text: 22, structured_rule_analysis: 18, content_creation: 31, novel_problem_solving: 23, physical_and_environmental: 1,  interpersonal_emotional: 5 }},
  { job: 'mechanical engineer', old: 34, dims: { routine_data_text: 22, structured_rule_analysis: 31, content_creation: 18, novel_problem_solving: 19, physical_and_environmental: 7,  interpersonal_emotional: 3 }},
  { job: 'psychologist',        old: 34, dims: { routine_data_text: 22, structured_rule_analysis: 18, content_creation: 12, novel_problem_solving: 19, physical_and_environmental: 3,  interpersonal_emotional: 26 }},
  { job: 'civil engineer',      old: 38, dims: { routine_data_text: 22, structured_rule_analysis: 38, content_creation: 12, novel_problem_solving: 17, physical_and_environmental: 8,  interpersonal_emotional: 3 }},
  { job: 'software developer',  old: 67, dims: { routine_data_text: 12, structured_rule_analysis: 31, content_creation: 22, novel_problem_solving: 28, physical_and_environmental: 3,  interpersonal_emotional: 4 }},
  { job: 'journalist',          old: 67, dims: { routine_data_text: 22, structured_rule_analysis: 18, content_creation: 47, novel_problem_solving: 8,  physical_and_environmental: 2,  interpersonal_emotional: 3 }},
  { job: 'real estate agent',   old: 67, dims: { routine_data_text: 28, structured_rule_analysis: 12, content_creation: 18, novel_problem_solving: 7,  physical_and_environmental: 19, interpersonal_emotional: 16 }},
  { job: 'marketing manager',   old: 67, dims: { routine_data_text: 22, structured_rule_analysis: 14, content_creation: 31, novel_problem_solving: 18, physical_and_environmental: 3,  interpersonal_emotional: 12 }},
  { job: 'lawyer',              old: 67, dims: { routine_data_text: 22, structured_rule_analysis: 47, content_creation: 18, novel_problem_solving: 8,  physical_and_environmental: 1,  interpersonal_emotional: 4 }},
  { job: 'graphic designer',    old: 67, dims: { routine_data_text: 12, structured_rule_analysis: 8,  content_creation: 67, novel_problem_solving: 11, physical_and_environmental: 0,  interpersonal_emotional: 2 }},
  { job: 'UX researcher',       old: 67, dims: { routine_data_text: 22, structured_rule_analysis: 28, content_creation: 31, novel_problem_solving: 13, physical_and_environmental: 2,  interpersonal_emotional: 4 }},
  { job: 'accountant',          old: 72, dims: { routine_data_text: 42, structured_rule_analysis: 38, content_creation: 7,  novel_problem_solving: 8,  physical_and_environmental: 1,  interpersonal_emotional: 4 }},
  { job: 'data entry clerk',    old: 93, dims: { routine_data_text: 87, structured_rule_analysis: 8,  content_creation: 1,  novel_problem_solving: 2,  physical_and_environmental: 1,  interpersonal_emotional: 1 }},
  { job: 'copywriter',          old: 84, dims: { routine_data_text: 12, structured_rule_analysis: 8,  content_creation: 67, novel_problem_solving: 9,  physical_and_environmental: 1,  interpersonal_emotional: 3 }},
  { job: 'translator',          old: 78, dims: { routine_data_text: 12, structured_rule_analysis: 23, content_creation: 58, novel_problem_solving: 4,  physical_and_environmental: 1,  interpersonal_emotional: 2 }},
]

// Ideal target ranges — widened where the old anchors were arguably wrong
const TARGETS = {
  'firefighter': [3, 15], 'plumber': [8, 22], 'surgeon': [8, 25],
  'electrician': [12, 28], 'construction worker': [5, 18], 'mechanic': [12, 25], 'dentist': [12, 25],
  'nurse': [22, 35], 'police officer': [18, 35], 'chef': [18, 35], 'teacher': [28, 45],
  'pilot': [25, 42], 'physical therapist': [20, 38], 'veterinarian': [20, 35],
  'architect': [45, 65], 'product manager': [50, 68], 'mechanical engineer': [45, 62],
  'psychologist': [28, 48], 'civil engineer': [42, 60],
  'software developer': [55, 72], 'journalist': [65, 80], 'real estate agent': [45, 65],
  'marketing manager': [55, 72], 'lawyer': [62, 78], 'graphic designer': [60, 80],
  'UX researcher': [58, 75], 'accountant': [68, 82],
  'data entry clerk': [88, 98], 'copywriter': [75, 90], 'translator': [72, 86],
}

// ── Core formula: Protection model with NON-LINEAR dampening ──
// Key fix: low physical % (<20%) should barely dampen. High physical (>40%) should dampen heavily.
// This prevents real estate agent (19% physical) from being treated like firefighter (53% physical).

function computeCogVulnerability(dims, cogWeights) {
  let v = 0
  for (const [key, weight] of Object.entries(cogWeights)) {
    v += (dims[key] || 0) * weight
  }
  return v
}

function computeProtection(dims, interpersonalFactor) {
  const physPct = (dims.physical_and_environmental || 0) / 100
  const intPct = (dims.interpersonal_emotional || 0) / 100
  return physPct + intPct * interpersonalFactor
}

// J: Non-linear protection — uses power curve on protection factor
// protection^1.4 means: 19% physical → effective 10.5%, 53% physical → effective 39%
function formulaJ(dims) {
  const cogWeights = { routine_data_text: 0.95, structured_rule_analysis: 0.62, content_creation: 0.85, novel_problem_solving: 0.18 }
  const cog = computeCogVulnerability(dims, cogWeights)
  const rawProtection = computeProtection(dims, 0.65)
  const effectiveProtection = Math.pow(rawProtection, 1.4) // non-linear: squishes low values
  const dampened = cog * (1 - effectiveProtection * 0.95)
  return Math.max(0, Math.min(100, Math.round(dampened * (100 / 95))))
}

// K: Same as J but with tuned exponent and weights
function formulaK(dims) {
  const cogWeights = { routine_data_text: 0.95, structured_rule_analysis: 0.65, content_creation: 0.85, novel_problem_solving: 0.22 }
  const cog = computeCogVulnerability(dims, cogWeights)
  const rawProtection = computeProtection(dims, 0.60)
  const effectiveProtection = Math.pow(rawProtection, 1.35)
  const dampened = cog * (1 - effectiveProtection * 0.92)
  return Math.max(0, Math.min(100, Math.round(dampened * (100 / 95))))
}

// L: More aggressive non-linearity (power 1.5) + slightly different cog weights
function formulaL(dims) {
  const cogWeights = { routine_data_text: 0.95, structured_rule_analysis: 0.63, content_creation: 0.85, novel_problem_solving: 0.20 }
  const cog = computeCogVulnerability(dims, cogWeights)
  const rawProtection = computeProtection(dims, 0.62)
  const effectiveProtection = Math.pow(rawProtection, 1.5)
  const dampened = cog * (1 - effectiveProtection * 0.95)
  return Math.max(0, Math.min(100, Math.round(dampened * (100 / 95))))
}

// M: Two-tier protection: physical gets stronger dampening than interpersonal
// And interpersonal itself has a non-linear curve
function formulaM(dims) {
  const cogWeights = { routine_data_text: 0.95, structured_rule_analysis: 0.63, content_creation: 0.85, novel_problem_solving: 0.20 }
  const cog = computeCogVulnerability(dims, cogWeights)
  const physPct = (dims.physical_and_environmental || 0) / 100
  const intPct = (dims.interpersonal_emotional || 0) / 100
  // Physical protection: non-linear, stronger
  const physProtection = Math.pow(physPct, 1.4) * 0.95
  // Interpersonal protection: non-linear, weaker
  const intProtection = Math.pow(intPct, 1.6) * 0.55
  const totalProtection = Math.min(0.92, physProtection + intProtection)
  const dampened = cog * (1 - totalProtection)
  return Math.max(0, Math.min(100, Math.round(dampened * (100 / 95))))
}

// N: Like M but with softened interpersonal and adjusted novel weight
function formulaN(dims) {
  const cogWeights = { routine_data_text: 0.95, structured_rule_analysis: 0.64, content_creation: 0.85, novel_problem_solving: 0.22 }
  const cog = computeCogVulnerability(dims, cogWeights)
  const physPct = (dims.physical_and_environmental || 0) / 100
  const intPct = (dims.interpersonal_emotional || 0) / 100
  const physProtection = Math.pow(physPct, 1.35) * 0.92
  const intProtection = Math.pow(intPct, 1.5) * 0.48
  const totalProtection = Math.min(0.90, physProtection + intProtection)
  const dampened = cog * (1 - totalProtection)
  return Math.max(0, Math.min(100, Math.round(dampened * (100 / 95))))
}

const FORMULAS = {
  'J: NonLin-1.4':  formulaJ,
  'K: NonLin-1.35': formulaK,
  'L: NonLin-1.5':  formulaL,
  'M: TwoTier':     formulaM,
  'N: TwoTier-v2':  formulaN,
}

// ── Analysis ──

function distributionStats(scores) {
  const sorted = [...scores].sort((a, b) => a - b)
  const n = sorted.length
  const mean = scores.reduce((a, b) => a + b, 0) / n
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / n
  const stddev = Math.sqrt(variance)
  const uniqueScores = new Set(scores).size
  const freq = new Map()
  for (const s of scores) freq.set(s, (freq.get(s) || 0) + 1)
  const maxFreqEntry = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]
  return { mean: mean.toFixed(1), stddev: stddev.toFixed(1), min: sorted[0], max: sorted[n - 1], uniqueScores, mostCommon: `${maxFreqEntry[0]}(${maxFreqEntry[1]}x)` }
}

function main() {
  console.log('=== FORMULA TUNING v2: NON-LINEAR PROTECTION ===\n')

  const formulaResults = {}
  for (const [name, fn] of Object.entries(FORMULAS)) {
    formulaResults[name] = DATA.map(d => ({ job: d.job, score: fn(d.dims), old: d.old }))
  }

  // Detailed table
  const hdr = 'Job'.padEnd(22) + '| Old ' + Object.keys(FORMULAS).map(n => `| ${n.padEnd(16)}`).join('')
  console.log(hdr)
  console.log('-'.repeat(hdr.length))

  for (let i = 0; i < DATA.length; i++) {
    const d = DATA[i]
    const target = TARGETS[d.job]
    let line = d.job.padEnd(22) + `| ${String(d.old).padStart(3)} `
    for (const [name] of Object.entries(FORMULAS)) {
      const score = formulaResults[name][i].score
      const inRange = target ? (score >= target[0] && score <= target[1]) : null
      const marker = inRange === true ? '✓' : inRange === false ? '✗' : ' '
      line += `| ${String(score).padStart(3)} ${marker}            `
    }
    console.log(line)
  }

  // Anchor validation
  console.log('\n--- ANCHOR VALIDATION ---\n')
  for (const [name, results] of Object.entries(formulaResults)) {
    let inRange = 0
    const misses = []
    for (const r of results) {
      const target = TARGETS[r.job]
      if (target && r.score >= target[0] && r.score <= target[1]) {
        inRange++
      } else if (target) {
        const diff = r.score < target[0] ? r.score - target[0] : r.score - target[1]
        misses.push(`${r.job}:${r.score}(${diff > 0 ? '+' : ''}${diff})`)
      }
    }
    console.log(`  ${name.padEnd(18)}: ${inRange}/30 (${(inRange / 30 * 100).toFixed(0)}%) — misses: ${misses.join(', ')}`)
  }

  // Stats
  console.log('\n--- DISTRIBUTION STATS ---\n')
  const oldScores = DATA.map(d => d.old)
  const allSets = [['Old Prompt', oldScores], ...Object.entries(formulaResults).map(([n, r]) => [n, r.map(x => x.score)])]

  const statsHdr = 'Metric'.padEnd(20) + allSets.map(([n]) => `| ${n.slice(0, 16).padEnd(16)}`).join('')
  console.log(statsHdr)
  console.log('-'.repeat(statsHdr.length))

  for (const [label, getter] of [
    ['Range', s => `${distributionStats(s).min}-${distributionStats(s).max}`],
    ['Mean', s => distributionStats(s).mean],
    ['Std Dev', s => distributionStats(s).stddev],
    ['Unique/30', s => distributionStats(s).uniqueScores],
    ['Most Common', s => distributionStats(s).mostCommon],
  ]) {
    let line = label.padEnd(20)
    for (const [, scores] of allSets) {
      line += `| ${String(getter(scores)).padEnd(16)}`
    }
    console.log(line)
  }

  // Sorted scores for the best
  console.log('\n--- SORTED SCORES ---\n')
  for (const [label, scores] of allSets) {
    console.log(`  ${label.slice(0, 18).padEnd(20)}: ${[...scores].sort((a, b) => a - b).join(', ')}`)
  }

  // Bucket distribution
  console.log('\n--- BUCKET DISTRIBUTION ---\n')
  const bucketNames = ['Raw (0-20)', 'Med Rare (21-40)', 'Medium (41-60)', 'Well Done (61-80)', 'Fully Cooked (81-100)']
  const bHdr = 'Bucket'.padEnd(22) + allSets.map(([n]) => `| ${n.slice(0, 16).padEnd(16)}`).join('')
  console.log(bHdr)
  console.log('-'.repeat(bHdr.length))
  for (const bucket of bucketNames) {
    let line = bucket.padEnd(22)
    for (const [, scores] of allSets) {
      let count = 0
      for (const s of scores) {
        if (bucket === 'Raw (0-20)' && s <= 20) count++
        else if (bucket === 'Med Rare (21-40)' && s >= 21 && s <= 40) count++
        else if (bucket === 'Medium (41-60)' && s >= 41 && s <= 60) count++
        else if (bucket === 'Well Done (61-80)' && s >= 61 && s <= 80) count++
        else if (bucket === 'Fully Cooked (81-100)' && s >= 81) count++
      }
      line += `| ${String(count).padEnd(16)}`
    }
    console.log(line)
  }

  // Final recommendation: detailed view of best formula
  const bestName = Object.entries(formulaResults).sort((a, b) => {
    const aHits = a[1].filter(r => { const t = TARGETS[r.job]; return t && r.score >= t[0] && r.score <= t[1] }).length
    const bHits = b[1].filter(r => { const t = TARGETS[r.job]; return t && r.score >= t[0] && r.score <= t[1] }).length
    return bHits - aHits
  })[0][0]

  console.log(`\n--- BEST: ${bestName} ---\n`)
  console.log('Job'.padEnd(22) + '| Old | New | Target     | Δ')
  console.log('-'.repeat(62))
  for (const r of formulaResults[bestName]) {
    const target = TARGETS[r.job]
    const tStr = target ? `${target[0]}-${target[1]}` : '?'
    const delta = r.score - r.old
    const deltaStr = (delta >= 0 ? '+' : '') + delta
    const inRange = target ? (r.score >= target[0] && r.score <= target[1]) : null
    const marker = inRange === true ? ' ✓' : inRange === false ? ' ✗' : ''
    console.log(`${r.job.padEnd(22)}| ${String(r.old).padStart(3)} | ${String(r.score).padStart(3)} | ${tStr.padEnd(10)} | ${deltaStr.padStart(4)}${marker}`)
  }
}

main()
