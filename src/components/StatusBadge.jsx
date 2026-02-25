function getStatusColor(status) {
  switch (status) {
    case 'Fully Cooked': return '#ef4444'
    case 'Well Done': return '#f97316'
    case 'Medium': return '#eab308'
    case 'Medium Rare': return '#84cc16'
    case 'Raw': return '#22c55e'
    default: return '#9ca3af'
  }
}

export default function StatusBadge({ status, emoji }) {
  const color = getStatusColor(status)

  return (
    <div
      className="inline-flex items-center gap-2 px-5 py-2 rounded-full border font-bold font-mono text-sm sm:text-base uppercase tracking-wide"
      style={{
        borderColor: color,
        color: color,
        backgroundColor: `${color}15`,
      }}
    >
      <span>{emoji}</span>
      <span>{status}</span>
    </div>
  )
}
