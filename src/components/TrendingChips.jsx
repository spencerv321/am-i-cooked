import { useState, useEffect, useRef } from 'react'
import { fetchTrending, trackEvent } from '../lib/api'

// Horizontal strip of today's most-analyzed jobs — one-tap second analysis
// for visitors who arrived on a shared link. Renders nothing until there are
// at least 3 titles today, so quiet days don't show a sparse module.
const MIN_ITEMS = 3

export default function TrendingChips({ onSelect }) {
  const [items, setItems] = useState([])
  const impressionSent = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetchTrending()
      .then(data => {
        if (!cancelled && Array.isArray(data.trending)) setItems(data.trending)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (items.length >= MIN_ITEMS && !impressionSent.current) {
      impressionSent.current = true
      trackEvent('trending_impression')
    }
  }, [items])

  if (items.length < MIN_ITEMS) return null

  const handleClick = (title) => {
    trackEvent('trending_click')
    onSelect(title)
  }

  return (
    <div className="w-full max-w-xl mt-5">
      <p className="text-gray-500 font-mono text-[10px] uppercase tracking-widest mb-2 text-center">
        🔥 Trending today
      </p>
      <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(item => (
          <button
            key={item.title}
            onClick={() => handleClick(item.title)}
            className="shrink-0 flex items-center gap-1.5 bg-dark-card border border-dark-border hover:border-gray-500 rounded-full px-3 py-1.5 text-xs font-mono text-gray-300 hover:text-white transition-colors cursor-pointer capitalize"
          >
            {item.status_emoji && <span>{item.status_emoji}</span>}
            <span className="truncate max-w-[160px]">{item.title}</span>
            {item.avg_score != null && (
              <span className="text-gray-500">{item.avg_score}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
