import Anthropic from '@anthropic-ai/sdk'

let client = null
function getClient() {
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

function checkRateLimit(ip) {
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

const SYSTEM_PROMPT = `You are an AI job disruption analyst. Given a job title, you assess how vulnerable that role is to AI automation based on current and near-future AI capabilities (as of early 2026).

You must respond ONLY with valid JSON matching this exact schema:

{
  "score": <number 0-100>,
  "status": "<string: one of 'Fully Cooked', 'Well Done', 'Medium', 'Medium Rare', 'Raw'>",
  "status_emoji": "<single emoji matching the status>",
  "timeline": "<string: estimated time until significant disruption, e.g. '6-12 months', '2-3 years', '5+ years'>",
  "hot_take": "<string: one punchy, slightly irreverent sentence about this role's AI future. Be specific to the role, not generic. Make it quotable and funny.>",
  "vulnerable_tasks": [
    {"task": "<specific task AI can already do or will soon>", "risk": "<high/medium/low>"}
  ],
  "safe_tasks": [
    {"task": "<specific task that remains hard for AI>", "reason": "<brief why>"}
  ],
  "tldr": "<2-3 sentence summary of the overall outlook for this role>"
}

Scoring guidelines:
- 90-100: "Fully Cooked" — AI can already do most of this job today (e.g., basic data entry, simple translation, boilerplate legal docs)
- 70-89: "Well Done" — Major disruption within 1-2 years, significant parts already automatable
- 40-69: "Medium" — Mixed picture, some tasks automated but core judgment/creativity/physical skills remain
- 20-39: "Medium Rare" — Mostly safe for now, but AI is nibbling at the edges
- 0-19: "Raw" — Physical, deeply human, or highly creative work that AI can't touch yet

Be honest and data-driven but lean slightly dramatic for entertainment value. Reference specific AI tools and capabilities where relevant (Claude, GPT, Copilot, Midjourney, etc.). Be specific to the actual job, not generic platitudes.`

export function createAnalyzeRoute(tracker) {
  return async function analyzeRoute(req, res) {
    try {
      const ip = req.ip || req.socket?.remoteAddress || 'unknown'
      if (!checkRateLimit(ip)) {
        return res.status(429).json({
          error: 'Too many cooks in the kitchen! Please wait a minute and try again. 🍳',
        })
      }

      const { jobTitle } = req.body
      if (!jobTitle || typeof jobTitle !== 'string' || jobTitle.trim().length === 0) {
        return res.status(400).json({ error: 'Please enter a job title.' })
      }

      const sanitized = jobTitle.trim().slice(0, 100)

      const message = await getClient().messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Job title: ${sanitized}` }],
      })

      let text = message.content[0].text
      // Strip markdown code fences if Claude wraps the JSON
      text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const data = JSON.parse(text)

      if (typeof data.score !== 'number' || !data.status || !data.hot_take) {
        throw new Error('Invalid response schema from Claude')
      }

      tracker.recordApiCall(ip, sanitized)
      return res.json(data)
    } catch (err) {
      console.error('API Error:', err.message)

      if (err.status === 429) {
        return res.status(429).json({
          error: 'Too many cooks in the kitchen! The AI is overwhelmed. Try again shortly. 🍳',
        })
      }

      return res.status(500).json({
        error: 'Something went wrong analyzing this role. Please try again.',
      })
    }
  }
}
