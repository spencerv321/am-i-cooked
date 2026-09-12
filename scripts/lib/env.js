// Load .env for scripts run from the repo root.
// Manual parse rather than `import 'dotenv/config'` — see CLAUDE.md "What NOT to Do" #7.
// Also maps DATABASE_PUBLIC_URL → DATABASE_URL so scripts run locally without
// pasting the Railway public URL inline every time.

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

export function loadEnv() {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq === -1) continue
      const k = t.slice(0, eq).trim()
      const v = t.slice(eq + 1).trim()
      if (!process.env[k]) process.env[k] = v
    }
  }
  if (!process.env.DATABASE_URL && process.env.DATABASE_PUBLIC_URL) {
    process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL
  }
}
