const STATIC_EXTENSIONS = new Set([
  'js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico',
  'woff', 'woff2', 'ttf', 'eot', 'map', 'webp',
])

// Excluded IPs — set via ANALYTICS_EXCLUDE_IPS env var (comma-separated)
// Falls back to empty set if not configured
function getExcludedIPs() {
  const raw = process.env.ANALYTICS_EXCLUDE_IPS || ''
  return new Set(raw.split(',').map(ip => ip.trim()).filter(Boolean))
}

export function analyticsMiddleware(tracker) {
  const excludedIPs = getExcludedIPs()

  return (req, res, next) => {
    // Skip stats endpoints to avoid self-counting
    if (req.path.startsWith('/api/stats')) {
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

    tracker.recordPageView(ip, req.path)

    next()
  }
}
