import geoip from 'geoip-lite'
import { isBot } from '../bot-detection.js'

const STATIC_EXTENSIONS = new Set([
  'js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico',
  'woff', 'woff2', 'ttf', 'eot', 'map', 'webp',
])

// Map ?ref= param values to normalized source names (same names _parseReferrerSource uses)
const REF_MAP = {
  twitter: 'twitter/x',
  linkedin: 'linkedin',
  copy: 'shared-link',    // someone pasted a copied link (dark social made visible)
  native: 'shared-link',  // native OS share (could end up anywhere)
  challenge: 'challenge-link',          // "Challenge a Friend" sticky CTA
  challenge_twitter: 'challenge-link',  // challenge shared via X
  challenge_linkedin: 'challenge-link', // challenge shared via LinkedIn
}

function mapRefParam(ref) {
  if (!ref || typeof ref !== 'string') return null
  const cleaned = ref.toLowerCase().trim()
  return REF_MAP[cleaned] || `ref:${cleaned}`
}

// Excluded IPs — set via ANALYTICS_EXCLUDE_IPS env var (comma-separated)
function getExcludedIPs() {
  const raw = process.env.ANALYTICS_EXCLUDE_IPS || ''
  return new Set(raw.split(',').map(ip => ip.trim()).filter(Boolean))
}

// Per-IP daily page-view cap. Crawlers with browser-like UAs slip past isBot()
// and were producing 500+ "page views" a day from a single IP with zero analyses
// (Sept 2026: 95% of daily views from one BR source). A real visitor on this SPA
// generates a handful of page views per session, so anything past the cap is
// a bot and stops being recorded. Counters live in memory and reset daily.
const PAGE_VIEW_DAILY_CAP = parseInt(process.env.PAGE_VIEW_DAILY_CAP) || 40
const pageViewCounts = new Map() // ip -> { count, date }

function overPageViewCap(ip) {
  const today = new Date().toISOString().slice(0, 10)
  const entry = pageViewCounts.get(ip)
  if (!entry || entry.date !== today) {
    pageViewCounts.set(ip, { count: 1, date: today })
    return false
  }
  entry.count++
  return entry.count > PAGE_VIEW_DAILY_CAP
}

// Drop yesterday's counters once a day so the map doesn't grow unbounded
setInterval(() => {
  const today = new Date().toISOString().slice(0, 10)
  for (const [ip, entry] of pageViewCounts) {
    if (entry.date !== today) pageViewCounts.delete(ip)
  }
}, 60 * 60_000)

export function analyticsMiddleware(tracker) {
  const excludedIPs = getExcludedIPs()

  return (req, res, next) => {
    // Skip stats endpoints and dashboard to avoid self-counting
    if (req.path.startsWith('/api/stats') || req.path === '/dash' || req.path === '/api/live-feed' || req.path.startsWith('/r/') || req.path.startsWith('/company/') || req.path === '/api/og' || req.path.startsWith('/api/og/') || req.path.startsWith('/api/seo-status')) {
      return next()
    }

    // Skip all remaining /api/* calls — a page view is a page, not an XHR.
    // Before 2026-09-12 the SPA's /api/count + /api/trending + /api/leaderboard
    // fetches were each counted as a page view, inflating views ~3x per visit.
    // Analyses are counted separately via recordApiCall.
    if (req.path.startsWith('/api/')) {
      return next()
    }

    // Skip static assets
    const lastDot = req.path.lastIndexOf('.')
    if (lastDot !== -1) {
      const ext = req.path.slice(lastDot + 1).toLowerCase()
      if (STATIC_EXTENSIONS.has(ext)) {
        return next()
      }
    }

    const ip = req.ip || req.socket?.remoteAddress || 'unknown'

    // Skip excluded IPs (owner traffic)
    if (excludedIPs.has(ip)) {
      return next()
    }

    // Skip bots and crawlers
    const ua = req.get('user-agent') || ''
    if (isBot(ua)) {
      return next()
    }

    // Skip IPs that have blown past a human's daily page-view volume
    if (overPageViewCap(ip)) {
      return next()
    }

    // ?ref= param from share links cuts through "direct" traffic.
    // When someone pastes a shared link in DMs/texts/etc., the Referer header is stripped,
    // but ?ref= survives and tells us where the share originated.
    const refParam = req.query.ref
    const refSource = refParam ? mapRefParam(refParam) : null
    const referrer = req.get('referer') || req.get('referrer') || null
    tracker.recordPageView(ip, req.path, referrer, refSource)

    // Geo lookup (fast, local MaxMind DB — no external API calls)
    const geo = geoip.lookup(ip)
    if (geo?.country) {
      const region = geo.country === 'US' ? (geo.region || '') : ''
      tracker.recordGeo(geo.country, region)
    }

    next()
  }
}
