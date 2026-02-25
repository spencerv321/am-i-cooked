#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env from project root
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    const val = trimmed.slice(eq + 1)
    if (!process.env[key]) process.env[key] = val
  }
}

const BASE_URL = process.env.ANALYTICS_URL || 'https://amicooked.io'
const TOKEN = process.env.ANALYTICS_TOKEN

if (!TOKEN) {
  console.error('Missing ANALYTICS_TOKEN in .env or environment')
  process.exit(1)
}

const headers = { Authorization: `Bearer ${TOKEN}` }

async function fetchJSON(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body}`)
  }
  return res.json()
}

function pad(str, len) {
  return String(str).padEnd(len)
}

function rpad(str, len) {
  return String(str).padStart(len)
}

function formatDate(isoString) {
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateTime(isoString) {
  const d = new Date(isoString)
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function num(n) {
  return n.toLocaleString()
}

// ── Commands ──

async function showDashboard() {
  const data = await fetchJSON('/api/stats')

  console.log()
  console.log('  ═══════════════════════════════════════')
  console.log('    AM I COOKED? — Live Analytics')
  console.log(`    ${formatDateTime(data.generated_at)}`)
  console.log('  ═══════════════════════════════════════')
  console.log()
  console.log(`    LIVE NOW:  ${data.realtime.active_visitors} active visitor${data.realtime.active_visitors !== 1 ? 's' : ''}`)
  console.log()
  console.log(`    TODAY (${formatDate(data.today.date)}):`)
  console.log(`      Page Views ···· ${num(data.today.page_views)}`)
  console.log(`      Uniques ······· ${num(data.today.unique_visitors)}`)
  console.log(`      Analyses ······ ${num(data.today.api_calls)}`)
  console.log()

  if (data.today.top_jobs.length > 0) {
    console.log('    TOP JOBS TODAY:')
    data.today.top_jobs.slice(0, 10).forEach((job, i) => {
      console.log(`      ${rpad(i + 1, 2)}. ${pad(job.title, 28)} ${rpad(job.count, 4)}`)
    })
    console.log()
  }

  console.log(`    ALL TIME (since ${formatDate(data.lifetime.tracking_since)}):`)
  console.log(`      Page Views ···· ${num(data.lifetime.total_page_views)}`)
  console.log(`      Analyses ······ ${num(data.lifetime.total_api_calls)}`)

  if (data.daily_history.length > 1) {
    console.log()
    console.log('    DAILY HISTORY:')
    data.daily_history.forEach((day) => {
      console.log(`      ${day.date}  ${rpad(day.page_views, 5)} views  ${rpad(day.unique_visitors, 5)} uniques  ${rpad(day.api_calls, 5)} analyses`)
    })
  }

  console.log()
  console.log('  ═══════════════════════════════════════')
  console.log()
}

async function showLive() {
  const data = await fetchJSON('/api/stats/live')
  console.log()
  console.log(`  Active visitors: ${data.active_visitors}`)
  console.log(`  Server time:     ${formatDateTime(data.server_time)}`)
  console.log()
}

async function showJobs() {
  const args = process.argv.slice(3)
  let period = 'today'
  let limit = 20

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--period' && args[i + 1]) period = args[++i]
    if (args[i] === '--limit' && args[i + 1]) limit = parseInt(args[++i])
  }

  const data = await fetchJSON(`/api/stats/jobs?period=${period}&limit=${limit}`)

  console.log()
  console.log(`  TOP JOBS (${period}) — ${data.total_analyses} total analyses`)
  console.log('  ─────────────────────────────────────')

  if (data.titles.length === 0) {
    console.log('  No data yet.')
  } else {
    data.titles.forEach((job, i) => {
      console.log(`  ${rpad(i + 1, 3)}. ${pad(job.title, 30)} ${rpad(job.count, 4)}  (${job.pct}%)`)
    })
  }
  console.log()
}

async function watchLive() {
  console.log()
  console.log('  Watching live visitors (Ctrl+C to stop)...')
  console.log()

  let prev = null
  const poll = async () => {
    try {
      const data = await fetchJSON('/api/stats/live')
      const now = new Date().toLocaleTimeString('en-US', { hour12: false })
      const count = data.active_visitors
      const delta = prev !== null ? count - prev : 0
      const deltaStr = delta > 0 ? `  (+${delta})` : delta < 0 ? `  (${delta})` : ''
      console.log(`  ${now}  Active: ${count}${deltaStr}`)
      prev = count
    } catch (err) {
      console.log(`  Error: ${err.message}`)
    }
  }

  await poll()
  setInterval(poll, 5000)
}

// ── Main ──

const command = process.argv[2] || 'dashboard'

try {
  switch (command) {
    case 'dashboard':
    case 'dash':
      await showDashboard()
      break
    case 'live':
      await showLive()
      break
    case 'jobs':
      await showJobs()
      break
    case 'watch':
      await watchLive()
      break
    default:
      console.log('Usage: node scripts/stats.js [dashboard|live|jobs|watch]')
      console.log()
      console.log('  dashboard   Full analytics summary (default)')
      console.log('  live        Current active visitor count')
      console.log('  jobs        Top job titles searched')
      console.log('  watch       Live visitor count, polling every 5s')
      console.log()
      console.log('  jobs flags: --period today|all  --limit 20')
  }
} catch (err) {
  console.error('Error:', err.message)
  process.exit(1)
}
