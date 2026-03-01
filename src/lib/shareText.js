const SITE_URL = 'https://amicooked.io'

// Build a personalized share URL: /r/plumber/8/raw?ref=twitter
function buildSharePath(jobTitle, score, status, ref = null) {
  const slug = encodeURIComponent(jobTitle.toLowerCase().trim())
  const cleanStatus = encodeURIComponent(
    (status || 'unknown').toLowerCase().replace(/\s+/g, '-')
  )
  const base = `${SITE_URL}/r/${slug}/${score}/${cleanStatus}`
  return ref ? `${base}?ref=${ref}` : base
}

// Build a compare share URL: /c/nurse/42/medium/vs/accountant/67/well-done?ref=twitter
function buildComparePath(title1, score1, status1, title2, score2, status2, ref = null) {
  const slug1 = encodeURIComponent(title1.toLowerCase().trim())
  const s1 = encodeURIComponent((status1 || 'unknown').toLowerCase().replace(/\s+/g, '-'))
  const slug2 = encodeURIComponent(title2.toLowerCase().trim())
  const s2 = encodeURIComponent((status2 || 'unknown').toLowerCase().replace(/\s+/g, '-'))
  const base = `${SITE_URL}/c/${slug1}/${score1}/${s1}/vs/${slug2}/${score2}/${s2}`
  return ref ? `${base}?ref=${ref}` : base
}

export function getShareUrl(jobTitle, score, status) {
  const shareUrl = buildSharePath(jobTitle, score, status, 'twitter')
  const text = `Am I Cooked? My job as a ${jobTitle} scored ${score}/100 🔥\n\nFind out if AI is coming for your job:`
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`
}

export function getLinkedInShareUrl(jobTitle, score, status) {
  const shareUrl = buildSharePath(jobTitle, score, status, 'linkedin')
  const text = `According to amicooked.io, my role as a ${jobTitle} has a ${score}/100 AI disruption score. What do you think — is this accurate?\n\nCheck your own score:`
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&summary=${encodeURIComponent(text)}`
}

export function getCopyText(jobTitle, score, status) {
  const shareUrl = buildSharePath(jobTitle, score, status, 'copy')
  return `Am I Cooked? My job as a ${jobTitle} scored ${score}/100 🔥\n\nFind out if AI is coming for your job: ${shareUrl}`
}

export function canNativeShare() {
  return typeof navigator !== 'undefined' && !!navigator.share
}

export async function nativeShare(jobTitle, score, status) {
  if (!canNativeShare()) return false
  const shareUrl = buildSharePath(jobTitle, score, status, 'native')
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

// --- Compare share helpers ---

export function getCompareShareUrl(title1, score1, status1, title2, score2, status2) {
  const shareUrl = buildComparePath(title1, score1, status1, title2, score2, status2, 'twitter')
  const winner = score1 > score2 ? title1 : title2
  const text = `⚔️ ${title1} (${score1}/100) vs ${title2} (${score2}/100) — ${winner} is more cooked!\n\nCompare your job:`
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`
}

export function getCompareLinkedInUrl(title1, score1, status1, title2, score2, status2) {
  const shareUrl = buildComparePath(title1, score1, status1, title2, score2, status2, 'linkedin')
  const text = `${title1} (${score1}/100) vs ${title2} (${score2}/100) — who's more at risk from AI? Check the matchup at amicooked.io`
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&summary=${encodeURIComponent(text)}`
}

export function getCompareCopyText(title1, score1, status1, title2, score2, status2) {
  const shareUrl = buildComparePath(title1, score1, status1, title2, score2, status2, 'copy')
  const winner = score1 > score2 ? title1 : title2
  return `⚔️ ${title1} (${score1}/100) vs ${title2} (${score2}/100) — ${winner} is more cooked!\n\nCompare your job: ${shareUrl}`
}

export async function nativeCompareShare(title1, score1, status1, title2, score2, status2) {
  if (!canNativeShare()) return false
  const shareUrl = buildComparePath(title1, score1, status1, title2, score2, status2, 'native')
  const winner = score1 > score2 ? title1 : title2
  try {
    await navigator.share({
      title: 'Am I Cooked? — Job Showdown',
      text: `⚔️ ${title1} (${score1}/100) vs ${title2} (${score2}/100) — ${winner} is more cooked!`,
      url: shareUrl,
    })
    return true
  } catch {
    return false
  }
}
