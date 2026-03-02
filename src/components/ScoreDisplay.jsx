import { useEffect, useRef, useState } from 'react'
import { useScoreAnimation } from '../hooks/useScoreAnimation'

function getScoreColor(score) {
  const hue = 120 - (score / 100) * 120
  return `hsl(${hue}, 80%, 50%)`
}

export default function ScoreDisplay({ score, onAnimationDone, label }) {
  const animatedScore = useScoreAnimation(score)
  const color = getScoreColor(animatedScore)
  const [animationDone, setAnimationDone] = useState(false)
  const confettiFired = useRef(false)

  // Detect when score animation completes (2 seconds)
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimationDone(true)
      onAnimationDone?.()
    }, 2100) // slightly after the 2s animation
    return () => clearTimeout(timer)
  }, [score])

  // Fire confetti for Fully Cooked scores
  useEffect(() => {
    if (animationDone && score >= 90 && !confettiFired.current) {
      confettiFired.current = true
      import('canvas-confetti').then((mod) => {
        const confetti = mod.default
        // Fire burst
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.3 },
          colors: ['#ef4444', '#f97316', '#eab308', '#ff6b6b', '#ff8c00'],
        })
        // Second burst slightly delayed
        setTimeout(() => {
          confetti({
            particleCount: 50,
            spread: 100,
            origin: { y: 0.4 },
            colors: ['#ef4444', '#f97316', '#eab308'],
          })
        }, 200)
      })
    }
  }, [animationDone, score])

  // Determine effect class
  const getEffectClass = () => {
    if (!animationDone) return ''
    if (score >= 70) return 'score-shake'
    if (score <= 19) return 'score-frost'
    return ''
  }

  return (
    <div className="flex flex-col items-center">
      <p className="text-gray-500 font-mono text-xs uppercase tracking-widest mb-2">
        {label || 'Your Score'}
      </p>
      <div
        className={`text-6xl sm:text-8xl md:text-9xl font-black font-mono score-glow tabular-nums ${getEffectClass()}`}
        style={{ '--score-color': color, color }}
      >
        {animatedScore}
      </div>
      <div className="w-full max-w-xs mt-3 sm:mt-4 h-2 bg-dark-card rounded-full overflow-hidden border border-dark-border">
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
