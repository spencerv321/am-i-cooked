import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env file if it exists (local dev only — Railway sets env vars natively)
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env')
if (existsSync(envPath)) {
  try {
    const envFile = readFileSync(envPath, 'utf-8')
    for (const line of envFile.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue
      const key = trimmed.slice(0, eqIndex)
      const value = trimmed.slice(eqIndex + 1)
      if (!process.env[key]) process.env[key] = value
    }
  } catch {}
}

// Now import everything else
const { default: express } = await import('express')
const { createAnalyzeRoute } = await import('./api.js')
const { Analytics } = await import('./analytics/tracker.js')
const { createPool, initDb } = await import('./analytics/db.js')
const { analyticsMiddleware } = await import('./analytics/middleware.js')
const { createStatsRoutes } = await import('./analytics/routes.js')
const { addClient, sendSeed } = await import('./analytics/livefeed.js')
const { sharePageHandler, ogImageHandler, comparePageHandler, compareOgImageHandler } = await import('./share.js')

// Initialize database (falls back to in-memory if DATABASE_URL not set)
const pool = createPool()
const dbReady = await initDb(pool)
if (!dbReady) {
  console.warn('[analytics] Running in memory-only mode')
}
const tracker = new Analytics(dbReady ? pool : null)

const { default: cors } = await import('cors')

const app = express()
const PORT = process.env.PORT || 3001

// Railway runs behind a reverse proxy — trust only the first proxy hop
app.set('trust proxy', 1)

// CORS — only allow requests from our own domain (and localhost for dev)
app.use(cors({
  origin: [
    'https://amicooked.io',
    'https://www.amicooked.io',
    ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173', 'http://localhost:3001'] : []),
  ],
}))

app.use(express.json({ limit: '10kb' }))

// Analytics middleware — track page views before routes
app.use(analyticsMiddleware(tracker))

// Stats endpoints (token-protected)
const stats = createStatsRoutes(tracker)
app.get('/api/stats', stats.auth, stats.stats)
app.get('/api/stats/live', stats.auth, stats.live)
app.get('/api/stats/jobs', stats.auth, stats.jobs)
app.get('/api/stats/referrers', stats.auth, stats.referrers)
app.get('/api/stats/visitors', stats.auth, stats.visitors)
app.get('/api/stats/hourly', stats.auth, stats.hourly)
app.get('/api/stats/tones', stats.auth, stats.tones)

// Public endpoints — no auth
app.get('/api/count', stats.count)
app.get('/api/leaderboard', stats.leaderboard)
app.post('/api/event', stats.event)

// Live feed SSE — public, no auth
app.get('/api/live-feed', async (req, res) => {
  const recent = await tracker.getRecentAnalyses(10)
  const connected = addClient(req, res)
  if (connected && recent.length > 0) {
    sendSeed(res, recent)
  }
})

// Auth-protected event stats
app.get('/api/stats/events', stats.auth, stats.events)
app.get('/api/stats/scores', stats.auth, stats.scores)
app.get('/api/stats/score-trend', stats.auth, stats.scoreTrend)
app.get('/api/stats/day/:date', stats.auth, stats.dayBreakdown)
app.get('/api/stats/referrer-trend', stats.auth, stats.referrerTrend)

app.post('/api/analyze', createAnalyzeRoute(tracker))

// Dashboard — standalone HTML, read once at startup
const dashPath = resolve(__dirname, 'dashboard.html')
const dashHtml = existsSync(dashPath) ? readFileSync(dashPath, 'utf-8') : null
if (dashHtml) {
  app.get('/dash', (req, res) => {
    res.set('Cache-Control', 'no-store')
    res.type('html').send(dashHtml)
  })
}

// Share card routes — MUST be before static/catch-all
app.get('/r/:title/:score/:status', sharePageHandler)
app.get('/c/:title1/:score1/:status1/vs/:title2/:score2/:status2', comparePageHandler)
app.get('/api/og/compare', compareOgImageHandler)
app.get('/api/og', ogImageHandler)

// Serve static build if dist/ exists (production)
const distPath = resolve(__dirname, '..', 'dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('/{*splat}', (req, res) => {
    res.sendFile(resolve(distPath, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
