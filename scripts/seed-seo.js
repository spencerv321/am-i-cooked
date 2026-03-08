/**
 * Seed script for SEO job pages.
 *
 * Generates analysis for ~100 common job titles and caches them in the
 * seo_pages table. Pages are then served at /jobs/:slug for organic search.
 *
 * Usage:
 *   node scripts/seed-seo.js                          # dry-run (shows what would be generated)
 *   node scripts/seed-seo.js --execute                # actually generate all
 *   node scripts/seed-seo.js --execute --limit 10     # generate first 10 only
 *
 *   # Rescore / backfill: regenerate pages missing dimensions or category
 *   node scripts/seed-seo.js --rescore                # dry-run (shows stale pages)
 *   node scripts/seed-seo.js --rescore --execute      # actually regenerate stale pages
 *
 * Requires DATABASE_URL and ANTHROPIC_API_KEY env vars:
 *   DATABASE_URL=postgres://... ANTHROPIC_API_KEY=sk-... node scripts/seed-seo.js --execute
 */

import 'dotenv/config'
import pg from 'pg'
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '../server/prompt.js'
import { slugify, getCategoryForJob } from '../server/seo.js'
import { computeScore, scoreToStatus, validateDimensions } from '../server/scoring.js'

const { Pool } = pg

// --- Config ---
const DRY_RUN = !process.argv.includes('--execute')
const RESCORE = process.argv.includes('--rescore')
const LIMIT = (() => {
  const idx = process.argv.indexOf('--limit')
  return idx !== -1 ? parseInt(process.argv[idx + 1]) || Infinity : Infinity
})()
const DELAY_MS = 2500 // pause between API calls to avoid rate limits
const MODEL = 'claude-sonnet-4-20250514'

// --- Job titles to seed ---
const SEED_JOBS = [
  // Tech
  'Software Engineer', 'Data Scientist', 'Web Developer', 'DevOps Engineer',
  'Product Manager', 'UX Designer', 'QA Tester', 'Systems Administrator',
  'Database Administrator', 'Network Engineer', 'Cybersecurity Analyst',
  'Machine Learning Engineer', 'Frontend Developer', 'Backend Developer',
  'Mobile App Developer', 'Cloud Architect', 'Technical Writer',
  'IT Support Specialist', 'Data Analyst', 'Business Intelligence Analyst',

  // Business & Finance
  'Accountant', 'Financial Analyst', 'Investment Banker', 'Tax Preparer',
  'Bookkeeper', 'Auditor', 'Insurance Underwriter', 'Loan Officer',
  'Financial Advisor', 'Actuary', 'Real Estate Agent', 'Stockbroker',

  // Healthcare
  'Nurse', 'Doctor', 'Surgeon', 'Dentist', 'Pharmacist', 'Physical Therapist',
  'Radiologist', 'Medical Technologist', 'Veterinarian', 'Paramedic',
  'Psychologist', 'Therapist', 'Optometrist', 'Anesthesiologist',

  // Legal
  'Lawyer', 'Paralegal', 'Legal Secretary', 'Judge', 'Court Reporter',

  // Education
  'Teacher', 'Professor', 'Tutor', 'School Counselor', 'Librarian',
  'Curriculum Developer', 'Special Education Teacher',

  // Creative
  'Graphic Designer', 'Photographer', 'Videographer', 'Animator',
  'Copywriter', 'Content Writer', 'Journalist', 'Editor',
  'Music Producer', 'Actor', 'Interior Designer', 'Fashion Designer',

  // Trades & Labor
  'Electrician', 'Plumber', 'Carpenter', 'Welder', 'HVAC Technician',
  'Auto Mechanic', 'Construction Worker', 'Landscaper', 'Painter',
  'Roofer', 'Mason',

  // Service
  'Chef', 'Bartender', 'Waiter', 'Barista', 'Hotel Manager',
  'Flight Attendant', 'Travel Agent', 'Hair Stylist', 'Personal Trainer',

  // Transportation
  'Truck Driver', 'Pilot', 'Bus Driver', 'Uber Driver', 'Delivery Driver',

  // Office & Admin
  'Executive Assistant', 'Receptionist', 'Data Entry Clerk',
  'Customer Service Representative', 'Call Center Agent',
  'Human Resources Manager', 'Recruiter', 'Office Manager',

  // Other
  'Firefighter', 'Police Officer', 'Social Worker', 'Translator',
  'Architect', 'Civil Engineer', 'Mechanical Engineer', 'Electrical Engineer',
  'Environmental Scientist', 'Urban Planner', 'Supply Chain Manager',
  'Marketing Manager', 'Sales Representative', 'Public Relations Specialist',
]

// --- Setup ---
function createDbPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL not set. Pass it inline or add to .env.')
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

  // Validate dimensions and compute score server-side
  const dimCheck = validateDimensions(data.dimensions)
  if (!dimCheck.valid) {
    throw new Error(`Invalid dimensions: ${dimCheck.error}`)
  }
  data.score = computeScore(data.dimensions)
  data.status = scoreToStatus(data.score)

  return data
}

// --- Rescore mode: find stale pages and regenerate them ---
async function runRescore(pool, apiClient) {
  console.log('\n--- RESCORE MODE ---')
  console.log('Finding pages missing dimensions or category...\n')

  // Ensure category column exists
  await pool.query(`ALTER TABLE seo_pages ADD COLUMN IF NOT EXISTS category TEXT`)

  const { rows: allPages } = await pool.query(
    'SELECT slug, title, analysis_json, category FROM seo_pages ORDER BY slug'
  )

  // Identify stale pages: missing dimensions OR missing category
  const stalePages = allPages.filter(row => {
    try {
      const analysis = JSON.parse(row.analysis_json)
      const hasDimensions = analysis.dimensions &&
        typeof analysis.dimensions === 'object' &&
        Object.keys(analysis.dimensions).length === 6
      const hasCategory = !!row.category
      return !hasDimensions || !hasCategory
    } catch {
      return true // malformed JSON = stale
    }
  }).slice(0, LIMIT)

  console.log(`Total pages in DB:  ${allPages.length}`)
  console.log(`Stale (no dims/cat): ${stalePages.length}`)

  if (stalePages.length === 0) {
    console.log('\n✅ All pages have dimensions and category. Nothing to rescore.')
    return
  }

  console.log('\n  Slug                                         Reason')
  console.log('  ' + '─'.repeat(70))
  for (const p of stalePages.slice(0, 20)) {
    let analysis
    try { analysis = JSON.parse(p.analysis_json) } catch { analysis = {} }
    const reason = !analysis.dimensions ? 'no dimensions (v1 page)' : 'no category'
    console.log(`  ${p.slug.padEnd(45).slice(0, 45)} ${reason}`)
  }
  if (stalePages.length > 20) {
    console.log(`  ... and ${stalePages.length - 20} more`)
  }

  if (DRY_RUN) {
    console.log('\n🔍 Dry run. Pass --execute to regenerate these pages.')
    return
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log('Regenerating stale pages...\n')

  const results = []

  for (let i = 0; i < stalePages.length; i++) {
    const { slug, title } = stalePages[i]
    process.stdout.write(`[${i + 1}/${stalePages.length}] ${title} (${slug})... `)

    try {
      const data = await analyzeJob(apiClient, title)
      const category = getCategoryForJob(title)

      await pool.query(`
        INSERT INTO seo_pages (slug, title, analysis_json, score, status, category)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (slug) DO UPDATE SET
          title = $2, analysis_json = $3, score = $4, status = $5, category = $6,
          generated_at = NOW()
      `, [slug, title, JSON.stringify(data), data.score, data.status, category])

      console.log(`score=${data.score} [${data.status}] cat=${category}`)
      results.push({ title, slug, score: data.score, status: data.status, category })
    } catch (err) {
      console.log(`ERROR: ${err.message}`)
      results.push({ title, slug, score: null, status: 'ERROR' })
    }

    if (i < stalePages.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  const succeeded = results.filter(r => r.score !== null)
  const failed = results.filter(r => r.score === null)

  console.log(`\n${'═'.repeat(60)}`)
  console.log('  RESCORE SUMMARY')
  console.log(`${'═'.repeat(60)}\n`)
  console.log(`  Processed: ${results.length}`)
  console.log(`  Succeeded: ${succeeded.length}`)
  console.log(`  Failed:    ${failed.length}`)

  if (failed.length > 0) {
    console.log('\n  Failed titles:')
    failed.forEach(r => console.log(`    - ${r.title}`))
  }
}

// --- Main seed mode ---
async function main() {
  console.log('=== Am I Cooked — SEO Page Seed Script ===\n')

  if (RESCORE) {
    console.log(`Mode:  ${DRY_RUN ? '🔍 DRY RUN — rescore' : '🔥 LIVE — rescore stale pages'}`)
  } else {
    console.log(`Mode:  ${DRY_RUN ? '🔍 DRY RUN (pass --execute to generate pages)' : '🔥 LIVE — will generate and insert SEO pages'}`)
  }
  console.log(`Model: ${MODEL}`)
  console.log(`Delay: ${DELAY_MS}ms between API calls`)
  console.log(`Jobs:  ${SEED_JOBS.length} total\n`)

  const pool = createDbPool()
  const apiClient = (DRY_RUN && !RESCORE) ? null : createApiClient()

  try {
    // Ensure seo_pages table exists with category column
    await pool.query(`
      CREATE TABLE IF NOT EXISTS seo_pages (
        id            SERIAL PRIMARY KEY,
        slug          TEXT NOT NULL UNIQUE,
        title         TEXT NOT NULL,
        analysis_json TEXT NOT NULL,
        score         INTEGER NOT NULL,
        status        TEXT NOT NULL,
        generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await pool.query(`ALTER TABLE seo_pages ADD COLUMN IF NOT EXISTS category TEXT`)

    if (RESCORE) {
      await runRescore(pool, apiClient)
      return
    }

    // Check which slugs already exist
    const { rows: existing } = await pool.query('SELECT slug FROM seo_pages')
    const existingSlugs = new Set(existing.map(r => r.slug))

    // Build list of jobs to process
    const toProcess = SEED_JOBS
      .map(title => ({ title, slug: slugify(title) }))
      .filter(j => !existingSlugs.has(j.slug))
      .slice(0, LIMIT)

    const skipped = SEED_JOBS.length - toProcess.length - (SEED_JOBS.length - Math.min(SEED_JOBS.length, LIMIT))
    console.log(`Already cached: ${existingSlugs.size} pages`)
    console.log(`To generate:    ${toProcess.length} pages`)
    if (skipped > 0) console.log(`Skipping:       ${skipped} (already exist)`)

    if (toProcess.length === 0) {
      console.log('\n✅ All jobs already have cached pages. Nothing to do.')
      console.log('   (Run with --rescore to regenerate stale pages.)')
      return
    }

    // Preview
    console.log('\n  Slug                                         Title                    Category')
    console.log('  ' + '─'.repeat(80))
    for (const j of toProcess.slice(0, 20)) {
      const cat = getCategoryForJob(j.title)
      console.log(`  ${j.slug.padEnd(45).slice(0, 45)} ${j.title.padEnd(25).slice(0, 25)} ${cat}`)
    }
    if (toProcess.length > 20) {
      console.log(`  ... and ${toProcess.length - 20} more`)
    }

    if (DRY_RUN) {
      console.log('\n🔍 Dry run complete. Pass --execute to actually generate these pages.')
      return
    }

    // Generate pages
    console.log(`\n${'─'.repeat(60)}`)
    console.log('Starting generation...\n')

    const results = []

    for (let i = 0; i < toProcess.length; i++) {
      const { title, slug } = toProcess[i]
      process.stdout.write(`[${i + 1}/${toProcess.length}] ${title} (${slug})... `)

      try {
        const data = await analyzeJob(apiClient, title)
        const category = getCategoryForJob(title)
        console.log(`score=${data.score} [${data.status}] cat=${category}`)

        // Insert into seo_pages (with category)
        await pool.query(`
          INSERT INTO seo_pages (slug, title, analysis_json, score, status, category)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (slug) DO UPDATE SET
            title = $2, analysis_json = $3, score = $4, status = $5, category = $6,
            generated_at = NOW()
        `, [slug, title, JSON.stringify(data), data.score, data.status, category])

        results.push({ title, slug, score: data.score, status: data.status, category })
      } catch (err) {
        console.log(`ERROR: ${err.message}`)
        results.push({ title, slug, score: null, status: 'ERROR' })
      }

      // Rate limit delay (skip after last item)
      if (i < toProcess.length - 1) {
        await sleep(DELAY_MS)
      }
    }

    // Summary
    const succeeded = results.filter(r => r.score !== null)
    const failed = results.filter(r => r.score === null)

    console.log(`\n${'═'.repeat(60)}`)
    console.log('  SEO SEED SUMMARY')
    console.log(`${'═'.repeat(60)}\n`)

    console.log(`  Processed: ${results.length}`)
    console.log(`  Succeeded: ${succeeded.length}`)
    console.log(`  Failed:    ${failed.length}`)

    if (succeeded.length > 0) {
      const avgScore = Math.round(succeeded.reduce((s, r) => s + r.score, 0) / succeeded.length)
      console.log(`  Avg score: ${avgScore}`)

      // Distribution of scores
      const buckets = {
        '0-20 (Raw)':         succeeded.filter(r => r.score <= 20).length,
        '21-40 (Med Rare)':   succeeded.filter(r => r.score >= 21 && r.score <= 40).length,
        '41-60 (Medium)':     succeeded.filter(r => r.score >= 41 && r.score <= 60).length,
        '61-80 (Well Done)':  succeeded.filter(r => r.score >= 61 && r.score <= 80).length,
        '81-100 (Cooked)':    succeeded.filter(r => r.score >= 81).length,
      }

      console.log('\n  Score distribution:')
      for (const [bucket, count] of Object.entries(buckets)) {
        const bar = '█'.repeat(count)
        console.log(`    ${bucket.padEnd(22)} ${String(count).padStart(2)}  ${bar}`)
      }

      // Total pages now
      const { rows: [{ count: totalPages }] } = await pool.query('SELECT COUNT(*)::INTEGER AS count FROM seo_pages')
      console.log(`\n  Total SEO pages now: ${totalPages}`)
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
