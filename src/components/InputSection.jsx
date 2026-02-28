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

export default function InputSection({ onSubmit, error, onShowLeaderboard, defaultValue = '' }) {
  const [input, setInput] = useState(defaultValue)
  const [selectedTone, setSelectedTone] = useState(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim()) {
      onSubmit(input.trim(), selectedTone)
    }
  }

  return (
    <div className="flex flex-col items-center text-center max-w-lg w-full animate-fade-in">
      <div className="text-5xl mb-4">🍳</div>
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-3 uppercase">
        Am I Cooked?
      </h1>
      <p className="text-gray-400 text-base sm:text-lg mb-2">
        Find out if AI is coming for your job
      </p>
      <JobCounter />

      <form onSubmit={handleSubmit} className="w-full flex flex-col sm:flex-row gap-3">
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
          disabled={!input.trim()}
          className="bg-white text-black font-bold px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm sm:text-base whitespace-nowrap cursor-pointer"
        >
          Find Out →
        </button>
      </form>

      {/* Tone selector */}
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
