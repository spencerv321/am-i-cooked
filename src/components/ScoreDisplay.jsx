import { useScoreAnimation } from '../hooks/useScoreAnimation'

function getScoreColor(score) {
  const hue = 120 - (score / 100) * 120
  return `hsl(${hue}, 80%, 50%)`
}

export default function ScoreDisplay({ score }) {
  const animatedScore = useScoreAnimation(score)
  const color = getScoreColor(animatedScore)

  return (
    <div className="flex flex-col items-center">
      <p className="text-gray-500 font-mono text-xs uppercase tracking-widest mb-2">
        Your Score
      </p>
      <div
        className="text-7xl sm:text-8xl md:text-9xl font-black font-mono score-glow tabular-nums"
        style={{ '--score-color': color, color }}
      >
        {animatedScore}
      </div>
      <div className="w-full max-w-xs mt-4 h-2 bg-dark-card rounded-full overflow-hidden border border-dark-border">
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
