function requireAuth(req, res, next) {
  const token = process.env.ANALYTICS_TOKEN
  if (!token) {
    return res.status(503).json({ error: 'Analytics not configured' })
  }

  const auth = req.get('Authorization')
  if (!auth || auth !== `Bearer ${token}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  next()
}

export function createStatsRoutes(tracker) {
  return {
    auth: requireAuth,

    // GET /api/stats — full dashboard
    async stats(req, res) {
      return res.json(await tracker.getStats())
    },

    // GET /api/stats/live — real-time active visitors
    live(req, res) {
      return res.json(tracker.getLiveStats())
    },

    // GET /api/stats/jobs — job title leaderboard
    async jobs(req, res) {
      const period = req.query.period || 'today'
      const limit = Math.min(parseInt(req.query.limit) || 20, 100)
      return res.json(await tracker.getJobStats(period, limit))
    },

    // GET /api/stats/referrers — where visitors come from
    async referrers(req, res) {
      const period = req.query.period || 'today'
      const limit = Math.min(parseInt(req.query.limit) || 20, 100)
      return res.json(await tracker.getReferrerStats(period, limit))
    },

    // GET /api/stats/visitors — per-visitor engagement
    async visitors(req, res) {
      const period = req.query.period || 'today'
      return res.json(await tracker.getVisitorStats(period))
    },

    // GET /api/count — public, no auth, just the lifetime count
    async count(req, res) {
      res.set('Cache-Control', 'public, max-age=30')
      return res.json(await tracker.getPublicCount())
    },

    // POST /api/event — public, fire-and-forget click tracking
    event(req, res) {
      const { action } = req.body || {}
      tracker.recordEvent(action)
      return res.status(204).end()
    },

    // GET /api/stats/events — auth-protected event stats
    async events(req, res) {
      const period = req.query.period || 'today'
      return res.json(await tracker.getEventStats(period))
    },

    // GET /api/stats/hourly — hour-by-hour analysis trend
    async hourly(req, res) {
      const hours = Math.min(parseInt(req.query.hours) || 24, 168)
      return res.json(await tracker.getHourlyStats(hours))
    },

    // GET /api/stats/tones — vibe/tone usage distribution
    async tones(req, res) {
      const period = req.query.period || 'all'
      return res.json(await tracker.getToneStats(period))
    },

    // GET /api/stats/scores — score distribution + avg/median
    async scores(req, res) {
      return res.json(await tracker.getScoreStats())
    },

    // GET /api/stats/score-trend — daily average score over time
    async scoreTrend(req, res) {
      const days = Math.min(parseInt(req.query.days) || 14, 90)
      return res.json(await tracker.getDailyScoreTrend(days))
    },

    // GET /api/stats/day/:date — breakdown for a single day (click a spike)
    async dayBreakdown(req, res) {
      const date = req.params.date
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Invalid date format (YYYY-MM-DD)' })
      }
      const data = await tracker.getDayBreakdown(date)
      if (!data) return res.status(404).json({ error: 'No data for this date' })
      return res.json(data)
    },

    // GET /api/stats/referrer-trend — referrer sources over time
    async referrerTrend(req, res) {
      const days = Math.min(parseInt(req.query.days) || 30, 90)
      return res.json(await tracker.getReferrerTrend(days))
    },

    // GET /api/leaderboard — public, cached, no auth
    async leaderboard(req, res) {
      res.set('Cache-Control', 'public, max-age=300')
      const limit = Math.min(parseInt(req.query.limit) || 20, 50)
      return res.json(await tracker.getLeaderboard(limit))
    },
  }
}
