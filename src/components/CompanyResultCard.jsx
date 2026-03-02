import ScoreDisplay from './ScoreDisplay'
import StatusBadge from './StatusBadge'
import HotTake from './HotTake'
import DimensionCard from './DimensionCard'
import CompanyActionButtons from './CompanyActionButtons'
import { trackEvent } from '../lib/api'

function AnimateIn({ delay = 0, children }) {
  return (
    <div
      className="opacity-0 animate-slide-up w-full"
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

const DIMENSION_ORDER = [
  'product_disruption',
  'headcount_vulnerability',
  'moat_erosion',
  'business_model_risk',
  'market_viability',
]

export default function CompanyResultCard({ data, companyName, onReset, onSwitchToJob, onAnimationDone }) {
  const handleCrosslink = () => {
    trackEvent('company_crosslink_job')
    onSwitchToJob()
  }

  return (
    <div className="max-w-lg w-full flex flex-col items-center gap-4 sm:gap-6">
      <AnimateIn delay={0}>
        <ScoreDisplay score={data.overall_score} onAnimationDone={onAnimationDone} label="Disruption Score" />
      </AnimateIn>

      <AnimateIn delay={200}>
        <StatusBadge status={data.overall_status} emoji={data.overall_status_emoji} />
      </AnimateIn>

      {/* Company info line */}
      <AnimateIn delay={300}>
        <div className="text-center">
          <p className="text-gray-300 font-semibold text-base">
            {data.company_name}
            {data.ticker && <span className="text-gray-500 font-mono text-sm ml-1.5">({data.ticker})</span>}
          </p>
          <p className="text-gray-500 font-mono text-xs mt-0.5">
            {data.sector}
            {data.employee_estimate && data.employee_estimate !== 'Unknown' && (
              <span> · {data.employee_estimate} employees</span>
            )}
          </p>
        </div>
      </AnimateIn>

      {/* Disclaimer */}
      <AnimateIn delay={350}>
        <p className="text-gray-600 text-[10px] font-mono text-center">
          AI-generated analysis · Not financial advice · Not a research report
        </p>
      </AnimateIn>

      <AnimateIn delay={400}>
        <HotTake text={data.hot_take} />
      </AnimateIn>

      {/* Timeline */}
      <AnimateIn delay={500}>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 text-gray-400 font-mono text-xs sm:text-sm">
            <span>⏱</span>
            <span>Timeline: {data.timeline}</span>
          </div>
          {data.timeline_detail && (
            <p className="text-gray-500 text-xs text-center max-w-sm">{data.timeline_detail}</p>
          )}
        </div>
      </AnimateIn>

      {/* Dimensions */}
      <AnimateIn delay={600}>
        <div className="w-full">
          <h3 className="font-mono text-xs uppercase tracking-widest mb-3 text-gray-500 text-center">
            5 Dimensions of AI Risk
          </h3>
          <div className="flex flex-col gap-2">
            {DIMENSION_ORDER.map((key) => (
              data.dimensions[key] && (
                <DimensionCard
                  key={key}
                  dimensionKey={key}
                  data={data.dimensions[key]}
                />
              )
            ))}
          </div>
        </div>
      </AnimateIn>

      {/* Verdict section */}
      <AnimateIn delay={700}>
        <div className="w-full flex flex-col gap-3">
          {/* What would kill it */}
          <div className="bg-dark-card border border-red-500/20 rounded-lg p-4">
            <h3 className="font-mono text-xs uppercase tracking-widest mb-2 text-red-400">
              What Would Kill It
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed">{data.what_would_kill_it}</p>
          </div>

          {/* What keeps it alive */}
          <div className="bg-dark-card border border-green-500/20 rounded-lg p-4">
            <h3 className="font-mono text-xs uppercase tracking-widest mb-2 text-green-400">
              What Keeps It Alive
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed">{data.what_keeps_it_alive}</p>
          </div>

          {/* AI adaptation signals */}
          <div className="bg-dark-card border border-blue-500/20 rounded-lg p-4">
            <h3 className="font-mono text-xs uppercase tracking-widest mb-2 text-blue-400">
              AI Adaptation Signals
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed">{data.ai_adaptation_signals}</p>
          </div>
        </div>
      </AnimateIn>

      {/* Summary */}
      <AnimateIn delay={800}>
        <div className="bg-dark-card border border-dark-border rounded-lg p-4 sm:p-5 w-full">
          <h3 className="font-mono text-xs uppercase tracking-widest mb-2 text-gray-500">
            Summary
          </h3>
          <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
            {data.summary}
          </p>
        </div>
      </AnimateIn>

      {/* Cross-link to job mode */}
      <AnimateIn delay={900}>
        <button
          onClick={handleCrosslink}
          className="text-gray-500 hover:text-gray-300 text-xs font-mono transition-colors cursor-pointer"
        >
          🍳 Is YOUR job cooked? Check now →
        </button>
      </AnimateIn>

      <AnimateIn delay={1000}>
        <CompanyActionButtons
          companyName={companyName}
          score={data.overall_score}
          status={data.overall_status}
          onReset={onReset}
        />
      </AnimateIn>

      {/* Footer disclaimer */}
      <AnimateIn delay={1050}>
        <p className="text-gray-700 text-[9px] font-mono text-center leading-relaxed max-w-sm mt-2">
          Company analysis is generated by AI based on training data. Scores represent one model's assessment and should not be used as the sole basis for investment, employment, or business decisions.
        </p>
      </AnimateIn>
    </div>
  )
}
