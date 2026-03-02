import pg from 'pg'
const { Pool } = pg

export function createPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.warn('[analytics] DATABASE_URL not set — running in memory-only mode')
    return null
  }

  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
  })
}

export async function initDb(pool) {
  if (!pool) return false

  try {
    await pool.query('SELECT 1')

    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        date        DATE PRIMARY KEY,
        page_views  INTEGER NOT NULL DEFAULT 0,
        unique_ips  TEXT[] NOT NULL DEFAULT '{}',
        api_calls   INTEGER NOT NULL DEFAULT 0
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS job_titles (
        id          SERIAL PRIMARY KEY,
        date        DATE NOT NULL,
        title       TEXT NOT NULL,
        count       INTEGER NOT NULL DEFAULT 0,
        UNIQUE(date, title)
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS analyses (
        id          SERIAL PRIMARY KEY,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date        DATE NOT NULL DEFAULT CURRENT_DATE,
        title       TEXT NOT NULL,
        score       INTEGER,
        tone        TEXT,
        visitor_hash TEXT
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS referrers (
        id          SERIAL PRIMARY KEY,
        date        DATE NOT NULL,
        source      TEXT NOT NULL,
        count       INTEGER NOT NULL DEFAULT 0,
        UNIQUE(date, source)
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id          SERIAL PRIMARY KEY,
        date        DATE NOT NULL DEFAULT CURRENT_DATE,
        action      TEXT NOT NULL,
        count       INTEGER NOT NULL DEFAULT 0,
        UNIQUE(date, action)
      )
    `)

    // Add visitor_hash column if it doesn't exist (migration for existing DBs)
    await pool.query(`
      ALTER TABLE analyses ADD COLUMN IF NOT EXISTS visitor_hash TEXT
    `)

    // Add peak_active column to daily_stats (migration for existing DBs)
    await pool.query(`
      ALTER TABLE daily_stats ADD COLUMN IF NOT EXISTS peak_active INTEGER NOT NULL DEFAULT 0
    `)

    // Create referrers table index for fast lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_referrers_date ON referrers(date)
    `)

    // Index for hourly analysis queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at)
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS analytics_meta (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL
      )
    `)

    await pool.query(`
      INSERT INTO analytics_meta (key, value)
      VALUES ('tracking_since', NOW()::TEXT)
      ON CONFLICT (key) DO NOTHING
    `)

    // SEO job pages — cached server-rendered pages for organic search traffic
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
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_seo_pages_slug ON seo_pages(slug)
    `)

    console.log('[analytics] Database initialized')
    return true
  } catch (err) {
    console.error('[analytics] Database init failed:', err.message)
    return false
  }
}
