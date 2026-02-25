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
  }
}
