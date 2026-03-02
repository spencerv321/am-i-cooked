import { useState, useEffect } from 'react'

const TONES = [
  { id: 'chaos_agent', label: '🌀 Chaos Agent' },
  { id: 'corporate_shill', label: '💼 Corporate Shill' },
  { id: 'michael_scott', label: '🏢 Michael Scott' },
]

function JobCounter() {
  const [count, setCount] = useState(null)

  useEffect(() => {
    fetch('/api/count')
      .then(res => res.json())
      .then(data => setCount(data.count))
      .catch(() => {})
  }, [])

  if (!count) return null

  return (
    <p className="text-gray-600 text-xs font-mono mb-6">
      🍳 {count.toLocaleString()} jobs cooked so far
    </p>
  )
}

export default function InputSection({ onSubmit, onCompare, onCompanySubmit, error, onShowLeaderboard, defaultValue = '', defaultCompareValue = '', mode = 'job', onModeChange }) {
  const [input, setInput] = useState(defaultValue)
  const [input2, setInput2] = useState(defaultCompareValue)
  const [selectedTone, setSelectedTone] = useState(null)
  const [compareMode, setCompareMode] = useState(!!defaultCompareValue)
  const [companyInput, setCompanyInput] = useState('')

  const isCompany = mode === 'company'

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isCompany) {
      if (companyInput.trim()) {
        onCompanySubmit(companyInput.trim())
      }
    } else if (compareMode) {
      if (input.trim() && input2.trim()) {
        onCompare(input.trim(), input2.trim(), selectedTone)
      }
    } else {
      if (input.trim()) {
        onSubmit(input.trim(), selectedTone)
      }
    }
  }

  const toggleCompare = () => {
    setCompareMode(!compareMode)
    if (!compareMode) setInput2('')
  }

  const isSubmitDisabled = isCompany
    ? !companyInput.trim()
    : compareMode
      ? !input.trim() || !input2.trim()
      : !input.trim()

  return (
    <div className="flex flex-col items-center text-center max-w-lg w-full animate-fade-in">
      {/* Mode toggle */}
      {onModeChange && (
        <div className="flex gap-1 mb-5">
          <button
            type="button"
            onClick={() => onModeChange('job')}
            className={`px-4 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer border ${
              !isCompany
                ? 'bg-white/10 border-white/40 text-white'
                : 'bg-transparent border-dark-border text-gray-500 hover:border-gray-500 hover:text-gray-300'
            }`}
          >
            My Job
          </button>
          <button
            type="button"
            onClick={() => onModeChange('company')}
            className={`px-4 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer border ${
              isCompany
                ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 border-purple-400/50 text-white'
                : 'bg-gradient-to-r from-blue-600/40 via-purple-600/40 to-blue-600/40 border-purple-400/30 text-white/80 hover:from-blue-600/60 hover:via-purple-600/60 hover:to-blue-600/60 hover:text-white company-pill-pulse'
            }`}
          >
            My Company
          </button>
        </div>
      )}

      <div className="text-5xl mb-4">{isCompany ? '🏢' : '🍳'}</div>
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-3 uppercase">
        Am I Cooked?
      </h1>
      <p className="text-gray-400 text-base sm:text-lg mb-2">
        {isCompany
          ? 'Find out if AI is coming for your company'
          : compareMode
            ? 'Compare two jobs — who\'s more cooked?'
            : 'Find out if AI is coming for your job'}
      </p>
      {!isCompany && <JobCounter />}
      {isCompany && <div className="mb-6" />}

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
        {isCompany ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={companyInput}
              onChange={(e) => setCompanyInput(e.target.value)}
              placeholder="Enter a company name..."
              maxLength={100}
              className="flex-1 bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-white placeholder-gray-500 font-mono text-base focus:outline-none focus:border-gray-500 transition-colors"
              autoFocus
            />
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="bg-white text-black font-bold px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm sm:text-base whitespace-nowrap cursor-pointer"
            >
              Analyze →
            </button>
          </div>
        ) : compareMode ? (
          <>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="First job title..."
                maxLength={100}
                className="flex-1 bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-white placeholder-gray-500 font-mono text-base focus:outline-none focus:border-gray-500 transition-colors"
                autoFocus
              />
              <span className="text-gray-500 font-black text-sm self-center">VS</span>
              <input
                type="text"
                value={input2}
                onChange={(e) => setInput2(e.target.value)}
                placeholder="Second job title..."
                maxLength={100}
                className="flex-1 bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-white placeholder-gray-500 font-mono text-base focus:outline-none focus:border-gray-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="bg-white text-black font-bold px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm sm:text-base whitespace-nowrap cursor-pointer"
            >
              Compare →
            </button>
          </>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter your job title..."
              maxLength={100}
              className="flex-1 bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-white placeholder-gray-500 font-mono text-base focus:outline-none focus:border-gray-500 transition-colors"
              autoFocus
            />
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="bg-white text-black font-bold px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm sm:text-base whitespace-nowrap cursor-pointer"
            >
              Find Out →
            </button>
          </div>
        )}
      </form>

      {/* Compare toggle — job mode only */}
      {!isCompany && (
        <button
          type="button"
          onClick={toggleCompare}
          className={`mt-3 px-4 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer border ${
            compareMode
              ? 'bg-purple-500/10 border-purple-500/40 text-purple-400 hover:border-purple-500/60'
              : 'bg-transparent border-dark-border text-gray-500 hover:border-gray-500 hover:text-gray-300'
          }`}
        >
          {compareMode ? '← Single job mode' : '⚔️ Compare two jobs'}
        </button>
      )}

      {/* Tone selector — job mode only */}
      {!isCompany && (
        <>
          <p className="text-gray-600 text-xs font-mono mt-4 mb-2">Pick a vibe (optional)</p>
          <div className="flex flex-wrap justify-center gap-2">
            {TONES.map((tone) => (
              <button
                key={tone.id}
                type="button"
                onClick={() => setSelectedTone(selectedTone === tone.id ? null : tone.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer border ${
                  selectedTone === tone.id
                    ? 'bg-white/10 border-white/40 text-white'
                    : 'bg-transparent border-dark-border text-gray-500 hover:border-gray-500 hover:text-gray-300'
                }`}
              >
                {tone.label}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <p className="text-red-400 text-sm mt-4 font-mono">{error}</p>
      )}

      {onShowLeaderboard && (
        <button
          onClick={onShowLeaderboard}
          className="mt-6 px-4 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer border border-yellow-500/20 text-yellow-500/70 hover:border-yellow-500/40 hover:text-yellow-500 bg-yellow-500/5 hover:bg-yellow-500/10"
        >
          🏆 View the Leaderboard
        </button>
      )}
    </div>
  )
}
