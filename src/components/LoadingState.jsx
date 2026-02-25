import { useState, useEffect } from 'react'
import { loadingQuips } from '../constants/loadingQuips'

export default function LoadingState() {
  const [quipIndex, setQuipIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setQuipIndex((prev) => (prev + 1) % loadingQuips.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center text-center animate-fade-in">
      <div className="text-6xl sm:text-7xl cooking-animation mb-6">🍳</div>
      <p className="text-gray-400 font-mono text-sm sm:text-base">
        {loadingQuips[quipIndex]}
      </p>
    </div>
  )
}
