import { broadcast } from './analytics/livefeed.js'
import { COMPANY_SYSTEM_PROMPT } from './companyPrompt.js'
import { getClient, callWithFallback, checkRateLimit, checkGlobalCap, getExcludedIPs } from './api.js'

export function createCompanyAnalyzeRoute(tracker) {
  const excludedIPs = getExcludedIPs()

  return async function companyAnalyzeRoute(req, res) {
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

      const { companyName } = req.body
      if (!companyName || typeof companyName !== 'string' || companyName.trim().length === 0) {
        return res.status(400).json({ error: 'Please enter a company name.' })
      }

      const sanitized = companyName.trim().slice(0, 100)

      const message = await callWithFallback((model) =>
        getClient().messages.create({
          model,
          max_tokens: 2048,
          system: COMPANY_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Company: ${sanitized}` }],
        })
      )

      let text = message.content[0].text
      // Strip markdown code fences if Claude wraps the JSON
      text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const data = JSON.parse(text)

      if (typeof data.overall_score !== 'number' || !data.overall_status || !data.hot_take || !data.dimensions) {
        throw new Error('Invalid response schema from Claude')
      }

      if (!excludedIPs.has(ip)) {
        tracker.recordApiCall(ip, sanitized, {
          score: data.overall_score,
          type: 'company',
        })

        // Broadcast to live feed (public fields only)
        broadcast({
          title: sanitized,
          score: data.overall_score,
          status: data.overall_status,
          status_emoji: data.overall_status_emoji,
          type: 'company',
        })
      }
      return res.json(data)
    } catch (err) {
      console.error('[company-api] Error:', err.message)
      console.error('[company-api] Error type:', err.constructor.name)
      console.error('[company-api] Error status:', err.status)
      if (err.error) console.error('[company-api] Error details:', JSON.stringify(err.error))

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
        error: 'Something went wrong analyzing this company. Please try again.',
      })
    }
  }
}
