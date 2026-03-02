import { useState, useEffect, useRef, useCallback } from 'react'

const MAX_VISIBLE = 5
const DISPLAY_INTERVAL = 1500 // ms between showing queued items
const MAX_QUEUE = 20

function scoreColor(score) {
  if (score <= 20) return '#22c55e'
  if (score <= 40) return '#86efac'
  if (score <= 60) return '#f59e0b'
  if (score <= 80) return '#f97316'
  return '#ef4444'
}

function FeedEntry({ entry, isNew }) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg border border-dark-border
        bg-dark-card/50 font-mono text-xs transition-all duration-500
        ${isNew ? 'animate-slide-up' : 'opacity-70'}`}
    >
      <span className="shrink-0">{entry.type === 'company' ? '🏢' : entry.status_emoji}</span>
      <span className="text-gray-300 truncate capitalize flex-1">
        {entry.title}
      </span>
      <span
        className="font-bold tabular-nums shrink-0"
        style={{ color: scoreColor(entry.score) }}
      >
        {entry.score}
      </span>
      <span className="text-gray-600 shrink-0 hidden sm:inline text-[10px]">
        {entry.status}
      </span>
    </div>
  )
}

export default function LiveFeed() {
  const [items, setItems] = useState([])
  const [newestId, setNewestId] = useState(null)
  const queueRef = useRef([])
  const timerRef = useRef(null)
  const idCounter = useRef(0)

  // Process one item from the queue at a time
  const processQueue = useCallback(() => {
    if (queueRef.current.length === 0) {
      timerRef.current = null
      return
    }

    const entry = queueRef.current.shift()
    const id = ++idCounter.current
    entry._id = id
    setNewestId(id)

    setItems(prev => {
      const next = [entry, ...prev]
      return next.slice(0, MAX_VISIBLE)
    })

    // Schedule next
    timerRef.current = setTimeout(processQueue, DISPLAY_INTERVAL)
  }, [])

  const enqueue = useCallback((entry) => {
    if (queueRef.current.length >= MAX_QUEUE) {
      queueRef.current.shift() // drop oldest unprocessed
    }
    queueRef.current.push(entry)

    // Start processing if not already running
    if (!timerRef.current) {
      processQueue()
    }
  }, [processQueue])

  useEffect(() => {
    const es = new EventSource('/api/live-feed')

    es.addEventListener('seed', (e) => {
      try {
        const analyses = JSON.parse(e.data)
        // Assign IDs and populate immediately (no animation queue for seed)
        const seeded = analyses.reverse().map(a => ({
          ...a,
          _id: ++idCounter.current,
        }))
        setItems(seeded.slice(-MAX_VISIBLE).reverse())
      } catch { /* ignore malformed data */ }
    })

    es.addEventListener('analysis', (e) => {
      try {
        const entry = JSON.parse(e.data)
        enqueue(entry)
      } catch { /* ignore malformed data */ }
    })

    return () => {
      es.close()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [enqueue])

  if (items.length === 0) return null

  return (
    <div className="w-full max-w-lg mt-8 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <span className="text-gray-600 text-[10px] font-mono uppercase tracking-wider">
          Live — Recent Analyses
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <FeedEntry
            key={item._id}
            entry={item}
            isNew={item._id === newestId}
          />
        ))}
      </div>
    </div>
  )
}
