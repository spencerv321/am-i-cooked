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

// --- Challenge share helpers (Sticky CTA) ---

export function getChallengeHeadline(score) {
  if (score >= 81) return "You're toast. Drag a friend down with you."
  if (score >= 61) return 'Pretty cooked. Think YOUR friends are safe?'
  if (score >= 41) return 'Middle of the pack. Where do your friends land?'
  if (score >= 21) return 'Looking safe. Can your friends say the same?'
  return 'AI-proof. Time to flex on your friends.'
}

function getChallengeShareText(jobTitle, score) {
  if (score >= 81) return `I scored ${score}/100 on Am I Cooked — fully cooked 💀 Think you can beat this?`
  if (score >= 61) return `I scored ${score}/100 as a ${jobTitle}. Pretty cooked 🔥 Think YOUR job is safe?`
  if (score >= 41) return `My job scored ${score}/100 on Am I Cooked. Middle of the pack 🍳 Where does yours land?`
  if (score >= 21) return `My job as a ${jobTitle} scored only ${score}/100. Barely cooked 🥩 Bet YOUR job isn't this safe:`
  return `My job as a ${jobTitle} scored ${score}/100 — basically AI-proof 🧊 How cooked are YOU?`
}

export function getChallengeCopyText(jobTitle, score, status) {
  const shareUrl = buildSharePath(jobTitle, score, status, 'challenge')
  return `${getChallengeShareText(jobTitle, score)}\n\n${shareUrl}`
}

export function getChallengeShareUrl(jobTitle, score, status) {
  const shareUrl = buildSharePath(jobTitle, score, status, 'challenge_twitter')
  const text = getChallengeShareText(jobTitle, score) + '\n\nFind out if AI is coming for your job:'
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`
}

export function getChallengeLinkedInUrl(jobTitle, score, status) {
  const shareUrl = buildSharePath(jobTitle, score, status, 'challenge_linkedin')
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
}

export async function challengeNativeShare(jobTitle, score, status) {
  if (!canNativeShare()) return false
  const shareUrl = buildSharePath(jobTitle, score, status, 'challenge')
  try {
    await navigator.share({
      title: 'Am I Cooked?',
      text: getChallengeShareText(jobTitle, score),
      url: shareUrl,
    })
    return true
  } catch {
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

// --- Company share helpers ---

function buildCompanySharePath(companyName, score, status, ref = null) {
  const slug = encodeURIComponent(companyName.toLowerCase().trim())
  const cleanStatus = encodeURIComponent(
    (status || 'unknown').toLowerCase().replace(/\s+/g, '-')
  )
  const base = `${SITE_URL}/company/${slug}/${score}/${cleanStatus}`
  return ref ? `${base}?ref=${ref}` : base
}

export function getCompanyShareUrl(companyName, score, status) {
  const shareUrl = buildCompanySharePath(companyName, score, status, 'twitter')
  const text = `${companyName} scored ${score}/100 on the AI disruption index 🔥\n\nCheck any company:`
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`
}

export function getCompanyLinkedInShareUrl(companyName, score, status) {
  const shareUrl = buildCompanySharePath(companyName, score, status, 'linkedin')
  const text = `I ran ${companyName} through an AI disruption analysis. It scored ${score}/100 — ${status}. Check any company:`
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&summary=${encodeURIComponent(text)}`
}

export function getCompanyCopyText(companyName, score, status) {
  const shareUrl = buildCompanySharePath(companyName, score, status, 'copy')
  return `Is ${companyName} Cooked? AI disruption score: ${score}/100 — ${status}\n\nCheck any company: ${shareUrl}`
}

export async function companyNativeShare(companyName, score, status) {
  if (!canNativeShare()) return false
  const shareUrl = buildCompanySharePath(companyName, score, status, 'native')
  try {
    await navigator.share({
      title: 'Am I Cooked? — Company Analysis',
      text: `${companyName} scored ${score}/100 on the AI disruption index — ${status}`,
      url: shareUrl,
    })
    return true
  } catch {
    return false
  }
}
