/**
 * SEO Job Pages — server-rendered pages at /jobs/:slug for organic search traffic.
 *
 * Flow:
 * 1. Human/bot visits /jobs/accountant
 * 2. Server checks seo_pages DB table for cached page
 * 3. Cached → serve full HTML with analysis, OG tags, schema.org data
 * 4. Not cached (human) → show loading page with auto-refresh, kick off generation
 * 5. Not cached (bot) → return 503 + Retry-After: 60 (tells Google to come back)
 * 6. Once generated, result is stored and served on all future requests
 */

import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from './prompt.js'

const SITE_URL = 'https://amicooked.io'

// ── Slug helpers ──

export function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

function slugToTitle(slug) {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// ── HTML escaping ──

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

// ── Score helpers (same as share.js / tracker.js) ──

function scoreColor(score) {
  if (score <= 20) return '#22c55e'
  if (score <= 40) return '#86efac'
  if (score <= 60) return '#f59e0b'
  if (score <= 80) return '#f97316'
  return '#ef4444'
}

function scoreEmoji(score) {
  if (score <= 20) return '🧊'
  if (score <= 40) return '🥩'
  if (score <= 60) return '🍳'
  if (score <= 80) return '🔥'
  return '💀'
}

function scoreStatus(score) {
  if (score <= 20) return 'Raw'
  if (score <= 40) return 'Medium Rare'
  if (score <= 60) return 'Medium'
  if (score <= 80) return 'Well Done'
  return 'Fully Cooked'
}

// ── Bot detection (same patterns as share.js) ──

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

// ── Claude API for generation ──

let apiClient = null
function getClient() {
  if (!apiClient) {
    apiClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return apiClient
}

const MODEL = 'claude-sonnet-4-20250514'

// In-memory dedup — prevents duplicate concurrent Claude calls for the same slug
const pendingGenerations = new Map()

async function generateSeoPage(pool, slug, title) {
  // Dedup check — if already generating this slug, wait for the existing promise
  if (pendingGenerations.has(slug)) {
    return pendingGenerations.get(slug)
  }

  const promise = (async () => {
    try {
      const message = await getClient().messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Job title: ${title}` }],
      })

      let text = message.content[0].text
      text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const data = JSON.parse(text)

      if (typeof data.score !== 'number' || !data.status) {
        throw new Error('Invalid response schema from Claude')
      }

      // Store in DB
      await pool.query(`
        INSERT INTO seo_pages (slug, title, analysis_json, score, status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (slug) DO UPDATE SET
          title = $2, analysis_json = $3, score = $4, status = $5, generated_at = NOW()
      `, [slug, title, JSON.stringify(data), data.score, data.status])

      return data
    } finally {
      pendingGenerations.delete(slug)
    }
  })()

  pendingGenerations.set(slug, promise)
  return promise
}

// ── HTML Rendering ──

function renderSeoHtml(slug, title, analysis, relatedJobs = []) {
  const score = analysis.score
  const status = analysis.status
  const emoji = scoreEmoji(score)
  const color = scoreColor(score)
  const escapedTitle = escHtml(title)
  const escapedTldr = escHtml(analysis.tldr || '')
  const ogImageUrl = `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&score=${score}&status=${encodeURIComponent(status)}`
  const canonicalUrl = `${SITE_URL}/jobs/${slug}`

  // Build vulnerable tasks HTML
  const vulnerableTasks = (analysis.vulnerable_tasks || []).map(t => {
    const riskColor = t.risk === 'high' ? '#ef4444' : t.risk === 'medium' ? '#f59e0b' : '#22c55e'
    return `<li style="padding:8px 0;border-bottom:1px solid #1e1e1e;display:flex;justify-content:space-between;align-items:center">
      <span>${escHtml(t.task)}</span>
      <span style="color:${riskColor};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;padding:2px 8px;border:1px solid ${riskColor};border-radius:999px;white-space:nowrap;margin-left:12px">${escHtml(t.risk)}</span>
    </li>`
  }).join('')

  // Build safe tasks HTML
  const safeTasks = (analysis.safe_tasks || []).map(t => {
    return `<li style="padding:8px 0;border-bottom:1px solid #1e1e1e">
      <div>${escHtml(t.task)}</div>
      <div style="color:#6b7280;font-size:13px;margin-top:2px">${escHtml(t.reason)}</div>
    </li>`
  }).join('')

  // Build related jobs links
  const relatedHtml = relatedJobs.length > 0 ? `
    <div style="margin-top:32px;padding:20px;background:#141414;border:1px solid #1e1e1e;border-radius:12px">
      <h3 style="color:#9ca3af;font-size:14px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px 0;font-family:'JetBrains Mono',monospace">Related Jobs</h3>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${relatedJobs.map(j => `<a href="/jobs/${escHtml(j.slug)}" onclick="fetch('/api/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'seo_page_related_click'})})" style="color:${scoreColor(j.score)};background:#0a0a0a;border:1px solid #1e1e1e;padding:6px 14px;border-radius:8px;text-decoration:none;font-size:14px;transition:border-color 0.2s" onmouseover="this.style.borderColor='#333'" onmouseout="this.style.borderColor='#1e1e1e'">${escHtml(j.title)} <span style="opacity:0.6">${j.score}/100</span></a>`).join('')}
      </div>
    </div>` : ''

  // Schema.org FAQPage structured data
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Will AI replace ${title}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${title} has an AI disruption score of ${score}/100 (${status}). ${analysis.tldr || ''}`,
        },
      },
      {
        '@type': 'Question',
        name: `What ${title.toLowerCase()} tasks are at risk from AI?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: (analysis.vulnerable_tasks || []).map(t => `${t.task} (${t.risk} risk)`).join('; ') || 'Analysis pending.',
        },
      },
    ],
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Will AI Replace ${escapedTitle}? AI Disruption Score: ${score}/100 — Am I Cooked?</title>
<meta name="description" content="${escapedTldr}">
<link rel="canonical" href="${canonicalUrl}">

<!-- Open Graph -->
<meta property="og:title" content="Will AI Replace ${escapedTitle}? Score: ${score}/100 ${emoji}">
<meta property="og:description" content="${escapedTldr}">
<meta property="og:image" content="${ogImageUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Am I Cooked?">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Will AI Replace ${escapedTitle}? ${score}/100 ${emoji}">
<meta name="twitter:description" content="${escapedTldr}">
<meta name="twitter:image" content="${ogImageUrl}">

<!-- Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">

<!-- Schema.org -->
<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>

<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0a0a0a;
    color: #e5e5e5;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    line-height: 1.6;
    min-height: 100vh;
  }
  a { color: inherit; }
  .container {
    max-width: 640px;
    margin: 0 auto;
    padding: 48px 20px;
  }
  .brand {
    text-align: center;
    margin-bottom: 8px;
  }
  .brand a {
    color: #6b7280;
    text-decoration: none;
    font-size: 14px;
    letter-spacing: 2px;
    text-transform: uppercase;
    font-weight: 600;
  }
  .brand a:hover { color: #9ca3af; }
  .question {
    text-align: center;
    font-size: 14px;
    color: #6b7280;
    font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 4px;
  }
  .job-title {
    text-align: center;
    font-size: 28px;
    font-weight: 700;
    color: #f5f5f5;
    margin-bottom: 24px;
  }
  .score-section {
    text-align: center;
    margin-bottom: 24px;
  }
  .score-number {
    font-size: 96px;
    font-weight: 900;
    font-family: 'JetBrains Mono', monospace;
    line-height: 1;
    color: ${color};
  }
  .score-label {
    font-size: 14px;
    color: #6b7280;
    font-family: 'JetBrains Mono', monospace;
  }
  .progress-bar {
    width: 100%;
    max-width: 320px;
    height: 8px;
    background: #141414;
    border-radius: 999px;
    margin: 12px auto 0;
    border: 1px solid #1e1e1e;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    border-radius: 999px;
    background: ${color};
    width: ${score}%;
  }
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 20px;
    border: 2px solid ${color};
    border-radius: 999px;
    background: #141414;
    font-weight: 700;
    color: ${color};
    text-transform: uppercase;
    letter-spacing: 2px;
    font-size: 16px;
    margin-bottom: 24px;
  }
  .hot-take {
    background: #141414;
    border: 1px solid #1e1e1e;
    border-left: 3px solid ${color};
    padding: 16px 20px;
    border-radius: 0 12px 12px 0;
    font-style: italic;
    color: #d4d4d4;
    margin-bottom: 16px;
    font-size: 15px;
  }
  .timeline {
    text-align: center;
    color: #9ca3af;
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    margin-bottom: 24px;
  }
  .section {
    background: #141414;
    border: 1px solid #1e1e1e;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
  }
  .section h3 {
    color: #9ca3af;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 12px;
    font-family: 'JetBrains Mono', monospace;
  }
  .section ul { list-style: none; }
  .section ul li:last-child { border-bottom: none !important; }
  .tldr {
    background: #141414;
    border: 1px solid #1e1e1e;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 24px;
  }
  .tldr h3 {
    color: #9ca3af;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 8px;
    font-family: 'JetBrains Mono', monospace;
  }
  .tldr p { color: #d4d4d4; font-size: 15px; }
  .cta {
    text-align: center;
    margin: 32px 0;
  }
  .cta a {
    display: inline-block;
    background: #f59e0b;
    color: #0a0a0a;
    font-weight: 700;
    font-size: 16px;
    padding: 14px 32px;
    border-radius: 12px;
    text-decoration: none;
    transition: background 0.2s;
  }
  .cta a:hover { background: #d97706; }
  .cta p {
    color: #6b7280;
    font-size: 13px;
    margin-top: 8px;
  }
  .footer {
    text-align: center;
    color: #4b5563;
    font-size: 13px;
    margin-top: 48px;
    padding-top: 24px;
    border-top: 1px solid #1e1e1e;
  }
  .footer a { color: #6b7280; text-decoration: none; }
  .footer a:hover { color: #9ca3af; }
</style>
</head>
<body>
<div class="container">
  <div class="brand"><a href="/">🍳 AM I COOKED?</a></div>
  <p class="question">Will AI Replace...</p>
  <h1 class="job-title">${escapedTitle}?</h1>

  <div class="score-section">
    <p class="score-label">AI Disruption Score</p>
    <div class="score-number">${score}</div>
    <div class="progress-bar"><div class="progress-fill"></div></div>
  </div>

  <div style="text-align:center;margin-bottom:24px">
    <span class="status-pill">${emoji} ${escHtml(status)}</span>
  </div>

  <div class="hot-take">"${escHtml(analysis.hot_take || '')}"</div>

  <p class="timeline">⏱ Timeline: ${escHtml(analysis.timeline || 'N/A')}</p>

  <div class="section">
    <h3>🚨 What's at Risk</h3>
    <ul>${vulnerableTasks}</ul>
  </div>

  <div class="section">
    <h3>🛡️ What's Safe (For Now)</h3>
    <ul>${safeTasks}</ul>
  </div>

  <div class="tldr">
    <h3>TL;DR</h3>
    <p>${escapedTldr}</p>
  </div>

  <div class="cta">
    <a href="/?job=" onclick="fetch('/api/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'seo_page_cta_click'})})">Check YOUR Job →</a>
    <p>Free, instant AI disruption analysis</p>
  </div>

  ${relatedHtml}

  <div class="footer">
    <p>Powered by Claude · Built by <a href="https://x.com/spencervail" target="_blank" rel="noopener">@spencervail</a></p>
    <p style="margin-top:4px"><a href="/">Home</a> · <a href="/#leaderboard">Leaderboard</a></p>
  </div>
</div>

<script>
  // Track SEO page view
  fetch('/api/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'seo_page_view' })
  }).catch(() => {})
</script>
</body>
</html>`
}

function renderLoadingHtml(slug, title) {
  const escapedTitle = escHtml(title)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Analyzing ${escapedTitle}... — Am I Cooked?</title>
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="6">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0a0a0a;
    color: #e5e5e5;
    font-family: 'Inter', system-ui, sans-serif;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .container {
    text-align: center;
    padding: 20px;
  }
  .emoji { font-size: 48px; margin-bottom: 16px; }
  h1 {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  p {
    color: #6b7280;
    font-size: 15px;
    margin-bottom: 24px;
  }
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #1e1e1e;
    border-top-color: #f59e0b;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
</head>
<body>
<div class="container">
  <div class="emoji">🍳</div>
  <h1>Analyzing ${escapedTitle}...</h1>
  <p>Our AI is cooking up the results. This page will refresh automatically.</p>
  <div class="spinner"></div>
</div>
<script>
  // Poll for completion every 2 seconds
  const slug = ${JSON.stringify(slug)};
  const poll = setInterval(async () => {
    try {
      const res = await fetch('/api/seo-status/' + slug);
      const data = await res.json();
      if (data.ready) {
        clearInterval(poll);
        window.location.reload();
      }
    } catch {}
  }, 2000);
</script>
</body>
</html>`
}

// ── Route handlers ──

export function createSeoPageHandler(pool) {
  return async (req, res) => {
    const slug = req.params.slug?.toLowerCase().trim()
    if (!slug || slug.length > 80 || !/^[a-z0-9-]+$/.test(slug)) {
      return res.status(404).send('Not found')
    }

    const title = slugToTitle(slug)
    const ua = req.get('user-agent') || ''

    try {
      // Check DB for cached page
      const result = await pool.query(
        'SELECT analysis_json, score FROM seo_pages WHERE slug = $1',
        [slug]
      )

      if (result.rows.length > 0) {
        // Cached — serve full HTML
        const analysis = JSON.parse(result.rows[0].analysis_json)

        // Fetch a few related jobs for internal linking
        const relatedResult = await pool.query(`
          SELECT slug, title, score FROM seo_pages
          WHERE slug != $1
          ORDER BY RANDOM()
          LIMIT 5
        `, [slug])

        const html = renderSeoHtml(slug, title, analysis, relatedResult.rows)
        res.set('Cache-Control', 'public, max-age=86400') // 1 day
        return res.type('html').send(html)
      }

      // Not cached — different behavior for bots vs humans
      if (isBot(ua)) {
        // Tell search engines to come back later
        res.set('Retry-After', '60')
        return res.status(503).send('Page is being generated. Please retry later.')
      }

      // Human — show loading page and kick off generation in background
      if (pool && process.env.ANTHROPIC_API_KEY) {
        generateSeoPage(pool, slug, title).catch(err => {
          console.error(`[seo] Generation failed for ${slug}:`, err.message)
        })
      }

      res.set('Cache-Control', 'no-store')
      return res.type('html').send(renderLoadingHtml(slug, title))
    } catch (err) {
      console.error(`[seo] Error serving ${slug}:`, err.message)
      return res.status(500).send('Something went wrong. Please try again.')
    }
  }
}

export function createSeoStatusHandler(pool) {
  return async (req, res) => {
    const slug = req.params.slug?.toLowerCase().trim()
    if (!slug) return res.json({ ready: false })

    try {
      const result = await pool.query(
        'SELECT 1 FROM seo_pages WHERE slug = $1',
        [slug]
      )
      return res.json({ ready: result.rows.length > 0 })
    } catch {
      return res.json({ ready: false })
    }
  }
}

// ── Dynamic Sitemap ──

let sitemapCache = { html: null, generatedAt: 0 }
const SITEMAP_CACHE_TTL = 60 * 60 * 1000 // 1 hour

export function createSitemapHandler(pool) {
  return async (_req, res) => {
    const now = Date.now()

    // Return cached sitemap if fresh
    if (sitemapCache.html && (now - sitemapCache.generatedAt) < SITEMAP_CACHE_TTL) {
      res.set('Content-Type', 'application/xml')
      res.set('Cache-Control', 'public, max-age=3600')
      return res.send(sitemapCache.html)
    }

    try {
      const result = await pool.query(
        'SELECT slug, generated_at FROM seo_pages ORDER BY generated_at DESC'
      )

      const jobUrls = result.rows.map(row => {
        const lastmod = row.generated_at instanceof Date
          ? row.generated_at.toISOString().slice(0, 10)
          : new Date(row.generated_at).toISOString().slice(0, 10)
        return `  <url>
    <loc>${SITE_URL}/jobs/${escHtml(row.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`
      }).join('\n')

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${jobUrls}
</urlset>`

      sitemapCache = { html: xml, generatedAt: now }

      res.set('Content-Type', 'application/xml')
      res.set('Cache-Control', 'public, max-age=3600')
      return res.send(xml)
    } catch (err) {
      console.error('[seo] Sitemap generation failed:', err.message)

      // Fallback — homepage only
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`

      res.set('Content-Type', 'application/xml')
      return res.send(xml)
    }
  }
}
