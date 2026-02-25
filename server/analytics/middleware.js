const STATIC_EXTENSIONS = new Set([
  'js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico',
  'woff', 'woff2', 'ttf', 'eot', 'map', 'webp',
])

export function analyticsMiddleware(tracker) {
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
    tracker.recordPageView(ip, req.path)

    next()
  }
}
