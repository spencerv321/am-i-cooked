import { createHash } from 'crypto'

const ACTIVE_VISITOR_TTL = 5 * 60 * 1000 // 5 minutes
const PRUNE_INTERVAL = 60 * 1000 // 1 minute

export class Analytics {
  constructor(pool) {
    this.pool = pool
    this.activeVisitors = new Map()
    this.peakActive = 0
    this.peakActiveDate = this._todayKey()
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

  // ── Peak active visitor tracking ──

  _updatePeak() {
    const today = this._todayKey()
    // Reset peak on new day
    if (today !== this.peakActiveDate) {
      this.peakActive = 0
      this.peakActiveDate = today
    }
    const current = this.activeVisitors.size
    if (current > this.peakActive) {
      this.peakActive = current
      // Persist to DB (fire-and-forget)
      if (this.pool) {
        this.pool.query(`
          INSERT INTO daily_stats (date, peak_active)
          VALUES (CURRENT_DATE, $1)
          ON CONFLICT (date) DO UPDATE SET
            peak_active = GREATEST(daily_stats.peak_active, $1)
        `, [current]).catch(err => {
          console.error('[analytics] peak_active write failed:', err.message)
        })
      }
    }
  }

  // ── Recording methods (fire-and-forget DB writes) ──

  _parseReferrerSource(referrer) {
    if (!referrer) return 'direct'
    try {
      const url = new URL(referrer)
      const host = url.hostname.toLowerCase()
      // Ignore self-referrals
      if (host === 'amicooked.io' || host === 'www.amicooked.io') return null
      // Normalize common domains
      if (host.includes('t.co') || host.includes('twitter.com') || host.includes('x.com')) return 'twitter/x'
      if (host.includes('linkedin.com')) return 'linkedin'
      if (host.includes('facebook.com') || host.includes('fb.com')) return 'facebook'
      if (host.includes('reddit.com')) return 'reddit'
      if (host.includes('google.com') || host.includes('google.co')) return 'google'
      if (host.includes('instagram.com')) return 'instagram'
      if (host.includes('tiktok.com')) return 'tiktok'
      if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube'
      if (host.includes('threads.net')) return 'threads'
      if (host.includes('bsky.app') || host.includes('bluesky')) return 'bluesky'
      if (host.includes('discord.com') || host.includes('discord.gg')) return 'discord'
      return host
    } catch {
      return 'direct'
    }
  }

  recordPageView(ip, path, referrer = null, refSource = null) {
    const hashed = this._hashIP(ip)

    // Always track active visitors in memory (real-time)
    this.activeVisitors.set(hashed, { lastSeen: Date.now(), path })
    this._updatePeak()

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

      // Record referrer source — ?ref= param takes priority over Referer header
      const source = refSource || this._parseReferrerSource(referrer)
      if (source) {
        this.pool.query(`
          INSERT INTO referrers (date, source, count)
          VALUES (CURRENT_DATE, $1, 1)
          ON CONFLICT (date, source) DO UPDATE SET
            count = referrers.count + 1
        `, [source]).catch(err => {
          console.error('[analytics] referrer write failed:', err.message)
        })
      }
    } else {
      const today = this._getMemDayStats(this._todayKey())
      today.pageViews++
      today.uniqueVisitors.add(hashed)
      this._memLifetime.totalPageViews++
    }
  }

  recordApiCall(ip, jobTitle, { score = null, tone = null } = {}) {
    const title = jobTitle.toLowerCase().trim()
    const hashed = this._hashIP(ip)

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

      // Record individual analysis with score, tone, and visitor hash
      this.pool.query(`
        INSERT INTO analyses (date, title, score, tone, visitor_hash)
        VALUES (CURRENT_DATE, $1, $2, $3, $4)
      `, [title, score, tone || null, hashed]).catch(err => {
        console.error('[analytics] analysis write failed:', err.message)
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
          peak_active_today: this.peakActive,
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
      peak_active_today: this.peakActive,
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
            SELECT j.title, SUM(j.count)::INTEGER AS count,
                   ROUND(AVG(a.score))::INTEGER AS avg_score
            FROM job_titles j
            LEFT JOIN (
              SELECT title, score FROM analyses WHERE score IS NOT NULL
            ) a ON a.title = j.title
            GROUP BY j.title ORDER BY count DESC LIMIT $1
          `, [limit]),
          this.pool.query(`SELECT COALESCE(SUM(api_calls), 0) AS total FROM daily_stats`),
        ])
        titlesResult = jobs.rows
        totalCalls = parseInt(totals.rows[0].total) || 0
      } else {
        const [jobs, totals] = await Promise.all([
          this.pool.query(`
            SELECT j.title, j.count,
                   ROUND(AVG(a.score))::INTEGER AS avg_score
            FROM job_titles j
            LEFT JOIN (
              SELECT title, score FROM analyses WHERE score IS NOT NULL
            ) a ON a.title = j.title
            WHERE j.date = CURRENT_DATE
            GROUP BY j.title, j.count
            ORDER BY j.count DESC LIMIT $1
          `, [limit]),
          this.pool.query(`SELECT COALESCE(api_calls, 0) AS total FROM daily_stats WHERE date = CURRENT_DATE`),
        ])
        titlesResult = jobs.rows
        totalCalls = parseInt(totals.rows[0]?.total) || 0
      }

      const titles = titlesResult.map(r => ({
        title: r.title,
        count: r.count,
        avg_score: r.avg_score ?? null,
        pct: totalCalls > 0 ? Math.round((r.count / totalCalls) * 1000) / 10 : 0,
      }))

      return { period, total_analyses: totalCalls, titles }
    } catch (err) {
      console.error('[analytics] getJobStats query failed:', err.message)
      return this._getMemJobStats(period, limit)
    }
  }

  // ── Event tracking (button clicks, shares, etc.) ──

  recordEvent(action) {
    if (!action || typeof action !== 'string') return

    const validActions = [
      'share_primary', 'share_twitter', 'share_linkedin', 'try_again',
      'view_leaderboard', 'leaderboard_tab', 'leaderboard_job_click',
      'compare_submit', 'compare_share_primary', 'compare_share_twitter', 'compare_share_linkedin',
    ]
    const cleaned = action.toLowerCase().trim()
    if (!validActions.includes(cleaned)) return

    if (this.pool) {
      this.pool.query(`
        INSERT INTO events (date, action, count)
        VALUES (CURRENT_DATE, $1, 1)
        ON CONFLICT (date, action) DO UPDATE SET
          count = events.count + 1
      `, [cleaned]).catch(err => {
        console.error('[analytics] event write failed:', err.message)
      })
    }
  }

  async getEventStats(period = 'today') {
    if (!this.pool) return { period, events: [] }

    try {
      let result
      if (period === 'all') {
        result = await this.pool.query(`
          SELECT action, SUM(count)::INTEGER AS count FROM events
          GROUP BY action ORDER BY count DESC
        `)
      } else {
        result = await this.pool.query(`
          SELECT action, count FROM events
          WHERE date = CURRENT_DATE ORDER BY count DESC
        `)
      }

      return {
        period,
        events: result.rows.map(r => ({ action: r.action, count: r.count })),
      }
    } catch (err) {
      console.error('[analytics] getEventStats query failed:', err.message)
      return { period, events: [] }
    }
  }

  async getPublicCount() {
    if (!this.pool) {
      return { count: this._memLifetime.totalApiCalls }
    }

    try {
      const result = await this.pool.query(
        `SELECT COALESCE(SUM(api_calls), 0) AS total FROM daily_stats`
      )
      return { count: parseInt(result.rows[0].total) || 0 }
    } catch (err) {
      console.error('[analytics] getPublicCount query failed:', err.message)
      return { count: 0 }
    }
  }

  async getReferrerStats(period = 'today', limit = 20) {
    if (!this.pool) return { period, referrers: [] }

    try {
      let result
      if (period === 'all') {
        result = await this.pool.query(`
          SELECT source, SUM(count)::INTEGER AS count FROM referrers
          GROUP BY source ORDER BY count DESC LIMIT $1
        `, [limit])
      } else {
        result = await this.pool.query(`
          SELECT source, count FROM referrers
          WHERE date = CURRENT_DATE ORDER BY count DESC LIMIT $1
        `, [limit])
      }

      const total = result.rows.reduce((sum, r) => sum + r.count, 0)
      const referrers = result.rows.map(r => ({
        source: r.source,
        count: r.count,
        pct: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
      }))

      return { period, total, referrers }
    } catch (err) {
      console.error('[analytics] getReferrerStats query failed:', err.message)
      return { period, referrers: [] }
    }
  }

  async getVisitorStats(period = 'today') {
    if (!this.pool) return { period, visitors: [] }

    try {
      let result
      if (period === 'all') {
        result = await this.pool.query(`
          SELECT visitor_hash, COUNT(*)::INTEGER AS analyses,
                 ROUND(AVG(score))::INTEGER AS avg_score,
                 MIN(created_at) AS first_seen
          FROM analyses
          WHERE visitor_hash IS NOT NULL
          GROUP BY visitor_hash
          ORDER BY analyses DESC LIMIT 50
        `)
      } else {
        result = await this.pool.query(`
          SELECT visitor_hash, COUNT(*)::INTEGER AS analyses,
                 ROUND(AVG(score))::INTEGER AS avg_score
          FROM analyses
          WHERE visitor_hash IS NOT NULL AND date = CURRENT_DATE
          GROUP BY visitor_hash
          ORDER BY analyses DESC LIMIT 50
        `)
      }

      // Build distribution buckets
      const distribution = { '1': 0, '2-5': 0, '6-10': 0, '11-20': 0, '20+': 0 }
      for (const row of result.rows) {
        const n = row.analyses
        if (n === 1) distribution['1']++
        else if (n <= 5) distribution['2-5']++
        else if (n <= 10) distribution['6-10']++
        else if (n <= 20) distribution['11-20']++
        else distribution['20+']++
      }

      return {
        period,
        unique_analysts: result.rows.length,
        distribution,
        top_users: result.rows.slice(0, 10).map(r => ({
          hash: r.visitor_hash.slice(0, 6) + '…',
          analyses: r.analyses,
          avg_score: r.avg_score,
        })),
      }
    } catch (err) {
      console.error('[analytics] getVisitorStats query failed:', err.message)
      return { period, visitors: [] }
    }
  }

  // ── Live feed ──

  _scoreToEmoji(score) {
    if (score <= 20) return '🧊'
    if (score <= 40) return '🥩'
    if (score <= 60) return '🍳'
    if (score <= 80) return '🔥'
    return '💀'
  }

  async getRecentAnalyses(limit = 10) {
    if (!this.pool) return []

    try {
      const result = await this.pool.query(`
        SELECT title, score FROM analyses
        WHERE score IS NOT NULL
        ORDER BY created_at DESC
        LIMIT $1
      `, [limit])

      return result.rows.map(r => ({
        title: r.title,
        score: r.score,
        status: this._scoreToStatus(r.score),
        status_emoji: this._scoreToEmoji(r.score),
      }))
    } catch (err) {
      console.error('[analytics] getRecentAnalyses query failed:', err.message)
      return []
    }
  }

  // ── Dashboard: Hourly tracking ──

  async getHourlyStats(hours = 24) {
    if (!this.pool) return { hours, data: [] }

    try {
      const result = await this.pool.query(`
        SELECT DATE_TRUNC('hour', created_at) AS hour,
               COUNT(*)::INTEGER AS analyses
        FROM analyses
        WHERE created_at >= NOW() - INTERVAL '1 hour' * $1
        GROUP BY DATE_TRUNC('hour', created_at)
        ORDER BY hour ASC
      `, [hours])

      return {
        hours,
        data: result.rows.map(r => ({
          hour: r.hour.toISOString(),
          analyses: r.analyses,
        })),
      }
    } catch (err) {
      console.error('[analytics] getHourlyStats query failed:', err.message)
      return { hours, data: [] }
    }
  }

  // ── Dashboard: Tone/vibe distribution ──

  async getToneStats(period = 'all') {
    if (!this.pool) return { period, tones: [] }

    try {
      let result
      if (period === 'today') {
        result = await this.pool.query(`
          SELECT COALESCE(tone, 'default') AS tone, COUNT(*)::INTEGER AS count
          FROM analyses
          WHERE date = CURRENT_DATE
          GROUP BY tone ORDER BY count DESC
        `)
      } else {
        result = await this.pool.query(`
          SELECT COALESCE(tone, 'default') AS tone, COUNT(*)::INTEGER AS count
          FROM analyses
          GROUP BY tone ORDER BY count DESC
        `)
      }

      const total = result.rows.reduce((sum, r) => sum + r.count, 0)
      return {
        period,
        total,
        tones: result.rows.map(r => ({
          tone: r.tone,
          count: r.count,
          pct: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
        })),
      }
    } catch (err) {
      console.error('[analytics] getToneStats query failed:', err.message)
      return { period, tones: [] }
    }
  }

  // ── Public leaderboard ──

  _scoreToStatus(score) {
    if (score <= 20) return 'Raw'
    if (score <= 40) return 'Medium Rare'
    if (score <= 60) return 'Medium'
    if (score <= 80) return 'Well Done'
    return 'Fully Cooked'
  }

  async getLeaderboard(limit = 20) {
    if (!this.pool) {
      return { most_cooked: [], least_cooked: [], most_popular: [] }
    }

    try {
      const [mostCooked, leastCooked, mostPopular] = await Promise.all([
        // Most cooked — blended score (70% avg + 30% max) to reward high outliers, min 3 analyses
        this.pool.query(`
          SELECT title,
                 ROUND(AVG(score) * 0.7 + MAX(score) * 0.3)::INTEGER AS avg_score,
                 COUNT(*)::INTEGER AS analyses
          FROM analyses
          WHERE score IS NOT NULL
          GROUP BY title
          HAVING COUNT(*) >= 3
          ORDER BY avg_score DESC
          LIMIT $1
        `, [limit]),

        // Least cooked — blended score (70% avg + 30% min) to reward low outliers, min 3 analyses
        this.pool.query(`
          SELECT title,
                 ROUND(AVG(score) * 0.7 + MIN(score) * 0.3)::INTEGER AS avg_score,
                 COUNT(*)::INTEGER AS analyses
          FROM analyses
          WHERE score IS NOT NULL
          GROUP BY title
          HAVING COUNT(*) >= 3
          ORDER BY avg_score ASC
          LIMIT $1
        `, [limit]),

        // Most popular — most searched job titles with avg score
        this.pool.query(`
          SELECT j.title,
                 SUM(j.count)::INTEGER AS searches,
                 ROUND(AVG(a.score))::INTEGER AS avg_score
          FROM job_titles j
          LEFT JOIN (
            SELECT title, AVG(score) AS score
            FROM analyses WHERE score IS NOT NULL
            GROUP BY title
          ) a ON a.title = j.title
          GROUP BY j.title
          ORDER BY searches DESC
          LIMIT $1
        `, [limit]),
      ])

      return {
        most_cooked: mostCooked.rows.map(r => ({
          title: r.title,
          avg_score: r.avg_score,
          analyses: r.analyses,
          status: this._scoreToStatus(r.avg_score),
        })),
        least_cooked: leastCooked.rows.map(r => ({
          title: r.title,
          avg_score: r.avg_score,
          analyses: r.analyses,
          status: this._scoreToStatus(r.avg_score),
        })),
        most_popular: mostPopular.rows.map(r => ({
          title: r.title,
          searches: r.searches,
          avg_score: r.avg_score,
          status: r.avg_score != null ? this._scoreToStatus(r.avg_score) : null,
        })),
      }
    } catch (err) {
      console.error('[analytics] getLeaderboard query failed:', err.message)
      return { most_cooked: [], least_cooked: [], most_popular: [] }
    }
  }

  // ── Dashboard: Score distribution + trend ──

  async getScoreStats() {
    if (!this.pool) return { distribution: [], avg: null, median: null, total: 0 }

    try {
      const [distResult, summaryResult] = await Promise.all([
        this.pool.query(`
          SELECT
            CASE
              WHEN score <= 20 THEN 'Raw'
              WHEN score <= 40 THEN 'Medium Rare'
              WHEN score <= 60 THEN 'Medium'
              WHEN score <= 80 THEN 'Well Done'
              ELSE 'Fully Cooked'
            END AS bucket,
            CASE
              WHEN score <= 20 THEN 1
              WHEN score <= 40 THEN 2
              WHEN score <= 60 THEN 3
              WHEN score <= 80 THEN 4
              ELSE 5
            END AS bucket_order,
            COUNT(*)::INTEGER AS count
          FROM analyses WHERE score IS NOT NULL
          GROUP BY bucket, bucket_order
          ORDER BY bucket_order
        `),
        this.pool.query(`
          SELECT
            ROUND(AVG(score))::INTEGER AS avg_score,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY score)::INTEGER AS median_score,
            COUNT(*)::INTEGER AS total
          FROM analyses WHERE score IS NOT NULL
        `),
      ])

      const total = summaryResult.rows[0]?.total || 0
      return {
        distribution: distResult.rows.map(r => ({
          bucket: r.bucket,
          count: r.count,
          pct: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
        })),
        avg: summaryResult.rows[0]?.avg_score ?? null,
        median: summaryResult.rows[0]?.median_score ?? null,
        total,
      }
    } catch (err) {
      console.error('[analytics] getScoreStats query failed:', err.message)
      return { distribution: [], avg: null, median: null, total: 0 }
    }
  }

  async getDailyScoreTrend(days = 14) {
    if (!this.pool) return { days, data: [] }

    try {
      const result = await this.pool.query(`
        SELECT date,
               ROUND(AVG(score))::INTEGER AS avg_score,
               COUNT(*)::INTEGER AS count
        FROM analyses
        WHERE score IS NOT NULL
          AND date >= CURRENT_DATE - $1::INTEGER
        GROUP BY date
        ORDER BY date ASC
      `, [days])

      return {
        days,
        data: result.rows.map(r => ({
          date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
          avg_score: r.avg_score,
          count: r.count,
        })),
      }
    } catch (err) {
      console.error('[analytics] getDailyScoreTrend query failed:', err.message)
      return { days, data: [] }
    }
  }

  // ── Dashboard: Day breakdown (click a spike to see what drove it) ──

  async getDayBreakdown(date) {
    if (!this.pool) return null

    try {
      const [statsResult, referrersResult, jobsResult, shareEventsResult] = await Promise.all([
        this.pool.query(`
          SELECT page_views, array_length(unique_ips, 1) AS unique_visitors,
                 api_calls, peak_active
          FROM daily_stats WHERE date = $1
        `, [date]),

        this.pool.query(`
          SELECT source, count FROM referrers
          WHERE date = $1 ORDER BY count DESC LIMIT 10
        `, [date]),

        this.pool.query(`
          SELECT title, count FROM job_titles
          WHERE date = $1 ORDER BY count DESC LIMIT 10
        `, [date]),

        this.pool.query(`
          SELECT action, count FROM events
          WHERE date = $1 ORDER BY count DESC
        `, [date]),
      ])

      const stats = statsResult.rows[0] || { page_views: 0, unique_visitors: 0, api_calls: 0, peak_active: 0 }
      const totalRefs = referrersResult.rows.reduce((sum, r) => sum + r.count, 0)

      return {
        date,
        stats: {
          page_views: stats.page_views || 0,
          unique_visitors: stats.unique_visitors || 0,
          api_calls: stats.api_calls || 0,
          peak_active: stats.peak_active || 0,
        },
        referrers: referrersResult.rows.map(r => ({
          source: r.source,
          count: r.count,
          pct: totalRefs > 0 ? Math.round((r.count / totalRefs) * 1000) / 10 : 0,
        })),
        top_jobs: jobsResult.rows.map(r => ({ title: r.title, count: r.count })),
        events: shareEventsResult.rows.map(r => ({ action: r.action, count: r.count })),
      }
    } catch (err) {
      console.error('[analytics] getDayBreakdown query failed:', err.message)
      return null
    }
  }

  // ── Dashboard: Referrer trend over time (which platforms drive spikes) ──

  async getReferrerTrend(days = 30) {
    if (!this.pool) return { days, data: [], sources: [] }

    try {
      // Get the top sources across the period
      const topSourcesResult = await this.pool.query(`
        SELECT source, SUM(count)::INTEGER AS total
        FROM referrers
        WHERE date >= CURRENT_DATE - $1::INTEGER
        GROUP BY source
        ORDER BY total DESC
        LIMIT 6
      `, [days])

      const topSources = topSourcesResult.rows.map(r => r.source)
      if (topSources.length === 0) return { days, data: [], sources: [] }

      // Get daily breakdown for those top sources
      const trendResult = await this.pool.query(`
        SELECT date, source, count
        FROM referrers
        WHERE date >= CURRENT_DATE - $1::INTEGER
          AND source = ANY($2)
        ORDER BY date ASC
      `, [days, topSources])

      // Also get daily totals for context
      const totalsResult = await this.pool.query(`
        SELECT date, api_calls FROM daily_stats
        WHERE date >= CURRENT_DATE - $1::INTEGER
        ORDER BY date ASC
      `, [days])

      // Build date→source→count lookup
      const byDate = {}
      for (const row of trendResult.rows) {
        const d = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date
        if (!byDate[d]) byDate[d] = {}
        byDate[d][row.source] = row.count
      }

      // Build output with totals
      const dailyTotals = {}
      for (const row of totalsResult.rows) {
        const d = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date
        dailyTotals[d] = row.api_calls
      }

      const dates = [...new Set([...Object.keys(byDate), ...Object.keys(dailyTotals)])].sort()
      const data = dates.map(date => ({
        date,
        analyses: dailyTotals[date] || 0,
        sources: topSources.reduce((obj, s) => { obj[s] = (byDate[date] || {})[s] || 0; return obj }, {}),
      }))

      return { days, sources: topSources, data }
    } catch (err) {
      console.error('[analytics] getReferrerTrend query failed:', err.message)
      return { days, data: [], sources: [] }
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
