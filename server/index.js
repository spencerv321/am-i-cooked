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

// Initialize database (falls back to in-memory if DATABASE_URL not set)
const pool = createPool()
const dbReady = await initDb(pool)
if (!dbReady) {
  console.warn('[analytics] Running in memory-only mode')
}
const tracker = new Analytics(dbReady ? pool : null)

const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())

// Analytics middleware — track page views before routes
app.use(analyticsMiddleware(tracker))

// Stats endpoints (token-protected)
const stats = createStatsRoutes(tracker)
app.get('/api/stats', stats.auth, stats.stats)
app.get('/api/stats/live', stats.auth, stats.live)
app.get('/api/stats/jobs', stats.auth, stats.jobs)

app.post('/api/analyze', createAnalyzeRoute(tracker))

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
