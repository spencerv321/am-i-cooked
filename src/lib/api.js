export function trackEvent(action) {
  fetch('/api/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  }).catch(() => {})
}

export async function fetchLeaderboard() {
  const res = await fetch('/api/leaderboard')
  if (!res.ok) throw new Error('Failed to load leaderboard')
  return res.json()
}

export async function fetchCompanyLeaderboard() {
  const res = await fetch('/api/company-leaderboard')
  if (!res.ok) throw new Error('Failed to load company leaderboard')
  return res.json()
}

export async function analyzeJob(jobTitle) {
  const body = { jobTitle }

  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || 'Something went wrong. Please try again.')
  }

  return res.json()
}

export async function subscribeEmail(email, jobTitle, score, type = 'job', source = 'score_result') {
  const res = await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, jobTitle, score, type, source }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Something went wrong. Try again?')
  }
  return res.json()
}

export async function analyzeCompany(companyName) {
  const res = await fetch('/api/analyze-company', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyName }),
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || 'Something went wrong. Please try again.')
  }

  return res.json()
}
