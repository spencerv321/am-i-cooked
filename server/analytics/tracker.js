import { createHash } from 'crypto'

const ACTIVE_VISITOR_TTL = 5 * 60 * 1000 // 5 minutes
const PRUNE_INTERVAL = 60 * 1000 // 1 minute

export class Analytics {
  constructor(pool) {
    this.pool = pool
    this.activeVisitors = new Map()
    this.salt = process.env.ANALYTICS_SALT || 'am-i-cooked-default-salt'

    // In-memory fallback stores (used when pool is null / DB unavailable)
    this._memDailyStats = new Map()
    this._memLifetime = {
      totalPageViews: 0,
      totalApiCalls: 0,
      topJobTitles: new Map(),
      startedAt: new Date().toISOString(),
    }

    // Prune expired active visitors every minute
    this._pruneInterval = setInterval(() => this._pruneActiveVisitors(), PRUNE_INTERVAL)
    this._pruneInterval.unref()
  }

  _hashIP(ip) {
    return createHash('sha256').update(ip + this.salt).digest('hex').slice(0, 16)
  }

  _todayKey() {
    return new Date().toISOString().slice(0, 10)
  }

  // ── In-memory fallback helpers ──

  _getMemDayStats(dateKey) {
    if (!this._memDailyStats.has(dateKey)) {
      this._memDailyStats.set(dateKey, {
        pageViews: 0,
        uniqueVisitors: new Set(),
        apiCalls: 0,
        jobTitles: new Map(),
      })
    }
    return this._memDailyStats.get(dateKey)
  }

  _memTopJobs(jobMap, limit = 10) {
    return [...jobMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([title, count]) => ({ title, count }))
  }

  // ── Recording methods (fire-and-forget DB writes) ──

  recordPageView(ip, path) {
    const hashed = this._hashIP(ip)

    // Always track active visitors in memory (real-time)
    this.activeVisitors.set(hashed, { lastSeen: Date.now(), path })

    if (this.pool) {
      this.pool.query(`
        INSERT INTO daily_stats (date, page_views, unique_ips)
        VALUES (CURRENT_DATE, 1, ARRAY[$1])
        ON CONFLICT (date) DO UPDATE SET
          page_views = daily_stats.page_views + 1,
          unique_ips = CASE
            WHEN $1 = ANY(daily_stats.unique_ips) THEN daily_stats.unique_ips
            ELSE array_append(daily_stats.unique_ips, $1)
          END
      `, [hashed]).catch(err => {
        console.error('[analytics] pageview write failed:', err.message)
      })
    } else {
      const today = this._getMemDayStats(this._todayKey())
      today.pageViews++
      today.uniqueVisitors.add(hashed)
      this._memLifetime.totalPageViews++
    }
  }

  recordApiCall(ip, jobTitle) {
    const title = jobTitle.toLowerCase().trim()

    if (this.pool) {
      // Increment api_calls (upsert in case this is the first event of the day)
      this.pool.query(`
        INSERT INTO daily_stats (date, api_calls)
        VALUES (CURRENT_DATE, 1)
        ON CONFLICT (date) DO UPDATE SET
          api_calls = daily_stats.api_calls + 1
      `).catch(err => {
        console.error('[analytics] api_call write failed:', err.message)
      })

      // Upsert job title count
      this.pool.query(`
        INSERT INTO job_titles (date, title, count)
        VALUES (CURRENT_DATE, $1, 1)
        ON CONFLICT (date, title) DO UPDATE SET
          count = job_titles.count + 1
      `, [title]).catch(err => {
        console.error('[analytics] job_title write failed:', err.message)
      })
    } else {
      const today = this._getMemDayStats(this._todayKey())
      today.apiCalls++
      today.jobTitles.set(title, (today.jobTitles.get(title) || 0) + 1)
      this._memLifetime.totalApiCalls++
      this._memLifetime.topJobTitles.set(
        title,
        (this._memLifetime.topJobTitles.get(title) || 0) + 1
      )
    }
  }

  // ── Pruning (always in-memory) ──

  _pruneActiveVisitors() {
    const cutoff = Date.now() - ACTIVE_VISITOR_TTL
    for (const [key, entry] of this.activeVisitors) {
      if (entry.lastSeen < cutoff) {
        this.activeVisitors.delete(key)
      }
    }
  }

  // ── Read methods ──

  async getStats() {
    if (!this.pool) return this._getMemStats()

    try {
      const [todayResult, historyResult, todayJobsResult, lifetimeResult, metaResult] = await Promise.all([
        this.pool.query(`
          SELECT page_views, array_length(unique_ips, 1) AS unique_visitors, api_calls
          FROM daily_stats WHERE date = CURRENT_DATE
        `),
        this.pool.query(`
          SELECT date, page_views, array_length(unique_ips, 1) AS unique_visitors, api_calls
          FROM daily_stats ORDER BY date ASC
        `),
        this.pool.query(`
          SELECT title, count FROM job_titles
          WHERE date = CURRENT_DATE
          ORDER BY count DESC LIMIT 10
        `),
        this.pool.query(`
          SELECT COALESCE(SUM(page_views), 0) AS total_page_views,
                 COALESCE(SUM(api_calls), 0) AS total_api_calls
          FROM daily_stats
        `),
        this.pool.query(`
          SELECT value FROM analytics_meta WHERE key = 'tracking_since'
        `),
      ])

      const lifetimeJobsResult = await this.pool.query(`
        SELECT title, SUM(count)::INTEGER AS count FROM job_titles
        GROUP BY title ORDER BY count DESC LIMIT 20
      `)

      const today = todayResult.rows[0] || { page_views: 0, unique_visitors: 0, api_calls: 0 }
      const lifetime = lifetimeResult.rows[0]
      const trackingSince = metaResult.rows[0]?.value || new Date().toISOString()

      return {
        generated_at: new Date().toISOString(),
        realtime: {
          active_visitors: this.activeVisitors.size,
        },
        today: {
          date: this._todayKey(),
          page_views: today.page_views || 0,
          unique_visitors: today.unique_visitors || 0,
          api_calls: today.api_calls || 0,
          top_jobs: todayJobsResult.rows.map(r => ({ title: r.title, count: r.count })),
        },
        lifetime: {
          total_page_views: parseInt(lifetime.total_page_views) || 0,
          total_api_calls: parseInt(lifetime.total_api_calls) || 0,
          top_jobs: lifetimeJobsResult.rows.map(r => ({ title: r.title, count: r.count })),
          tracking_since: trackingSince,
        },
        daily_history: historyResult.rows.map(r => ({
          date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
          page_views: r.page_views,
          unique_visitors: r.unique_visitors || 0,
          api_calls: r.api_calls,
        })),
      }
    } catch (err) {
      console.error('[analytics] getStats query failed:', err.message)
      return this._getMemStats()
    }
  }

  getLiveStats() {
    return {
      active_visitors: this.activeVisitors.size,
      server_time: new Date().toISOString(),
    }
  }

  async getJobStats(period = 'today', limit = 20) {
    if (!this.pool) return this._getMemJobStats(period, limit)

    try {
      let titlesResult, totalCalls

      if (period === 'all') {
        const [jobs, totals] = await Promise.all([
          this.pool.query(`
            SELECT title, SUM(count)::INTEGER AS count FROM job_titles
            GROUP BY title ORDER BY count DESC LIMIT $1
          `, [limit]),
          this.pool.query(`SELECT COALESCE(SUM(api_calls), 0) AS total FROM daily_stats`),
        ])
        titlesResult = jobs.rows
        totalCalls = parseInt(totals.rows[0].total) || 0
      } else {
        const [jobs, totals] = await Promise.all([
          this.pool.query(`
            SELECT title, count FROM job_titles
            WHERE date = CURRENT_DATE ORDER BY count DESC LIMIT $1
          `, [limit]),
          this.pool.query(`SELECT COALESCE(api_calls, 0) AS total FROM daily_stats WHERE date = CURRENT_DATE`),
        ])
        titlesResult = jobs.rows
        totalCalls = parseInt(totals.rows[0]?.total) || 0
      }

      const titles = titlesResult.map(r => ({
        title: r.title,
        count: r.count,
        pct: totalCalls > 0 ? Math.round((r.count / totalCalls) * 1000) / 10 : 0,
      }))

      return { period, total_analyses: totalCalls, titles }
    } catch (err) {
      console.error('[analytics] getJobStats query failed:', err.message)
      return this._getMemJobStats(period, limit)
    }
  }

  // ── In-memory fallback for reads ──

  _getMemStats() {
    const todayKey = this._todayKey()
    const today = this._getMemDayStats(todayKey)

    const dailyHistory = [...this._memDailyStats.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        page_views: stats.pageViews,
        unique_visitors: stats.uniqueVisitors instanceof Set ? stats.uniqueVisitors.size : stats.uniqueVisitors,
        api_calls: stats.apiCalls,
      }))

    return {
      generated_at: new Date().toISOString(),
      realtime: { active_visitors: this.activeVisitors.size },
      today: {
        date: todayKey,
        page_views: today.pageViews,
        unique_visitors: today.uniqueVisitors.size,
        api_calls: today.apiCalls,
        top_jobs: this._memTopJobs(today.jobTitles, 10),
      },
      lifetime: {
        total_page_views: this._memLifetime.totalPageViews,
        total_api_calls: this._memLifetime.totalApiCalls,
        top_jobs: this._memTopJobs(this._memLifetime.topJobTitles, 20),
        tracking_since: this._memLifetime.startedAt,
      },
      daily_history: dailyHistory,
    }
  }

  _getMemJobStats(period = 'today', limit = 20) {
    let jobMap, totalCalls

    if (period === 'all') {
      jobMap = this._memLifetime.topJobTitles
      totalCalls = this._memLifetime.totalApiCalls
    } else {
      const today = this._getMemDayStats(this._todayKey())
      jobMap = today.jobTitles
      totalCalls = today.apiCalls
    }

    const titles = this._memTopJobs(jobMap, limit).map(item => ({
      ...item,
      pct: totalCalls > 0 ? Math.round((item.count / totalCalls) * 1000) / 10 : 0,
    }))

    return { period, total_analyses: totalCalls, titles }
  }
}
