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

    // GET /api/leaderboard — public, cached, no auth
    async leaderboard(req, res) {
      res.set('Cache-Control', 'public, max-age=300')
      const limit = Math.min(parseInt(req.query.limit) || 20, 50)
      return res.json(await tracker.getLeaderboard(limit))
    },
  }
}
