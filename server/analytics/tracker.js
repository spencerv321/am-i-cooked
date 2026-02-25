import { createHash } from 'crypto'

const ACTIVE_VISITOR_TTL = 5 * 60 * 1000 // 5 minutes
const PRUNE_INTERVAL = 60 * 1000 // 1 minute

class Analytics {
  constructor() {
    this.dailyStats = new Map()
    this.activeVisitors = new Map()
    this.lifetimeStats = {
      totalPageViews: 0,
      totalApiCalls: 0,
      topJobTitles: new Map(),
      startedAt: new Date().toISOString(),
    }
    this.salt = process.env.ANALYTICS_SALT || 'am-i-cooked-default-salt'

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

  _getDayStats(dateKey) {
    if (!this.dailyStats.has(dateKey)) {
      this.dailyStats.set(dateKey, {
        pageViews: 0,
        uniqueVisitors: new Set(),
        apiCalls: 0,
        jobTitles: new Map(),
      })
    }
    return this.dailyStats.get(dateKey)
  }

  recordPageView(ip, path) {
    const hashed = this._hashIP(ip)
    const today = this._getDayStats(this._todayKey())

    today.pageViews++
    today.uniqueVisitors.add(hashed)
    this.lifetimeStats.totalPageViews++

    // Track active visitor
    this.activeVisitors.set(hashed, { lastSeen: Date.now(), path })
  }

  recordApiCall(ip, jobTitle) {
    const today = this._getDayStats(this._todayKey())
    const title = jobTitle.toLowerCase().trim()

    today.apiCalls++
    today.jobTitles.set(title, (today.jobTitles.get(title) || 0) + 1)

    this.lifetimeStats.totalApiCalls++
    this.lifetimeStats.topJobTitles.set(
      title,
      (this.lifetimeStats.topJobTitles.get(title) || 0) + 1
    )
  }

  _pruneActiveVisitors() {
    const cutoff = Date.now() - ACTIVE_VISITOR_TTL
    for (const [key, entry] of this.activeVisitors) {
      if (entry.lastSeen < cutoff) {
        this.activeVisitors.delete(key)
      }
    }
  }

  _topJobs(jobMap, limit = 10) {
    return [...jobMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([title, count]) => ({ title, count }))
  }

  getStats() {
    const todayKey = this._todayKey()
    const today = this._getDayStats(todayKey)

    // Build daily history
    const dailyHistory = [...this.dailyStats.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        page_views: stats.pageViews,
        unique_visitors: stats.uniqueVisitors instanceof Set ? stats.uniqueVisitors.size : stats.uniqueVisitors,
        api_calls: stats.apiCalls,
      }))

    return {
      generated_at: new Date().toISOString(),
      realtime: {
        active_visitors: this.activeVisitors.size,
      },
      today: {
        date: todayKey,
        page_views: today.pageViews,
        unique_visitors: today.uniqueVisitors.size,
        api_calls: today.apiCalls,
        top_jobs: this._topJobs(today.jobTitles, 10),
      },
      lifetime: {
        total_page_views: this.lifetimeStats.totalPageViews,
        total_api_calls: this.lifetimeStats.totalApiCalls,
        top_jobs: this._topJobs(this.lifetimeStats.topJobTitles, 20),
        tracking_since: this.lifetimeStats.startedAt,
      },
      daily_history: dailyHistory,
    }
  }

  getLiveStats() {
    return {
      active_visitors: this.activeVisitors.size,
      server_time: new Date().toISOString(),
    }
  }

  getJobStats(period = 'today', limit = 20) {
    let jobMap
    let totalCalls

    if (period === 'all') {
      jobMap = this.lifetimeStats.topJobTitles
      totalCalls = this.lifetimeStats.totalApiCalls
    } else {
      const today = this._getDayStats(this._todayKey())
      jobMap = today.jobTitles
      totalCalls = today.apiCalls
    }

    const titles = this._topJobs(jobMap, limit).map((item) => ({
      ...item,
      pct: totalCalls > 0 ? Math.round((item.count / totalCalls) * 1000) / 10 : 0,
    }))

    return { period, total_analyses: totalCalls, titles }
  }
}

// Singleton
const tracker = new Analytics()
export default tracker
