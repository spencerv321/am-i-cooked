import ScoreDisplay from './ScoreDisplay'
import StatusBadge from './StatusBadge'
import HotTake from './HotTake'
import TaskBreakdown from './TaskBreakdown'
import TldrSection from './TldrSection'
import ActionButtons from './ActionButtons'

function AnimateIn({ delay = 0, children }) {
  return (
    <div
      className="opacity-0 animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

export default function ResultCard({ data, jobTitle, onReset }) {
  return (
    <div className="max-w-lg w-full flex flex-col items-center gap-6">
      <AnimateIn delay={0}>
        <ScoreDisplay score={data.score} />
      </AnimateIn>

      <AnimateIn delay={200}>
        <StatusBadge status={data.status} emoji={data.status_emoji} />
      </AnimateIn>

      <AnimateIn delay={400}>
        <div className="w-full">
          <HotTake text={data.hot_take} />
        </div>
      </AnimateIn>

      <AnimateIn delay={500}>
        <div className="flex items-center gap-2 text-gray-400 font-mono text-sm">
          <span>⏱</span>
          <span>Timeline: {data.timeline}</span>
        </div>
      </AnimateIn>

      <AnimateIn delay={600}>
        <div className="w-full">
          <TaskBreakdown
            title="What's at Risk"
            tasks={data.vulnerable_tasks}
            variant="danger"
          />
        </div>
      </AnimateIn>

      <AnimateIn delay={700}>
        <div className="w-full">
          <TaskBreakdown
            title="What's Safe (For Now)"
            tasks={data.safe_tasks}
            variant="safe"
          />
        </div>
      </AnimateIn>

      <AnimateIn delay={800}>
        <div className="w-full">
          <TldrSection text={data.tldr} />
        </div>
      </AnimateIn>

      <AnimateIn delay={1000}>
        <div className="w-full">
          <ActionButtons jobTitle={jobTitle} score={data.score} onReset={onReset} />
        </div>
      </AnimateIn>
    </div>
  )
}
