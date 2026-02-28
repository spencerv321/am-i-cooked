import ScoreDisplay from './ScoreDisplay'
import StatusBadge from './StatusBadge'
import HotTake from './HotTake'
import TaskBreakdown from './TaskBreakdown'
import TldrSection from './TldrSection'
import ActionButtons from './ActionButtons'

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

export default function ResultCard({ data, jobTitle, onReset }) {
  return (
    <div className="max-w-lg w-full flex flex-col items-center gap-4 sm:gap-6">
      <AnimateIn delay={0}>
        <ScoreDisplay score={data.score} />
      </AnimateIn>

      <AnimateIn delay={200}>
        <StatusBadge status={data.status} emoji={data.status_emoji} />
      </AnimateIn>

      <AnimateIn delay={400}>
        <HotTake text={data.hot_take} />
      </AnimateIn>

      <AnimateIn delay={500}>
        <div className="flex items-center gap-2 text-gray-400 font-mono text-xs sm:text-sm">
          <span>⏱</span>
          <span>Timeline: {data.timeline}</span>
        </div>
      </AnimateIn>

      <AnimateIn delay={600}>
        <TaskBreakdown
          title="What's at Risk"
          tasks={data.vulnerable_tasks}
          variant="danger"
        />
      </AnimateIn>

      <AnimateIn delay={700}>
        <TaskBreakdown
          title="What's Safe (For Now)"
          tasks={data.safe_tasks}
          variant="safe"
        />
      </AnimateIn>

      <AnimateIn delay={800}>
        <TldrSection text={data.tldr} />
      </AnimateIn>

      <AnimateIn delay={1000}>
        <ActionButtons jobTitle={jobTitle} score={data.score} onReset={onReset} />
      </AnimateIn>
    </div>
  )
}
