const SITE_URL = 'https://amicooked.io'

// Build a personalized share URL: /r/plumber/8/raw
function buildSharePath(jobTitle, score, status) {
  const slug = encodeURIComponent(jobTitle.toLowerCase().trim())
  const cleanStatus = encodeURIComponent(
    (status || 'unknown').toLowerCase().replace(/\s+/g, '-')
  )
  return `${SITE_URL}/r/${slug}/${score}/${cleanStatus}`
}

export function getShareUrl(jobTitle, score, status) {
  const shareUrl = buildSharePath(jobTitle, score, status)
  const text = `Am I Cooked? My job as a ${jobTitle} scored ${score}/100 🔥\n\nFind out if AI is coming for your job:`
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`
}

export function getLinkedInShareUrl(jobTitle, score, status) {
  const shareUrl = buildSharePath(jobTitle, score, status)
  const text = `According to amicooked.io, my role as a ${jobTitle} has a ${score}/100 AI disruption score. What do you think — is this accurate?\n\nCheck your own score:`
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&summary=${encodeURIComponent(text)}`
}

export function getCopyText(jobTitle, score, status) {
  const shareUrl = buildSharePath(jobTitle, score, status)
  return `Am I Cooked? My job as a ${jobTitle} scored ${score}/100 🔥\n\nFind out if AI is coming for your job: ${shareUrl}`
}

export function canNativeShare() {
  return typeof navigator !== 'undefined' && !!navigator.share
}

export async function nativeShare(jobTitle, score, status) {
  if (!canNativeShare()) return false
  const shareUrl = buildSharePath(jobTitle, score, status)
  try {
    await navigator.share({
      title: 'Am I Cooked?',
      text: `My job as a ${jobTitle} scored ${score}/100 🔥 Find out if AI is coming for your job:`,
      url: shareUrl,
    })
    return true
  } catch {
    // User cancelled or share failed — that's fine
    return false
  }
}
