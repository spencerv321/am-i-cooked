import Anthropic from '@anthropic-ai/sdk'
import { broadcast } from './analytics/livefeed.js'
import { SYSTEM_PROMPT } from './prompt.js'
import { computeScore, scoreToStatus, scoreToEmoji, validateDimensions } from './scoring.js'

// Excluded IPs (same list as middleware — shared via env var)
export function getExcludedIPs() {
  const raw = process.env.ANALYTICS_EXCLUDE_IPS || ''
  return new Set(raw.split(',').map(ip => ip.trim()).filter(Boolean))
}

let client = null
export function getClient() {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return client
}

const rateLimit = new Map()
const RATE_LIMIT_WINDOW = 60_000
const RATE_LIMIT_MAX = 10

// Per-IP daily cap — cheap insurance against a scraper farming analyses via
// the per-minute limit (10/min = 14,400/day). Heaviest real visitor observed
// post-June 2026 was ~80 in a day; 50 is enough to play with, not to farm.
// Note: this is per real IP thanks to trust proxy — a busy corporate NAT
// during a viral spike could hit it. Raise API_IP_DAILY_CAP if that shows up.
const DAILY_IP_CAP = parseInt(process.env.API_IP_DAILY_CAP) || 50
const dailyByIp = new Map() // ip -> { count, date }

// Prune stale rate limit entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now()
  const today = new Date().toISOString().slice(0, 10)
  for (const [ip, entry] of rateLimit) {
    if (now > entry.resetAt) rateLimit.delete(ip)
  }
  for (const [ip, entry] of dailyByIp) {
    if (entry.date !== today) dailyByIp.delete(ip)
  }
}, 5 * 60_000)

// Returns null if allowed, or 'minute' | 'day' naming the limit that was hit
export function checkRateLimit(ip) {
  const now = Date.now()
  const entry = rateLimit.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW }
  if (now > entry.resetAt) {
    entry.count = 0
    entry.resetAt = now + RATE_LIMIT_WINDOW
  }
  entry.count++
  rateLimit.set(ip, entry)
  if (entry.count > RATE_LIMIT_MAX) return 'minute'

  const today = new Date().toISOString().slice(0, 10)
  const daily = dailyByIp.get(ip)
  if (!daily || daily.date !== today) {
    dailyByIp.set(ip, { count: 1, date: today })
    return null
  }
  daily.count++
  return daily.count > DAILY_IP_CAP ? 'day' : null
}

export const RATE_LIMIT_MESSAGES = {
  minute: 'Too many cooks in the kitchen! Please wait a minute and try again. 🍳',
  day: 'You\'ve cooked enough for one day! Come back tomorrow. 🍳',
}

// Log token usage so cache hit rate and output size are visible in Railway logs.
// cache_read > 0 means the system prompt was served from cache (~0.1x input price).
export function logUsage(label, model, usage, ms) {
  if (!usage) return
  console.log(
    `[usage] ${label} model=${model} in=${usage.input_tokens} ` +
    `cache_write=${usage.cache_creation_input_tokens ?? 0} cache_read=${usage.cache_read_input_tokens ?? 0} ` +
    `out=${usage.output_tokens} ${ms}ms`
  )
}

// Global API call cap — prevents bill explosion from botnet / rotating proxies
const GLOBAL_DAILY_CAP = parseInt(process.env.API_DAILY_CAP) || 25000
const GLOBAL_PER_MINUTE_CAP = parseInt(process.env.API_MINUTE_CAP) || 120
const globalCalls = { today: 0, date: new Date().toISOString().slice(0, 10), minute: 0, minuteStart: Date.now() }

export function checkGlobalCap() {
  const now = Date.now()
  const today = new Date().toISOString().slice(0, 10)

  // Reset daily counter at midnight
  if (today !== globalCalls.date) {
    globalCalls.today = 0
    globalCalls.date = today
  }

  // Reset per-minute counter
  if (now - globalCalls.minuteStart > 60_000) {
    globalCalls.minute = 0
    globalCalls.minuteStart = now
  }

  if (globalCalls.today >= GLOBAL_DAILY_CAP) return 'daily'
  if (globalCalls.minute >= GLOBAL_PER_MINUTE_CAP) return 'minute'

  globalCalls.today++
  globalCalls.minute++
  return null
}

// Model config: try Sonnet 4.6 first (cheaper/faster), fall back to Haiku 4.5 if overloaded.
// Haiku is cheap, fast, and unlikely to be overloaded at the same time as Sonnet.
const PRIMARY_MODEL = 'claude-sonnet-4-6'
const FALLBACK_MODEL = 'claude-haiku-4-5'

// Shared request shape for both job and company analysis.
// Thinking off + effort low matches the old Sonnet 4 latency/cost profile —
// Sonnet 4.6 defaults to effort 'high', which would silently raise spend.
// effort is NOT sent to the Haiku fallback (unsupported there — would 400).
export function buildModelParams(model) {
  return {
    model,
    thinking: { type: 'disabled' },
    ...(model === PRIMARY_MODEL ? { output_config: { effort: 'low' } } : {}),
  }
}

// cache_control caches the system prompt across requests (~0.1x input price on hits).
// 1h TTL: at ~10 analyses/day the default 5m TTL expired between almost every
// request, so nearly every call paid the 1.25x cache-write price and got nothing
// back. 1h writes cost 2x but happen at most once an hour. Verified 2026-09-12
// that the ~1.65K-token job prompt does cache on Sonnet 4.6 — check the
// [usage] log lines for cache_read > 0.
export function cachedSystem(prompt) {
  return [{ type: 'text', text: prompt, cache_control: { type: 'ephemeral', ttl: '1h' } }]
}

// Try primary model, retry once, then fall back to secondary model
export async function callWithFallback(makeRequest) {
  // Attempt 1: primary model
  try {
    return await makeRequest(PRIMARY_MODEL)
  } catch (err) {
    const isOverloaded = err.status === 529 || err.status === 503
    if (!isOverloaded) throw err
    console.log(`[api] ${PRIMARY_MODEL} overloaded, retrying in 2s...`)
  }

  // Attempt 2: primary model after short wait
  await new Promise(r => setTimeout(r, 2000))
  try {
    return await makeRequest(PRIMARY_MODEL)
  } catch (err) {
    const isOverloaded = err.status === 529 || err.status === 503
    if (!isOverloaded) throw err
    console.log(`[api] ${PRIMARY_MODEL} still overloaded, falling back to ${FALLBACK_MODEL}`)
  }

  // Attempt 3: fallback model
  return await makeRequest(FALLBACK_MODEL)
}

export function createAnalyzeRoute(tracker) {
  const excludedIPs = getExcludedIPs()

  return async function analyzeRoute(req, res) {
    try {
      // Global cap — protect against bill explosion regardless of IP
      const capHit = checkGlobalCap()
      if (capHit === 'daily') {
        return res.status(503).json({
          error: 'The kitchen is closed for the day! We\'ve hit our daily limit. Come back tomorrow. 🍳',
        })
      }
      if (capHit === 'minute') {
        return res.status(429).json({
          error: 'Too many cooks in the kitchen! The AI needs a breather. Try again in a minute. 🍳',
        })
      }

      // Per-IP rate limit (per-minute + daily)
      const ip = req.ip || req.socket?.remoteAddress || 'unknown'
      const limitHit = checkRateLimit(ip)
      if (limitHit) {
        return res.status(429).json({ error: RATE_LIMIT_MESSAGES[limitHit] })
      }

      const { jobTitle, description } = req.body
      if (!jobTitle || typeof jobTitle !== 'string' || jobTitle.trim().length === 0) {
        return res.status(400).json({ error: 'Please enter a job title.' })
      }

      const sanitized = jobTitle.trim().slice(0, 80)
      const sanitizedDescription = description && typeof description === 'string'
        ? description.trim().slice(0, 500)
        : ''

      // Build user message with optional day-to-day context
      const descriptionContext = sanitizedDescription
        ? `\n\nDay-to-day responsibilities: ${sanitizedDescription}\n\nUse these additional details to make your analysis specific to this person's actual role, not just the generic job title. Weight the dimensions based on what they actually do.`
        : ''
      const userMessage = `Job title: ${sanitized}${descriptionContext}`

      const started = Date.now()
      const message = await callWithFallback((model) =>
        getClient().messages.create({
          ...buildModelParams(model),
          max_tokens: 1024,
          system: cachedSystem(SYSTEM_PROMPT),
          messages: [{ role: 'user', content: userMessage }],
        })
      )
      logUsage('job', message.model, message.usage, Date.now() - started)

      let text = message.content[0].text
      // Strip markdown code fences if Claude wraps the JSON
      text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const data = JSON.parse(text)

      // Validate dimensions from Claude's response
      const dimCheck = validateDimensions(data.dimensions)
      if (!dimCheck.valid) {
        throw new Error(`Invalid dimensions from Claude: ${dimCheck.error}`)
      }
      if (!data.hot_take) {
        throw new Error('Invalid response schema from Claude')
      }

      // Compute score server-side from dimensions (replaces Claude's holistic score)
      data.score = computeScore(data.dimensions)
      data.status = scoreToStatus(data.score)
      data.status_emoji = scoreToEmoji(data.score)

      // Compute percentile (non-blocking — don't let it delay the response)
      const percentile = await tracker.getPercentile(data.score, 'job').catch(() => null)
      if (percentile != null) data.percentile = percentile

      if (!excludedIPs.has(ip)) {
        tracker.recordApiCall(ip, sanitized, {
          score: data.score,
          tone: null,
          scoringVersion: 2,
        })
        if (sanitizedDescription) {
          tracker.recordEvent('personalized_analyze')
        }

        // Broadcast to live feed (public fields only)
        broadcast({
          title: sanitized,
          score: data.score,
          status: data.status,
          status_emoji: data.status_emoji,
          type: 'job',
        })
      }
      return res.json(data)
    } catch (err) {
      console.error('API Error:', err.message)
      console.error('Error type:', err.constructor.name)
      console.error('Error status:', err.status)
      if (err.error) console.error('Error details:', JSON.stringify(err.error))

      if (err.status === 429) {
        return res.status(429).json({
          error: 'Too many cooks in the kitchen! The AI is overwhelmed. Try again shortly. 🍳',
        })
      }

      if (err.status === 401 || err.status === 403) {
        return res.status(500).json({
          error: 'API authentication issue. The site admin has been notified.',
        })
      }

      if (err.status === 529 || err.status === 503) {
        return res.status(503).json({
          error: 'The AI is temporarily overloaded. Please try again in a moment.',
        })
      }

      return res.status(500).json({
        error: 'Something went wrong analyzing this role. Please try again.',
      })
    }
  }
}
