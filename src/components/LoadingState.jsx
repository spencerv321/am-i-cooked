import { useState, useEffect } from 'react'
import { loadingQuips, companyLoadingQuips } from '../constants/loadingQuips'

export default function LoadingState({ mode = 'job' }) {
  const quips = mode === 'company' ? companyLoadingQuips : loadingQuips
  const [quipIndex, setQuipIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setQuipIndex((prev) => (prev + 1) % quips.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [quips])

  return (
    <div className="flex flex-col items-center text-center animate-fade-in">
      <div className="text-6xl sm:text-7xl cooking-animation mb-6">{mode === 'company' ? '🏢' : '🍳'}</div>
      <p className="text-gray-400 font-mono text-sm sm:text-base">
        {quips[quipIndex]}
      </p>
    </div>
  )
}
