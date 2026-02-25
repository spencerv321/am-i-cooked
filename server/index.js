import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env manually before any other imports touch process.env
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env')
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

// Now import everything else
const { default: express } = await import('express')
const { analyzeRoute } = await import('./api.js')

const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())

app.post('/api/analyze', analyzeRoute)

if (process.env.NODE_ENV === 'production') {
  const path = await import('path')
  app.use(express.static(path.resolve(__dirname, '..', 'dist')))
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'dist', 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
