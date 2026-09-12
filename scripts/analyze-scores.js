// Score distribution analysis script — per-score histogram, clustering check,
// bucket split, percentiles, and per-title spread, straight from the DB.
//
// Usage: node scripts/analyze-scores.js [--since=YYYY-MM-DD] [--version=N]
//   --since     only rows created on/after this date (e.g. post-migration: 2026-06-12)
//   --version   only rows with this scoring_version (2 = Formula J)
//
// Reads DATABASE_URL, or DATABASE_PUBLIC_URL from .env when run locally.

import pg from 'pg'
import { loadEnv } from './lib/env.js'
const { Pool } = pg
loadEnv()

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.slice(2).split('=')
    return [k, v ?? true]
  })
)

// Shared row filter for every query below
const conds = [`score IS NOT NULL`, `(type IS NULL OR type = 'job')`]
if (args.since) conds.push(`created_at >= '${args.since.replace(/[^0-9-]/g, '')}'`)
if (args.version) conds.push(`scoring_version = ${parseInt(args.version)}`)
const FILTER = conds.join(' AND ')

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function main() {
  console.log('=== SCORE DISTRIBUTION ANALYSIS ===')
  console.log(`filter: ${FILTER}\n`)

  // 1. Total count
  const totalRes = await pool.query(`SELECT COUNT(*)::INTEGER AS c FROM analyses WHERE ${FILTER}`)
  console.log(`Total job analyses: ${totalRes.rows[0].c}\n`)

  // 2. Every individual score value and its frequency
  const freqRes = await pool.query(`
    SELECT score, COUNT(*)::INTEGER AS freq
    FROM analyses
    WHERE ${FILTER}
    GROUP BY score
    ORDER BY score
  `)

  const freqMap = new Map()
  let maxFreq = 0
  for (const row of freqRes.rows) {
    freqMap.set(row.score, row.freq)
    if (row.freq > maxFreq) maxFreq = row.freq
  }

  // 3. Show full 0-100 histogram
  console.log('--- FULL HISTOGRAM (score → frequency) ---')
  console.log('Score | Freq | Bar')
  console.log('------+------+' + '-'.repeat(50))
  for (let s = 0; s <= 100; s++) {
    const f = freqMap.get(s) || 0
    const barLen = Math.round((f / maxFreq) * 50)
    const bar = '█'.repeat(barLen)
    if (f > 0) {
      console.log(`  ${String(s).padStart(3)} | ${String(f).padStart(4)} | ${bar}`)
    }
  }

  // 4. Top 20 most common scores
  console.log('\n--- TOP 20 MOST COMMON SCORES ---')
  const sorted = [...freqMap.entries()].sort((a, b) => b[1] - a[1])
  const total = totalRes.rows[0].c
  for (let i = 0; i < Math.min(20, sorted.length); i++) {
    const [score, freq] = sorted[i]
    const pct = ((freq / total) * 100).toFixed(1)
    console.log(`  Score ${String(score).padStart(3)}: ${String(freq).padStart(4)} times (${pct}%)`)
  }

  // 5. Scores that NEVER appeared
  const unused = []
  for (let s = 0; s <= 100; s++) {
    if (!freqMap.has(s)) unused.push(s)
  }
  console.log(`\n--- UNUSED SCORES (never appeared) ---`)
  console.log(`  ${unused.length} scores never used: ${unused.join(', ')}`)

  // 6. Bucket distribution
  console.log('\n--- BUCKET DISTRIBUTION ---')
  const buckets = { 'Raw (0-20)': 0, 'Med Rare (21-40)': 0, 'Medium (41-60)': 0, 'Well Done (61-80)': 0, 'Fully Cooked (81-100)': 0 }
  for (const [score, freq] of freqMap) {
    if (score <= 20) buckets['Raw (0-20)'] += freq
    else if (score <= 40) buckets['Med Rare (21-40)'] += freq
    else if (score <= 60) buckets['Medium (41-60)'] += freq
    else if (score <= 80) buckets['Well Done (61-80)'] += freq
    else buckets['Fully Cooked (81-100)'] += freq
  }
  for (const [label, count] of Object.entries(buckets)) {
    const pct = ((count / total) * 100).toFixed(1)
    console.log(`  ${label.padEnd(25)}: ${String(count).padStart(5)} (${pct}%)`)
  }

  // 7. Statistical measures
  const statsRes = await pool.query(`
    SELECT
      AVG(score)::NUMERIC(5,2) AS avg_score,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY score) AS median,
      STDDEV(score)::NUMERIC(5,2) AS stddev,
      MIN(score) AS min_score,
      MAX(score) AS max_score,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY score) AS p25,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY score) AS p75,
      PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY score) AS p10,
      PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY score) AS p90
    FROM analyses
    WHERE ${FILTER}
  `)
  const stats = statsRes.rows[0]
  console.log('\n--- STATISTICAL SUMMARY ---')
  console.log(`  Mean:   ${stats.avg_score}`)
  console.log(`  Median: ${stats.median}`)
  console.log(`  StdDev: ${stats.stddev}`)
  console.log(`  Min:    ${stats.min_score}`)
  console.log(`  Max:    ${stats.max_score}`)
  console.log(`  P10:    ${stats.p10}`)
  console.log(`  P25:    ${stats.p25}`)
  console.log(`  P75:    ${stats.p75}`)
  console.log(`  P90:    ${stats.p90}`)

  // 8. Round number analysis
  console.log('\n--- ROUND NUMBER BIAS ---')
  let roundTotal = 0, nonRoundTotal = 0
  let roundCount = 0, nonRoundCount = 0
  for (const [score, freq] of freqMap) {
    if (score % 5 === 0) {
      roundTotal += freq
      roundCount++
    } else {
      nonRoundTotal += freq
      nonRoundCount++
    }
  }
  const expectedRoundPct = 20.0 // 21 out of 101 values are multiples of 5 ≈ 20.8%
  const actualRoundPct = ((roundTotal / total) * 100).toFixed(1)
  console.log(`  Multiples of 5: ${roundTotal} analyses (${actualRoundPct}%) — expected ~${expectedRoundPct}%`)
  console.log(`  Non-multiples:  ${nonRoundTotal} analyses (${((nonRoundTotal / total) * 100).toFixed(1)}%)`)

  // Also check multiples of 10
  let mult10Total = 0
  for (const [score, freq] of freqMap) {
    if (score % 10 === 0) mult10Total += freq
  }
  const expectedMult10 = 10.0
  console.log(`  Multiples of 10: ${mult10Total} analyses (${((mult10Total / total) * 100).toFixed(1)}%) — expected ~${expectedMult10}%`)

  // 9. Clustering analysis — how many unique scores account for 50% of all analyses?
  console.log('\n--- CLUSTERING ANALYSIS ---')
  let cumulative = 0
  let scoresFor50 = 0
  let scoresFor80 = 0
  for (const [score, freq] of sorted) {
    cumulative += freq
    if (!scoresFor50 && cumulative >= total * 0.5) scoresFor50 = sorted.indexOf([score, freq]) + 1
    if (!scoresFor80 && cumulative >= total * 0.8) scoresFor80 = sorted.indexOf([score, freq]) + 1
  }

  // Redo more carefully
  cumulative = 0
  let count50 = 0, count80 = 0
  for (let i = 0; i < sorted.length; i++) {
    cumulative += sorted[i][1]
    if (!count50 && cumulative >= total * 0.5) count50 = i + 1
    if (!count80 && cumulative >= total * 0.8) count80 = i + 1
  }
  console.log(`  ${count50} unique scores account for 50% of all analyses`)
  console.log(`  ${count80} unique scores account for 80% of all analyses`)
  console.log(`  ${freqMap.size} unique scores used out of 101 possible (0-100)`)

  // 10. Adjacent score gaps — find the most "crowded" 5-point ranges
  console.log('\n--- HOTSPOT RANGES (5-point windows, most crowded) ---')
  const windows = []
  for (let start = 0; start <= 95; start++) {
    let windowTotal = 0
    for (let s = start; s <= start + 5 && s <= 100; s++) {
      windowTotal += freqMap.get(s) || 0
    }
    windows.push({ range: `${start}-${start + 5}`, total: windowTotal })
  }
  windows.sort((a, b) => b.total - a.total)
  for (let i = 0; i < 10; i++) {
    const w = windows[i]
    console.log(`  ${w.range.padStart(7)}: ${String(w.total).padStart(5)} analyses (${((w.total / total) * 100).toFixed(1)}%)`)
  }

  // 11. Same job, different scores — variance for repeat titles
  console.log('\n--- REPEAT JOB TITLE VARIANCE (top 20 most-analyzed jobs) ---')
  const varianceRes = await pool.query(`
    SELECT
      LOWER(TRIM(title)) AS norm_title,
      COUNT(*)::INTEGER AS analyses_count,
      AVG(score)::NUMERIC(5,1) AS avg_score,
      MIN(score) AS min_score,
      MAX(score) AS max_score,
      STDDEV(score)::NUMERIC(5,1) AS score_stddev,
      ARRAY_AGG(score ORDER BY created_at DESC) AS recent_scores
    FROM analyses
    WHERE ${FILTER}
    GROUP BY LOWER(TRIM(title))
    HAVING COUNT(*) >= 5
    ORDER BY COUNT(*) DESC
    LIMIT 20
  `)

  console.log('  Job Title'.padEnd(35) + ' | Count | Avg  | Min | Max | StdDev | Last 10 scores')
  console.log('  ' + '-'.repeat(95))
  for (const row of varianceRes.rows) {
    const title = row.norm_title.slice(0, 30).padEnd(30)
    const last10 = row.recent_scores.slice(0, 10).join(', ')
    console.log(`  ${title} | ${String(row.analyses_count).padStart(5)} | ${String(row.avg_score).padStart(4)} | ${String(row.min_score).padStart(3)} | ${String(row.max_score).padStart(3)} | ${String(row.score_stddev || '0').padStart(6)} | ${last10}`)
  }

  // 12. "Magnet number" detection — scores that appear far more than neighbors
  console.log('\n--- MAGNET NUMBER DETECTION (scores appearing 2x+ their neighbors avg) ---')
  for (let s = 2; s <= 98; s++) {
    const current = freqMap.get(s) || 0
    if (current === 0) continue
    const neighbors = [
      freqMap.get(s - 2) || 0,
      freqMap.get(s - 1) || 0,
      freqMap.get(s + 1) || 0,
      freqMap.get(s + 2) || 0,
    ]
    const neighborAvg = neighbors.reduce((a, b) => a + b, 0) / neighbors.length
    if (neighborAvg > 0 && current >= neighborAvg * 2) {
      const ratio = (current / neighborAvg).toFixed(1)
      console.log(`  Score ${String(s).padStart(3)}: ${String(current).padStart(4)} times (${ratio}x neighbor avg of ${neighborAvg.toFixed(0)})`)
    }
  }

  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
