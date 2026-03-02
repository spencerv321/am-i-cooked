const STATIC_EXTENSIONS = new Set([
  'js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico',
  'woff', 'woff2', 'ttf', 'eot', 'map', 'webp',
])

// Known bot/crawler user-agent patterns
const BOT_PATTERNS = [
  /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i, /baiduspider/i,
  /yandexbot/i, /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i,
  /whatsapp/i, /telegrambot/i, /discordbot/i, /slackbot/i,
  /applebot/i, /semrushbot/i, /ahrefsbot/i, /mj12bot/i, /dotbot/i,
  /petalbot/i, /bytespider/i, /gptbot/i, /claudebot/i, /anthropic/i,
  /crawler/i, /spider/i, /bot\b/i, /crawl/i,
  /headlesschrome/i, /phantomjs/i, /wget/i, /curl/i, /python-requests/i,
  /axios/i, /node-fetch/i, /go-http-client/i, /java\//i, /libwww/i,
  /uptimerobot/i, /pingdom/i, /statuscake/i, /newrelic/i, /datadog/i,
]

function isBot(userAgent) {
  if (!userAgent) return true // no user-agent = almost certainly a bot
  return BOT_PATTERNS.some(pattern => pattern.test(userAgent))
}

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

export function analyticsMiddleware(tracker) {
  const excludedIPs = getExcludedIPs()

  return (req, res, next) => {
    // Skip stats endpoints and dashboard to avoid self-counting
    if (req.path.startsWith('/api/stats') || req.path === '/dash' || req.path === '/api/live-feed' || req.path.startsWith('/r/') || req.path.startsWith('/company/') || req.path === '/api/og' || req.path.startsWith('/api/og/') || req.path.startsWith('/api/seo-status')) {
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

    // ?ref= param from share links cuts through "direct" traffic.
    // When someone pastes a shared link in DMs/texts/etc., the Referer header is stripped,
    // but ?ref= survives and tells us where the share originated.
    const refParam = req.query.ref
    const refSource = refParam ? mapRefParam(refParam) : null
    const referrer = req.get('referer') || req.get('referrer') || null
    tracker.recordPageView(ip, req.path, referrer, refSource)

    next()
  }
}
