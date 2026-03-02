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
 * Requires DATABASE_URL and ANTHROPIC_API_KEY env vars:
 *   DATABASE_URL=postgres://... ANTHROPIC_API_KEY=sk-... node scripts/seed-seo.js --execute
 */

import 'dotenv/config'
import pg from 'pg'
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '../server/prompt.js'
import { slugify } from '../server/seo.js'

const { Pool } = pg

// --- Config ---
const DRY_RUN = !process.argv.includes('--execute')
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

  if (typeof data.score !== 'number' || !data.status) {
    throw new Error('Invalid response schema')
  }

  return data
}

// --- Main ---
async function main() {
  console.log('=== Am I Cooked — SEO Page Seed Script ===\n')
  console.log(`Mode:  ${DRY_RUN ? '🔍 DRY RUN (pass --execute to generate pages)' : '🔥 LIVE — will generate and insert SEO pages'}`)
  console.log(`Model: ${MODEL}`)
  console.log(`Delay: ${DELAY_MS}ms between API calls`)
  console.log(`Jobs:  ${SEED_JOBS.length} total\n`)

  const pool = createDbPool()
  const apiClient = DRY_RUN ? null : createApiClient()

  try {
    // Ensure seo_pages table exists
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
      return
    }

    // Preview
    console.log('\n  Slug                                         Title')
    console.log('  ' + '─'.repeat(70))
    for (const j of toProcess.slice(0, 20)) {
      console.log(`  ${j.slug.padEnd(45).slice(0, 45)} ${j.title}`)
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
        console.log(`score=${data.score} [${data.status}]`)

        // Insert into seo_pages
        await pool.query(`
          INSERT INTO seo_pages (slug, title, analysis_json, score, status)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (slug) DO UPDATE SET
            title = $2, analysis_json = $3, score = $4, status = $5, generated_at = NOW()
        `, [slug, title, JSON.stringify(data), data.score, data.status])

        results.push({ title, slug, score: data.score, status: data.status })
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
