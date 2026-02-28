import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_URL = 'https://amicooked.io'

// Load fonts once at startup
const interBold = readFileSync(resolve(__dirname, 'fonts', 'Inter-Bold.ttf'))
const interBlack = readFileSync(resolve(__dirname, 'fonts', 'Inter-Black.ttf'))

// Simple LRU cache for generated PNGs
const imageCache = new Map()
const MAX_CACHE = 500

function cacheSet(key, value) {
  if (imageCache.size >= MAX_CACHE) {
    // Delete oldest entry
    const firstKey = imageCache.keys().next().value
    imageCache.delete(firstKey)
  }
  imageCache.set(key, value)
}

// Sanitize inputs
function sanitize(title, score, status) {
  const cleanTitle = String(title || '').slice(0, 100).replace(/[<>"'&]/g, '')
  const cleanScore = Math.max(0, Math.min(100, parseInt(score) || 0))
  const cleanStatus = String(status || '').slice(0, 30).replace(/[<>"'&]/g, '')
  return { title: cleanTitle, score: cleanScore, status: cleanStatus }
}

// HTML-escape for OG tags
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

// Score to color
function scoreColor(score) {
  if (score <= 20) return '#22c55e'
  if (score <= 40) return '#86efac'
  if (score <= 60) return '#f59e0b'
  if (score <= 80) return '#f97316'
  return '#ef4444'
}

// Score to emoji
function scoreEmoji(score) {
  if (score <= 20) return '🧊'
  if (score <= 40) return '🥩'
  if (score <= 60) return '🍳'
  if (score <= 80) return '🔥'
  return '💀'
}

// Status to display name (capitalize + prettify)
function displayStatus(status) {
  return status
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// Bot detection patterns (reuse from middleware)
const BOT_PATTERNS = [
  /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i, /baiduspider/i,
  /yandexbot/i, /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i,
  /whatsapp/i, /telegrambot/i, /discordbot/i, /slackbot/i,
  /applebot/i, /semrushbot/i, /ahrefsbot/i, /mj12bot/i,
  /crawler/i, /spider/i, /bot\b/i, /crawl/i,
  /headlesschrome/i, /phantomjs/i, /wget/i, /curl/i, /python-requests/i,
  /axios/i, /node-fetch/i, /go-http-client/i, /java\//i, /libwww/i,
  /uptimerobot/i, /pingdom/i, /statuscake/i, /newrelic/i, /datadog/i,
  /embedly/i, /quora/i, /outbrain/i, /pinterest/i, /iframely/i,
  /preview/i,
]

function isBot(ua) {
  if (!ua) return true
  return BOT_PATTERNS.some(p => p.test(ua))
}

// Generate the OG image as PNG
async function generateOgImage(title, score, status) {
  const cacheKey = `${title}|${score}|${status}`
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey)

  const color = scoreColor(score)
  const emoji = scoreEmoji(score)
  const displayTitle = title.replace(/\b\w/g, c => c.toUpperCase())
  const displayStat = displayStatus(status)

  // Satori JSX-like markup (uses React-like object format)
  const markup = {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        background: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter',
        padding: '40px 60px',
      },
      children: [
        // Top branding
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px',
            },
            children: [
              {
                type: 'span',
                props: {
                  style: { fontSize: '28px' },
                  children: '🍳',
                },
              },
              {
                type: 'span',
                props: {
                  style: {
                    fontSize: '24px',
                    fontWeight: 900,
                    color: '#ffffff',
                    letterSpacing: '3px',
                    textTransform: 'uppercase',
                  },
                  children: 'AM I COOKED?',
                },
              },
            ],
          },
        },
        // Job title
        {
          type: 'div',
          props: {
            style: {
              fontSize: displayTitle.length > 25 ? '32px' : '40px',
              fontWeight: 700,
              color: '#a3a3a3',
              marginTop: '16px',
              textAlign: 'center',
              maxWidth: '900px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            },
            children: displayTitle,
          },
        },
        // Big score
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'baseline',
              gap: '8px',
              marginTop: '20px',
            },
            children: [
              {
                type: 'span',
                props: {
                  style: {
                    fontSize: '140px',
                    fontWeight: 900,
                    color: color,
                    lineHeight: '1',
                  },
                  children: String(score),
                },
              },
              {
                type: 'span',
                props: {
                  style: {
                    fontSize: '40px',
                    fontWeight: 700,
                    color: '#555555',
                  },
                  children: '/100',
                },
              },
            ],
          },
        },
        // Status pill
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginTop: '16px',
              padding: '10px 28px',
              border: `2px solid ${color}`,
              borderRadius: '999px',
              background: '#141414',
            },
            children: [
              {
                type: 'span',
                props: {
                  style: { fontSize: '24px' },
                  children: emoji,
                },
              },
              {
                type: 'span',
                props: {
                  style: {
                    fontSize: '22px',
                    fontWeight: 700,
                    color: color,
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                  },
                  children: displayStat,
                },
              },
            ],
          },
        },
        // CTA
        {
          type: 'div',
          props: {
            style: {
              fontSize: '18px',
              color: '#555555',
              marginTop: '28px',
            },
            children: 'Check your job at amicooked.io',
          },
        },
      ],
    },
  }

  const svg = await satori(markup, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Inter', data: interBold, weight: 700, style: 'normal' },
      { name: 'Inter', data: interBlack, weight: 900, style: 'normal' },
    ],
  })

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  })
  const pngBuffer = resvg.render().asPng()

  cacheSet(cacheKey, pngBuffer)
  return pngBuffer
}

// --- Route handlers ---

// GET /r/:title/:score/:status — share page
export function sharePageHandler(req, res) {
  const { title, score, status } = sanitize(
    req.params.title,
    req.params.score,
    req.params.status,
  )

  const ua = req.get('user-agent') || ''

  // Human visitors → redirect to SPA with ?job= prefill
  if (!isBot(ua)) {
    const jobParam = encodeURIComponent(title)
    return res.redirect(302, `${SITE_URL}/?job=${jobParam}`)
  }

  // Bot/crawler → serve HTML with dynamic OG tags
  const escapedTitle = escHtml(title)
  const displayStat = escHtml(displayStatus(status))
  const ogImageUrl = `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&score=${score}&status=${encodeURIComponent(status)}`
  const emoji = scoreEmoji(score)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapedTitle} scored ${score}/100 ${emoji} — Am I Cooked?</title>
<meta name="description" content="${escapedTitle} has a ${score}/100 AI disruption score — ${displayStat}. Check your own job at amicooked.io">
<meta property="og:title" content="${escapedTitle} scored ${score}/100 ${emoji} — Am I Cooked?">
<meta property="og:description" content="AI disruption score: ${score}/100 — ${displayStat}. Find out if your job is cooked.">
<meta property="og:image" content="${ogImageUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${SITE_URL}/r/${encodeURIComponent(title)}/${score}/${encodeURIComponent(status)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Am I Cooked?">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapedTitle} scored ${score}/100 ${emoji}">
<meta name="twitter:description" content="AI disruption score: ${score}/100 — ${displayStat}. Check your own job at amicooked.io">
<meta name="twitter:image" content="${ogImageUrl}">
<link rel="canonical" href="${SITE_URL}/">
</head>
<body>
<p>Redirecting to <a href="${SITE_URL}/?job=${encodeURIComponent(title)}">Am I Cooked?</a></p>
<script>window.location.href="${SITE_URL}/?job=${encodeURIComponent(title)}"</script>
</body>
</html>`

  res.set('Cache-Control', 'public, max-age=86400')
  res.type('html').send(html)
}

// GET /api/og — generate OG image
export async function ogImageHandler(req, res) {
  try {
    const { title, score, status } = sanitize(
      req.query.title,
      req.query.score,
      req.query.status,
    )

    if (!title) {
      return res.redirect(302, `${SITE_URL}/og-image.png`)
    }

    const png = await generateOgImage(title, score, status)

    res.set('Content-Type', 'image/png')
    res.set('Cache-Control', 'public, max-age=604800') // 7 days
    res.send(png)
  } catch (err) {
    console.error('[share] OG image generation failed:', err.message)
    // Fallback to static image
    res.redirect(302, `${SITE_URL}/og-image.png`)
  }
}
