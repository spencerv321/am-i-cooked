import { useState, useEffect } from 'react'
import { fetchLeaderboard, fetchCompanyLeaderboard, trackEvent } from '../lib/api'

const JOB_TABS = [
  { id: 'most_cooked', label: 'Most Cooked', short: 'Cooked', emoji: '🔥' },
  { id: 'least_cooked', label: 'Least Cooked', short: 'Safest', emoji: '🧊' },
  { id: 'most_popular', label: 'Most Popular', short: 'Popular', emoji: '📊' },
]

const COMPANY_TABS = [
  { id: 'most_disrupted', label: 'Most Disrupted', short: 'Disrupted', emoji: '💀' },
  { id: 'most_resilient', label: 'Most Resilient', short: 'Resilient', emoji: '🛡️' },
  { id: 'most_analyzed', label: 'Most Analyzed', short: 'Popular', emoji: '📊' },
]

function scoreColor(score) {
  if (score <= 20) return '#22c55e'
  if (score <= 40) return '#86efac'
  if (score <= 60) return '#f59e0b'
  if (score <= 80) return '#f97316'
  return '#ef4444'
}

function statusPillColor(status) {
  switch (status) {
    case 'Raw': return 'bg-green-500/20 text-green-400'
    case 'Medium Rare': return 'bg-green-500/10 text-green-300'
    case 'Medium': return 'bg-yellow-500/20 text-yellow-400'
    case 'Well Done': return 'bg-orange-500/20 text-orange-400'
    case 'Fully Cooked': return 'bg-red-500/20 text-red-400'
    default: return 'bg-gray-500/20 text-gray-400'
  }
}

function LeaderboardRow({ rank, item, isPopular, onClick }) {
  const score = item.avg_score
  const barWidth = score != null ? Math.max(score, 4) : 0
  const color = score != null ? scoreColor(score) : '#666'

  return (
    <button
      onClick={() => { trackEvent('leaderboard_job_click'); onClick(item.title) }}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer text-left group"
    >
      {/* Rank */}
      <span className="text-gray-600 font-mono text-xs w-6 text-right shrink-0">
        #{rank}
      </span>

      {/* Title */}
      <span className="text-white text-sm font-medium truncate min-w-0 flex-1 group-hover:text-white/90 capitalize">
        {item.title}
      </span>

      {/* Score bar or search count */}
      {isPopular ? (
        <span className="text-gray-500 font-mono text-xs shrink-0">
          {item.searches} searches
        </span>
      ) : (
        <div className="hidden sm:flex items-center gap-2 shrink-0 w-28">
          <div className="flex-1 h-1.5 bg-dark-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${barWidth}%`, backgroundColor: color }}
            />
          </div>
        </div>
      )}

      {/* Score number */}
      {score != null && (
        <span className="font-mono text-sm font-bold shrink-0 w-7 text-right" style={{ color }}>
          {score}
        </span>
      )}

      {/* Status pill */}
      {item.status && (
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 hidden sm:inline ${statusPillColor(item.status)}`}>
          {item.status.toUpperCase()}
        </span>
      )}

      {/* Count */}
      <span className="text-gray-600 font-mono text-[10px] shrink-0 hidden sm:inline">
        ({item.analyses || item.searches}x)
      </span>
    </button>
  )
}

export default function Leaderboard({ mode = 'job', onAnalyzeJob, onAnalyzeCompany, onGoHome }) {
  const isCompany = mode === 'company'
  const tabs = isCompany ? COMPANY_TABS : JOB_TABS
  const [activeTab, setActiveTab] = useState(tabs[0].id)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    trackEvent('view_leaderboard')
    setLoading(true)
    setError(null)
    setActiveTab(isCompany ? COMPANY_TABS[0].id : JOB_TABS[0].id)
    const fetcher = isCompany ? fetchCompanyLeaderboard : fetchLeaderboard
    fetcher()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [isCompany])

  const items = data ? data[activeTab] || [] : []
  const isPopularTab = activeTab === 'most_popular' || activeTab === 'most_analyzed'
  const handleClick = isCompany ? onAnalyzeCompany : onAnalyzeJob

  return (
    <div className="flex flex-col items-center text-center max-w-lg w-full animate-fade-in">
      {/* Header */}
      <div className="text-4xl mb-3">{isCompany ? '🏢' : '🏆'}</div>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-1 uppercase">
        {isCompany ? 'Company Leaderboard' : 'Leaderboard'}
      </h1>
      <p className="text-gray-500 text-sm mb-6 font-mono">
        {isCompany ? 'Which companies are AI disrupting?' : 'Which jobs are AI coming for?'}
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 w-full bg-dark-card rounded-lg p-1 border border-dark-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { trackEvent('leaderboard_tab'); setActiveTab(tab.id) }}
            className={`flex-1 py-2 px-2 rounded-md text-xs font-mono transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white/10 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <span className="mr-1">{tab.emoji}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.short}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="w-full bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        {loading && (
          <div className="py-12 text-gray-500 font-mono text-sm">
            Loading leaderboard...
          </div>
        )}

        {error && (
          <div className="py-12 text-red-400 font-mono text-sm">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="py-12 px-4">
            <p className="text-gray-500 font-mono text-sm">
              {isCompany
                ? 'Not enough company data yet — keep analyzing to build the leaderboard!'
                : 'Not enough data yet — keep searching to build the leaderboard!'}
            </p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="divide-y divide-dark-border">
            {items.map((item, i) => (
              <LeaderboardRow
                key={item.title}
                rank={i + 1}
                item={item}
                isPopular={isPopularTab}
                onClick={handleClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tap hint */}
      {!loading && items.length > 0 && (
        <p className="text-gray-600 text-[10px] font-mono mt-2">
          Tap any {isCompany ? 'company' : 'job'} to run a fresh analysis
        </p>
      )}

      {/* Back to home */}
      <button
        onClick={onGoHome}
        className="text-gray-500 hover:text-gray-300 text-sm font-mono transition-colors cursor-pointer mt-4"
      >
        ← Back to search
      </button>
    </div>
  )
}
