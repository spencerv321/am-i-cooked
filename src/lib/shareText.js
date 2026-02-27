const SITE_URL = 'https://amicooked.io'

export function getShareUrl(jobTitle, score) {
  const text = `Am I Cooked? My job as a ${jobTitle} scored ${score}/100 🔥\n\nFind out if AI is coming for your job:`
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SITE_URL)}`
}

export function getLinkedInShareUrl(jobTitle, score) {
  const text = `According to amicooked.io, my role as a ${jobTitle} has a ${score}/100 AI disruption score. What do you think — is this accurate?\n\nCheck your own score:`
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL)}&summary=${encodeURIComponent(text)}`
}

export function getCopyText(jobTitle, score) {
  return `Am I Cooked? My job as a ${jobTitle} scored ${score}/100 🔥\n\nFind out if AI is coming for your job: ${SITE_URL}`
}

export function canNativeShare() {
  return typeof navigator !== 'undefined' && !!navigator.share
}

export async function nativeShare(jobTitle, score) {
  if (!canNativeShare()) return false
  try {
    await navigator.share({
      title: 'Am I Cooked?',
      text: `My job as a ${jobTitle} scored ${score}/100 🔥 Find out if AI is coming for your job:`,
      url: SITE_URL,
    })
    return true
  } catch {
    // User cancelled or share failed — that's fine
    return false
  }
}
