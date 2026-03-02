import { useState } from 'react'
import { trackEvent } from '../lib/api'

function getScoreColor(score) {
  const hue = 120 - (score / 100) * 120
  return `hsl(${hue}, 80%, 50%)`
}

const DIMENSION_NAMES = {
  product_disruption: 'Product Disruption',
  headcount_vulnerability: 'Headcount Vulnerability',
  moat_erosion: 'Moat Erosion',
  business_model_risk: 'Business Model Risk',
  market_viability: 'Market Viability',
}

const DIMENSION_ICONS = {
  product_disruption: '📦',
  headcount_vulnerability: '👥',
  moat_erosion: '🏰',
  business_model_risk: '💰',
  market_viability: '📈',
}

export default function DimensionCard({ dimensionKey, data }) {
  const [expanded, setExpanded] = useState(false)

  const { score_now, score_2028, label, analysis } = data
  const delta = score_2028 - score_now
  const name = DIMENSION_NAMES[dimensionKey] || dimensionKey
  const icon = DIMENSION_ICONS[dimensionKey] || '📊'

  const handleToggle = () => {
    if (!expanded) trackEvent('company_dimension_expand')
    setExpanded(!expanded)
  }

  const getDeltaColor = () => {
    if (delta >= 20) return 'text-red-400'
    if (delta >= 10) return 'text-orange-400'
    if (delta > 0) return 'text-yellow-400'
    if (delta < 0) return 'text-green-400'
    return 'text-gray-500'
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-lg shrink-0">{icon}</span>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-white text-sm font-semibold truncate">{name}</span>
            <span className={`text-xs font-mono shrink-0 ${getDeltaColor()}`}>
              {delta > 0 ? `+${delta}` : delta === 0 ? '—' : delta}
            </span>
          </div>
          <p className="text-gray-500 text-xs font-mono truncate">{label}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-[10px] font-mono text-gray-600 w-8 shrink-0">NOW</span>
              <div className="flex-1 h-1.5 bg-dark rounded-full overflow-hidden border border-dark-border/50">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${score_now}%`, backgroundColor: getScoreColor(score_now) }}
                />
              </div>
              <span className="text-xs font-mono w-6 text-right shrink-0" style={{ color: getScoreColor(score_now) }}>{score_now}</span>
            </div>
            <span className="text-gray-600 text-[10px]">→</span>
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-[10px] font-mono text-gray-600 w-8 shrink-0">2028</span>
              <div className="flex-1 h-1.5 bg-dark rounded-full overflow-hidden border border-dark-border/50">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${score_2028}%`, backgroundColor: getScoreColor(score_2028) }}
                />
              </div>
              <span className="text-xs font-mono w-6 text-right shrink-0" style={{ color: getScoreColor(score_2028) }}>{score_2028}</span>
            </div>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-3 pt-0">
          <div className="border-t border-dark-border/50 pt-3">
            <p className="text-gray-300 text-sm leading-relaxed">{analysis}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
