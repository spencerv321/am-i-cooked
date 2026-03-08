/**
 * Shared bot/crawler detection — imported by middleware.js, share.js, and seo.js.
 * Single source of truth for BOT_PATTERNS.
 */

export const BOT_PATTERNS = [
  /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i, /baiduspider/i,
  /yandexbot/i, /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i,
  /whatsapp/i, /telegrambot/i, /discordbot/i, /slackbot/i,
  /applebot/i, /semrushbot/i, /ahrefsbot/i, /mj12bot/i, /dotbot/i,
  /petalbot/i, /bytespider/i, /gptbot/i, /claudebot/i, /anthropic/i,
  /crawler/i, /spider/i, /bot\b/i, /crawl/i,
  /headlesschrome/i, /phantomjs/i, /wget/i, /curl/i, /python-requests/i,
  /axios/i, /node-fetch/i, /go-http-client/i, /java\//i, /libwww/i,
  /uptimerobot/i, /pingdom/i, /statuscake/i, /newrelic/i, /datadog/i,
  /embedly/i, /quora/i, /outbrain/i, /pinterest/i, /iframely/i,
  /preview/i,
]

export function isBot(ua) {
  if (!ua) return true
  return BOT_PATTERNS.some(p => p.test(ua))
}
