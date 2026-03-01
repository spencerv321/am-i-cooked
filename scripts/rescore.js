/**
 * One-time rescore script for existing leaderboard entries.
 *
 * Queries all unique job titles with >= 3 analyses (leaderboard-eligible),
 * re-analyzes each with the updated SYSTEM_PROMPT, and inserts new analysis
 * rows. Does NOT modify or delete any existing rows — the new scores blend
 * in naturally via the leaderboard's AVG-based formula.
 *
 * Usage:
 *   node scripts/rescore.js                          # dry-run (shows what would be rescored)
 *   node scripts/rescore.js --execute                # actually run the rescore
 *   node scripts/rescore.js --execute --limit 5      # rescore only the first 5
 *
 * Requires DATABASE_URL env var (set on Railway, or pass inline):
 *   DATABASE_URL=postgres://... node scripts/rescore.js
 */

import 'dotenv/config'
import pg from 'pg'
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '../server/prompt.js'

const { Pool } = pg

// --- Config ---
const DRY_RUN = !process.argv.includes('--execute')
const LIMIT = (() => {
  const idx = process.argv.indexOf('--limit')
  return idx !== -1 ? parseInt(process.argv[idx + 1]) || Infinity : Infinity
})()
const DELAY_MS = 2500 // pause between API calls to avoid rate limits
const MODEL = 'claude-sonnet-4-20250514'

// --- Setup ---
function createDbPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL not set. Add it to .env or export it.')
    process.exit(1)
  }
  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 30000,
  })
}

function createApiClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY not set. Add it to .env or export it.')
    process.exit(1)
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function analyzeJob(client, title) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Job title: ${title}` }],
  })

  let text = message.content[0].text
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
  const data = JSON.parse(text)

  if (typeof data.score !== 'number' || !data.status) {
    throw new Error('Invalid response schema')
  }

  return data
}

// --- Main ---
async function main() {
  console.log('=== Am I Cooked — Rescore Script ===\n')
  console.log(`Mode:  ${DRY_RUN ? '🔍 DRY RUN (pass --execute to write to DB)' : '🔥 LIVE — will insert new analysis rows'}`)
  console.log(`Model: ${MODEL}`)
  console.log(`Delay: ${DELAY_MS}ms between API calls\n`)

  const pool = createDbPool()
  const apiClient = DRY_RUN ? null : createApiClient()

  try {
    // 1. Fetch leaderboard-eligible titles (>= 3 analyses)
    const { rows: titles } = await pool.query(`
      SELECT title,
             COUNT(*)::INTEGER AS analyses,
             ROUND(AVG(score))::INTEGER AS current_avg,
             MIN(score) AS min_score,
             MAX(score) AS max_score
      FROM analyses
      WHERE score IS NOT NULL
      GROUP BY title
      HAVING COUNT(*) >= 3
      ORDER BY COUNT(*) DESC
    `)

    console.log(`Found ${titles.length} leaderboard-eligible titles\n`)

    if (titles.length === 0) {
      console.log('Nothing to rescore.')
      return
    }

    // Show preview
    console.log('  Title                              Analyses  Avg   Min   Max')
    console.log('  ' + '─'.repeat(68))
    for (const t of titles.slice(0, LIMIT)) {
      console.log(
        `  ${t.title.padEnd(35).slice(0, 35)} ${String(t.analyses).padStart(5)}   ${String(t.current_avg).padStart(4)}  ${String(t.min_score).padStart(4)}  ${String(t.max_score).padStart(4)}`
      )
    }
    if (titles.length > LIMIT) {
      console.log(`  ... and ${titles.length - LIMIT} more (use --limit to control)`)
    }

    if (DRY_RUN) {
      console.log('\n🔍 Dry run complete. Pass --execute to actually rescore these titles.')
      return
    }

    // 2. Rescore each title
    console.log(`\n${'─'.repeat(60)}`)
    console.log('Starting rescore...\n')

    const results = []
    const toProcess = titles.slice(0, LIMIT)

    for (let i = 0; i < toProcess.length; i++) {
      const { title, current_avg } = toProcess[i]
      process.stdout.write(`[${i + 1}/${toProcess.length}] ${title}... `)

      try {
        const data = await analyzeJob(apiClient, title)
        const delta = data.score - current_avg
        const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '='
        console.log(`new=${data.score} (was avg ${current_avg}, ${arrow}${Math.abs(delta)}) [${data.status}]`)

        // Insert new analysis row
        await pool.query(`
          INSERT INTO analyses (date, title, score, tone, visitor_hash)
          VALUES (CURRENT_DATE, $1, $2, $3, $4)
        `, [title, data.score, 'rescore', 'rescore-script'])

        results.push({ title, oldAvg: current_avg, newScore: data.score, delta, status: data.status })
      } catch (err) {
        console.log(`ERROR: ${err.message}`)
        results.push({ title, oldAvg: current_avg, newScore: null, delta: null, status: 'ERROR' })
      }

      // Rate limit delay (skip after last item)
      if (i < toProcess.length - 1) {
        await sleep(DELAY_MS)
      }
    }

    // 3. Summary
    const succeeded = results.filter(r => r.newScore !== null)
    const failed = results.filter(r => r.newScore === null)

    console.log(`\n${'═'.repeat(60)}`)
    console.log('  RESCORE SUMMARY')
    console.log(`${'═'.repeat(60)}\n`)

    console.log(`  Processed: ${results.length}`)
    console.log(`  Succeeded: ${succeeded.length}`)
    console.log(`  Failed:    ${failed.length}`)

    if (succeeded.length > 0) {
      const avgDelta = succeeded.reduce((sum, r) => sum + r.delta, 0) / succeeded.length
      const biggestUp = succeeded.reduce((best, r) => r.delta > best.delta ? r : best)
      const biggestDown = succeeded.reduce((best, r) => r.delta < best.delta ? r : best)

      console.log(`\n  Avg score change: ${avgDelta >= 0 ? '+' : ''}${avgDelta.toFixed(1)}`)
      console.log(`  Biggest increase: ${biggestUp.title} (${biggestUp.oldAvg} → ${biggestUp.newScore}, +${biggestUp.delta})`)
      console.log(`  Biggest decrease: ${biggestDown.title} (${biggestDown.oldAvg} → ${biggestDown.newScore}, ${biggestDown.delta})`)

      // Distribution of new scores
      const newScores = succeeded.map(r => r.newScore)
      const buckets = {
        '0-20 (Raw)':         newScores.filter(s => s <= 20).length,
        '21-40 (Med Rare)':   newScores.filter(s => s >= 21 && s <= 40).length,
        '41-60 (Medium)':     newScores.filter(s => s >= 41 && s <= 60).length,
        '61-80 (Well Done)':  newScores.filter(s => s >= 61 && s <= 80).length,
        '81-100 (Cooked)':    newScores.filter(s => s >= 81).length,
      }

      console.log('\n  New score distribution:')
      for (const [bucket, count] of Object.entries(buckets)) {
        const bar = '█'.repeat(count)
        console.log(`    ${bucket.padEnd(22)} ${String(count).padStart(2)}  ${bar}`)
      }
    }

    if (failed.length > 0) {
      console.log('\n  Failed titles:')
      failed.forEach(r => console.log(`    - ${r.title}`))
    }

    console.log('')
  } finally {
    await pool.end()
  }
}

main().then(() => {
  process.exit(0)
}).catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
