const riskColors = {
  high: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
  medium: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  low: { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30' },
}

function RiskBadge({ risk }) {
  const style = riskColors[risk] || riskColors.medium
  return (
    <span className={`${style.bg} ${style.text} ${style.border} border text-xs font-mono font-bold px-2 py-0.5 rounded uppercase shrink-0`}>
      {risk}
    </span>
  )
}

export default function TaskBreakdown({ title, tasks, variant }) {
  const isDanger = variant === 'danger'
  const accentColor = isDanger ? 'text-red-400' : 'text-green-400'
  const dotColor = isDanger ? 'bg-red-400' : 'bg-green-400'

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-4 sm:p-5">
      <h3 className={`font-mono text-xs uppercase tracking-widest mb-3 ${accentColor}`}>
        {title}
      </h3>
      <ul className="space-y-2.5">
        {tasks.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            <span className={`${dotColor} w-1.5 h-1.5 rounded-full mt-1.5 shrink-0`} />
            <div className="flex-1 flex items-start justify-between gap-2">
              <span className="text-gray-300">
                {item.task}
                {!isDanger && item.reason && (
                  <span className="text-gray-500"> — {item.reason}</span>
                )}
              </span>
              {isDanger && <RiskBadge risk={item.risk} />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
