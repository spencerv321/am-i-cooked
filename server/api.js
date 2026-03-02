import Anthropic from '@anthropic-ai/sdk'
import { broadcast } from './analytics/livefeed.js'
import { SYSTEM_PROMPT } from './prompt.js'

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

// Prune stale rate limit entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimit) {
    if (now > entry.resetAt) rateLimit.delete(ip)
  }
}, 5 * 60_000)

export function checkRateLimit(ip) {
  const now = Date.now()
  const entry = rateLimit.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW }
  if (now > entry.resetAt) {
    entry.count = 0
    entry.resetAt = now + RATE_LIMIT_WINDOW
  }
  entry.count++
  rateLimit.set(ip, entry)
  return entry.count <= RATE_LIMIT_MAX
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

// Model config: try Sonnet 4 first (cheaper/faster), fall back to Opus 4 if overloaded
const PRIMARY_MODEL = 'claude-sonnet-4-20250514'
const FALLBACK_MODEL = 'claude-opus-4-20250514'

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

// Tone modifiers — appended to user message when a tone is selected
const TONE_MODIFIERS = {
  chaos_agent: `\n\nTONE: You are an unhinged tech doomposting account. Be maximally dramatic, catastrophize everything, use internet slang and meme energy. The hot_take should sound like a viral tweet from someone who just discovered AI exists. Phrases like "it's so over", "cooked beyond recognition", "rip bozo" are encouraged. Still provide accurate analysis underneath the chaos. IMPORTANT: The tone affects ONLY the writing style (hot_take, tldr, task descriptions). The numeric score must be identical to what you would give with no tone modifier.`,

  corporate_shill: `\n\nTONE: You are a McKinsey consultant delivering a "workforce transformation" deck. Use dry corporate euphemisms — never say "fired", say "right-sized" or "optimized out of the value chain." Everything is a "strategic pivot opportunity." Speak in consulting jargon: synergies, leverage, stakeholder alignment, headcount rationalization. The hot_take should sound like a LinkedIn post from someone who just laid off 10,000 people and called it "exciting." IMPORTANT: The tone affects ONLY the writing style (hot_take, tldr, task descriptions). The numeric score must be identical to what you would give with no tone modifier.`,

  michael_scott: `\n\nTONE: You are Michael Scott from The Office analyzing this job. Misuse business terms confidently. Mix in inappropriate analogies. Express misguided confidence about things you clearly don't understand. Reference The Office situations where relevant. The hot_take should be something Michael would say in a talking-head interview — accidentally insightful but mostly wrong and definitely inappropriate. Still keep the actual risk assessment honest underneath the Michael energy. IMPORTANT: The tone affects ONLY the writing style (hot_take, tldr, task descriptions). The numeric score must be identical to what you would give with no tone modifier.`,
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

      // Per-IP rate limit
      const ip = req.ip || req.socket?.remoteAddress || 'unknown'
      if (!checkRateLimit(ip)) {
        return res.status(429).json({
          error: 'Too many cooks in the kitchen! Please wait a minute and try again. 🍳',
        })
      }

      const { jobTitle, tone } = req.body
      if (!jobTitle || typeof jobTitle !== 'string' || jobTitle.trim().length === 0) {
        return res.status(400).json({ error: 'Please enter a job title.' })
      }

      const sanitized = jobTitle.trim().slice(0, 100)

      // Build user message with optional tone modifier
      const validTones = Object.keys(TONE_MODIFIERS)
      const toneModifier = tone && validTones.includes(tone) ? TONE_MODIFIERS[tone] : ''
      const userMessage = `Job title: ${sanitized}${toneModifier}`

      const message = await callWithFallback((model) =>
        getClient().messages.create({
          model,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        })
      )

      let text = message.content[0].text
      // Strip markdown code fences if Claude wraps the JSON
      text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const data = JSON.parse(text)

      if (typeof data.score !== 'number' || !data.status || !data.hot_take) {
        throw new Error('Invalid response schema from Claude')
      }

      if (!excludedIPs.has(ip)) {
        tracker.recordApiCall(ip, sanitized, {
          score: data.score,
          tone: tone && validTones.includes(tone) ? tone : null,
        })

        // Broadcast to live feed (public fields only)
        broadcast({
          title: sanitized,
          score: data.score,
          status: data.status,
          status_emoji: data.status_emoji,
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
