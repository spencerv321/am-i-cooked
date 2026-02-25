export function getShareUrl(jobTitle, score) {
  const text = `Am I Cooked? My job as a ${jobTitle} scored ${score}/100 🔥\n\nFind out if AI is coming for your job:`
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
}
