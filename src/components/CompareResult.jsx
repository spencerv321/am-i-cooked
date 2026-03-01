import { useState } from 'react'
import { useScoreAnimation } from '../hooks/useScoreAnimation'
import StatusBadge from './StatusBadge'
import { getCompareShareUrl, getCompareLinkedInUrl, getCompareCopyText, canNativeShare, nativeCompareShare } from '../lib/shareText'
import { trackEvent } from '../lib/api'

function getScoreColor(score) {
  const hue = 120 - (score / 100) * 120
  return `hsl(${hue}, 80%, 50%)`
}

function CompareScore({ score, label }) {
  const animatedScore = useScoreAnimation(score)
  const color = getScoreColor(animatedScore)

  return (
    <div className="flex flex-col items-center">
      <p className="text-gray-500 font-mono text-xs uppercase tracking-widest mb-1 truncate max-w-full">
        {label}
      </p>
      <div
        className="text-5xl sm:text-7xl font-black font-mono score-glow tabular-nums"
        style={{ '--score-color': color, color }}
      >
        {animatedScore}
      </div>
      <div className="w-full max-w-[140px] sm:max-w-[180px] mt-2 h-1.5 bg-dark-card rounded-full overflow-hidden border border-dark-border">
        <div
          className="h-full rounded-full progress-bar-animated progress-glow"
          style={{
            '--score-color': color,
            width: `${score}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  )
}

function Verdict({ job1, job2 }) {
  const diff = Math.abs(job1.score - job2.score)
  const moreCooked = job1.score > job2.score ? job1 : job2
  const lessCooked = job1.score > job2.score ? job2 : job1

  if (diff === 0) {
    return (
      <div className="text-center">
        <p className="text-2xl sm:text-3xl font-black text-white mb-1">It's a tie!</p>
        <p className="text-gray-400 text-sm font-mono">Both equally cooked at {job1.score}/100</p>
      </div>
    )
  }

  const intensity = diff >= 40 ? 'way' : diff >= 20 ? 'significantly' : 'slightly'

  return (
    <div className="text-center">
      <p className="text-2xl sm:text-3xl font-black text-white mb-1">
        {moreCooked.title} is {intensity} more cooked
      </p>
      <p className="text-gray-400 text-sm font-mono">
        {moreCooked.score}/100 vs {lessCooked.score}/100 — a {diff}-point gap
      </p>
    </div>
  )
}

function CompareActions({ job1, job2, onReset, onShowLeaderboard }) {
  const [shared, setShared] = useState(false)

  const handlePrimaryShare = async () => {
    trackEvent('compare_share_primary')
    if (canNativeShare()) {
      const didShare = await nativeCompareShare(job1.title, job1.score, job1.status, job2.title, job2.score, job2.status)
      if (didShare) {
        setShared(true)
        setTimeout(() => setShared(false), 2500)
      }
    } else {
      const text = getCompareCopyText(job1.title, job1.score, job1.status, job2.title, job2.score, job2.status)
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        const textarea = document.createElement('textarea')
        textarea.value = text
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setShared(true)
      setTimeout(() => setShared(false), 2500)
    }
  }

  const handleTwitter = () => {
    trackEvent('compare_share_twitter')
    window.open(getCompareShareUrl(job1.title, job1.score, job1.status, job2.title, job2.score, job2.status), '_blank', 'noopener')
  }

  const handleLinkedIn = () => {
    trackEvent('compare_share_linkedin')
    window.open(getCompareLinkedInUrl(job1.title, job1.score, job1.status, job2.title, job2.score, job2.status), '_blank', 'noopener')
  }

  const handleReset = () => {
    trackEvent('try_again')
    onReset()
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <button
        onClick={handlePrimaryShare}
        className={`w-full font-bold py-3 rounded-lg transition-all cursor-pointer text-sm ${
          shared
            ? 'bg-green-500/20 border border-green-500/50 text-green-400'
            : 'bg-white text-black hover:bg-gray-200'
        }`}
      >
        {shared ? '✓ Copied to clipboard!' : 'Share This Matchup'}
      </button>

      <div className="flex gap-2 w-full">
        <button
          onClick={handleTwitter}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dark-border text-gray-400 hover:border-gray-500 hover:text-white transition-colors cursor-pointer text-sm font-medium"
        >
          <span className="text-base leading-none">𝕏</span>
          <span>Post on X</span>
        </button>

        <button
          onClick={handleLinkedIn}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dark-border text-gray-400 hover:border-gray-500 hover:text-white transition-colors cursor-pointer text-sm font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          <span>Share on LinkedIn</span>
        </button>
      </div>

      <button
        onClick={handleReset}
        className="text-gray-500 hover:text-gray-300 text-sm font-mono transition-colors cursor-pointer mt-1"
      >
        ← Try another matchup
      </button>

      {onShowLeaderboard && (
        <button
          onClick={onShowLeaderboard}
          className="text-gray-600 hover:text-gray-400 text-xs font-mono transition-colors cursor-pointer"
        >
          🏆 See the Leaderboard
        </button>
      )}
    </div>
  )
}

function AnimateIn({ delay = 0, children }) {
  return (
    <div
      className="opacity-0 animate-slide-up w-full"
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

export default function CompareResult({ data, onReset, onShowLeaderboard }) {
  const { job1, job2 } = data

  return (
    <div className="max-w-2xl w-full flex flex-col items-center gap-4 sm:gap-6">
      {/* VS Header */}
      <AnimateIn delay={0}>
        <div className="text-center mb-2">
          <p className="text-gray-500 font-mono text-xs uppercase tracking-widest mb-1">⚔️ Job Showdown</p>
        </div>
      </AnimateIn>

      {/* Side-by-side scores */}
      <AnimateIn delay={100}>
        <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
          <CompareScore score={job1.score} label={job1.title} />
          <div className="flex flex-col items-center gap-1">
            <span className="text-gray-600 font-black text-xl sm:text-2xl">VS</span>
          </div>
          <CompareScore score={job2.score} label={job2.title} />
        </div>
      </AnimateIn>

      {/* Status badges side by side */}
      <AnimateIn delay={300}>
        <div className="flex justify-center gap-3 sm:gap-6 flex-wrap">
          <StatusBadge status={job1.status} emoji={job1.status_emoji} />
          <StatusBadge status={job2.status} emoji={job2.status_emoji} />
        </div>
      </AnimateIn>

      {/* Verdict */}
      <AnimateIn delay={500}>
        <Verdict job1={job1} job2={job2} />
      </AnimateIn>

      {/* Hot takes */}
      <AnimateIn delay={700}>
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-dark-card border border-dark-border rounded-lg p-4">
            <p className="font-mono text-xs uppercase tracking-widest mb-2 text-gray-500 truncate">{job1.title}</p>
            <p className="text-gray-300 text-sm italic leading-relaxed">&ldquo;{job1.hot_take}&rdquo;</p>
          </div>
          <div className="bg-dark-card border border-dark-border rounded-lg p-4">
            <p className="font-mono text-xs uppercase tracking-widest mb-2 text-gray-500 truncate">{job2.title}</p>
            <p className="text-gray-300 text-sm italic leading-relaxed">&ldquo;{job2.hot_take}&rdquo;</p>
          </div>
        </div>
      </AnimateIn>

      {/* Timelines */}
      <AnimateIn delay={800}>
        <div className="flex justify-center gap-6 sm:gap-12 flex-wrap">
          <div className="flex items-center gap-2 text-gray-400 font-mono text-xs">
            <span>⏱</span>
            <span>{job1.title}: {job1.timeline}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400 font-mono text-xs">
            <span>⏱</span>
            <span>{job2.title}: {job2.timeline}</span>
          </div>
        </div>
      </AnimateIn>

      {/* Actions */}
      <AnimateIn delay={1000}>
        <CompareActions job1={job1} job2={job2} onReset={onReset} onShowLeaderboard={onShowLeaderboard} />
      </AnimateIn>
    </div>
  )
}
