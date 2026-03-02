import { useState, useEffect } from 'react'
import './index.css'
import { analyzeJob, trackEvent } from './lib/api'
import InputSection from './components/InputSection'
import LoadingState from './components/LoadingState'
import ResultCard from './components/ResultCard'
import CompareResult from './components/CompareResult'
import Leaderboard from './components/Leaderboard'
import LiveFeed from './components/LiveFeed'
import StickyShareCTA from './components/StickyShareCTA'
import Footer from './components/Footer'

// Read ?job= or ?compare= query param synchronously so it's available on first render
function getInitialParams() {
  const params = new URLSearchParams(window.location.search)
  const job = params.get('job')
  const compare = params.get('compare')
  if (job || compare) {
    window.history.replaceState({}, '', window.location.pathname + window.location.hash)
  }
  if (compare) {
    const [job1, job2] = compare.split(',').map(s => s.trim())
    return { job1: job1 || '', job2: job2 || '' }
  }
  return { job1: job || '', job2: '' }
}

function App() {
  const [initial] = useState(getInitialParams)
  const [appState, setAppState] = useState('idle')
  const [jobTitle, setJobTitle] = useState(initial.job1)
  const [resultData, setResultData] = useState(null)
  const [error, setError] = useState(null)

  const [scoreAnimDone, setScoreAnimDone] = useState(false)

  // Compare mode state
  const [compareJobs, setCompareJobs] = useState({ job1: '', job2: '' })
  const [compareData, setCompareData] = useState(null)

  // Hash routing — check on mount and listen for changes
  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#leaderboard' && appState === 'idle') {
        setAppState('leaderboard')
      }
    }
    checkHash()
    window.addEventListener('hashchange', checkHash)
    return () => window.removeEventListener('hashchange', checkHash)
  }, [appState])

  const handleSubmit = async (title, tone = null) => {
    setJobTitle(title)
    setAppState('loading')
    setScoreAnimDone(false)
    setError(null)
    window.location.hash = ''
    try {
      const data = await analyzeJob(title, tone)
      setResultData(data)
      setAppState('result')
    } catch (err) {
      setError(err.message)
      setAppState('idle')
    }
  }

  const handleCompare = async (job1, job2, tone = null) => {
    trackEvent('compare_submit')
    setCompareJobs({ job1, job2 })
    setAppState('compare-loading')
    setError(null)
    window.location.hash = ''
    try {
      const [data1, data2] = await Promise.all([
        analyzeJob(job1, tone),
        analyzeJob(job2, tone),
      ])
      setCompareData({ job1: { title: job1, ...data1 }, job2: { title: job2, ...data2 } })
      setAppState('compare-result')
    } catch (err) {
      setError(err.message)
      setAppState('idle')
    }
  }

  // Auto-trigger compare if URL had ?compare=
  useEffect(() => {
    if (initial.job2 && initial.job1) {
      handleCompare(initial.job1, initial.job2)
    } else if (initial.job1 && !initial.job2) {
      handleSubmit(initial.job1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll to top when results load so the score is visible
  useEffect(() => {
    if (appState === 'result' || appState === 'compare-result') {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [appState])

  const handleReset = () => {
    setAppState('idle')
    setResultData(null)
    setCompareData(null)
    setScoreAnimDone(false)
    setJobTitle('')
    setCompareJobs({ job1: '', job2: '' })
    setError(null)
    window.location.hash = ''
  }

  const handleShowLeaderboard = () => {
    setAppState('leaderboard')
    setResultData(null)
    setCompareData(null)
    setError(null)
    window.location.hash = 'leaderboard'
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const handleLeaderboardAnalyze = (title) => {
    window.location.hash = ''
    handleSubmit(title)
  }

  const isResult = appState === 'result'
  const isCompareResult = appState === 'compare-result'

  return (
    <div
      className={`min-h-screen bg-dark flex flex-col items-center px-4 py-8 sm:py-12 font-display ${
        isResult || isCompareResult ? 'justify-start pt-8 sm:pt-12' : 'justify-center'
      }`}
    >
      {appState === 'idle' && (
        <>
          <InputSection
            onSubmit={handleSubmit}
            onCompare={handleCompare}
            error={error}
            onShowLeaderboard={handleShowLeaderboard}
            defaultValue={jobTitle}
          />
          <LiveFeed />
        </>
      )}
      {(appState === 'loading' || appState === 'compare-loading') && <LoadingState />}
      {isResult && resultData && (
        <>
          <ResultCard data={resultData} jobTitle={jobTitle} onReset={handleReset} onShowLeaderboard={handleShowLeaderboard} onAnimationDone={() => setScoreAnimDone(true)} />
          <StickyShareCTA
            jobTitle={jobTitle}
            score={resultData.score}
            status={resultData.status}
            visible={scoreAnimDone}
          />
        </>
      )}
      {isCompareResult && compareData && (
        <CompareResult data={compareData} onReset={handleReset} onShowLeaderboard={handleShowLeaderboard} />
      )}
      {appState === 'leaderboard' && (
        <Leaderboard onAnalyzeJob={handleLeaderboardAnalyze} onGoHome={handleReset} />
      )}
      <Footer />
    </div>
  )
}

export default App
